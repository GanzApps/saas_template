-- FileVault initial schema
-- All timestamps stored as unix epoch milliseconds (INTEGER)

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  clerk_org_id TEXT UNIQUE,
  plan TEXT DEFAULT 'free',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE memberships (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,            -- Clerk user id (user_xxx)
  role TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'admin' | 'member'
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  UNIQUE(org_id, user_id)
);
CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_memberships_org ON memberships(org_id);

CREATE TABLE files (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT UNIQUE NOT NULL,         -- R2 object key: <orgId>/<fileId>/<name>
  name TEXT NOT NULL,               -- display filename
  size INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,        -- Clerk user id
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX idx_files_org_created ON files(org_id, created_at DESC);

CREATE TABLE shares (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER,               -- null = never
  max_downloads INTEGER,            -- null = unlimited
  download_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,         -- Clerk user id
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX idx_shares_file ON shares(file_id);
CREATE INDEX idx_shares_org ON shares(org_id);

-- Short-lived upload tokens (presigned PUT alternative)
-- Issued by /api/files/presign, consumed by /api/upload/:token
CREATE TABLE upload_tokens (
  token TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  file_id TEXT NOT NULL,            -- the file row created up-front
  key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  max_size INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
CREATE INDEX idx_upload_tokens_expires ON upload_tokens(expires_at);
