-- D1 SQLite Migration for ReviewFlow
-- Run with: wrangler d1 execute reviewflow-db --local --file=packages/db/d1/migrations/0001_initial_schema.sql

PRAGMA foreign_keys = ON;

-- ============================================================================
-- Helper: Generate UUID v4 in SQLite (since no gen_random_uuid())
-- We'll generate UUIDs in the application layer using crypto.randomUUID()
-- ============================================================================

-- ============================================================================
-- Organizations (business/agency accounts)
-- ============================================================================
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,                           -- UUID v4 from app
  name TEXT NOT NULL,
  clerk_org_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  subscription_status TEXT,
  subscription_tier TEXT,
  settings TEXT DEFAULT '{}',                    -- JSON as TEXT
  created_at TEXT DEFAULT (datetime('now')),     -- ISO 8601
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_organizations_clerk_org_id ON organizations (clerk_org_id);

-- ============================================================================
-- Users (synced from Clerk via webhook)
-- ============================================================================
CREATE TABLE users (
  id TEXT PRIMARY KEY,                           -- UUID v4 from app
  clerk_id TEXT UNIQUE NOT NULL,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  email TEXT,
  role TEXT DEFAULT 'member',                    -- owner, admin, member, viewer
  raw_json TEXT,                                 -- JSON as TEXT
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_clerk_id ON users (clerk_id);
CREATE INDEX idx_users_organization_id ON users (organization_id);

-- ============================================================================
-- Google Business Accounts (connected GBP accounts)
-- ============================================================================
CREATE TABLE google_accounts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  google_account_email TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TEXT NOT NULL,                -- ISO 8601
  account_name TEXT,
  account_type TEXT,
  is_active INTEGER DEFAULT 1,                   -- SQLite boolean: 0/1
  last_sync_at TEXT,                             -- ISO 8601
  sync_error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_google_accounts_organization_id ON google_accounts (organization_id);

-- ============================================================================
-- Locations (Google Business locations)
-- ============================================================================
CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  google_account_id TEXT NOT NULL REFERENCES google_accounts(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  google_location_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  website TEXT,
  primary_category TEXT,
  place_id TEXT,
  maps_uri TEXT,
  is_active INTEGER DEFAULT 1,
  review_count INTEGER DEFAULT 0,
  average_rating REAL DEFAULT 0,                 -- SQLite REAL for numeric
  last_review_sync_at TEXT,
  settings TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_locations_organization_id ON locations (organization_id);
CREATE INDEX idx_locations_google_account_id ON locations (google_account_id);

-- ============================================================================
-- Reviews
-- ============================================================================
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  google_review_id TEXT NOT NULL UNIQUE,
  google_reviewer_id TEXT,
  reviewer_name TEXT,
  reviewer_profile_photo TEXT,
  star_rating INTEGER NOT NULL CHECK (star_rating >= 1 AND star_rating <= 5),
  comment TEXT,
  review_time TEXT NOT NULL,                     -- ISO 8601
  reply_text TEXT,
  reply_time TEXT,                               -- ISO 8601
  reply_author TEXT,
  has_reply INTEGER DEFAULT 0,
  is_replied_by_us INTEGER DEFAULT 0,
  internal_notes TEXT,
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'new',                     -- new, replied, resolved, flagged
  raw_json TEXT,                                 -- JSON as TEXT
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_reviews_location_id ON reviews (location_id);
CREATE INDEX idx_reviews_organization_id ON reviews (organization_id);
CREATE INDEX idx_reviews_status ON reviews (status);
CREATE INDEX idx_reviews_star_rating ON reviews (star_rating);
CREATE INDEX idx_reviews_review_time ON reviews (review_time);

-- ============================================================================
-- Review Collection Campaigns
-- ============================================================================
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id TEXT REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,                            -- sms, email, qr, link
  template_sms TEXT,
  template_email_subject TEXT,
  template_email_body TEXT,
  trigger_type TEXT DEFAULT 'manual',            -- manual, automatic, scheduled
  is_active INTEGER DEFAULT 1,
  settings TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_campaigns_organization_id ON campaigns (organization_id);

-- ============================================================================
-- Campaign Recipients (customers to request reviews from)
-- ============================================================================
CREATE TABLE campaign_recipients (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  status TEXT DEFAULT 'pending',                 -- pending, sent, delivered, clicked, submitted, failed
  sent_at TEXT,
  delivered_at TEXT,
  clicked_at TEXT,
  submitted_at TEXT,
  error_message TEXT,
  external_id TEXT,                              -- Twilio message ID, Resend ID, etc.
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_campaign_recipients_campaign_id ON campaign_recipients (campaign_id);
CREATE INDEX idx_campaign_recipients_organization_id ON campaign_recipients (organization_id);
CREATE INDEX idx_campaign_recipients_status ON campaign_recipients (status);

-- ============================================================================
-- Response Templates
-- ============================================================================
CREATE TABLE response_templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  is_default INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_response_templates_organization_id ON response_templates (organization_id);

-- ============================================================================
-- Webhook Logs (for debugging)
-- ============================================================================
CREATE TABLE webhook_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  source TEXT NOT NULL,                          -- clerk, google, stripe, twilio, resend
  event_type TEXT,
  payload TEXT,                                  -- JSON as TEXT
  status TEXT DEFAULT 'received',                -- received, processed, failed
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_webhook_logs_organization_id ON webhook_logs (organization_id);
CREATE INDEX idx_webhook_logs_source ON webhook_logs (source);
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs (created_at);

-- ============================================================================
-- QR Codes (generated per campaign/location)
-- ============================================================================
CREATE TABLE qr_codes (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  qr_data_url TEXT NOT NULL,                     -- Base64 PNG data URL
  target_url TEXT NOT NULL,                      -- Review URL with tracking params
  scan_count INTEGER DEFAULT 0,
  last_scanned_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_qr_codes_campaign_id ON qr_codes (campaign_id);
CREATE INDEX idx_qr_codes_organization_id ON qr_codes (organization_id);

-- ============================================================================
-- Subscription/Usage Tracking (for billing limits)
-- ============================================================================
CREATE TABLE usage_records (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,                          -- reviews_synced, requests_sent, qr_generated, api_calls
  count INTEGER DEFAULT 1,
  period_start TEXT NOT NULL,                    -- ISO 8601 (month start)
  period_end TEXT NOT NULL,                      -- ISO 8601 (month end)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(organization_id, metric, period_start)
);

CREATE INDEX idx_usage_records_organization_id ON usage_records (organization_id);
CREATE INDEX idx_usage_records_period ON usage_records (period_start, period_end);