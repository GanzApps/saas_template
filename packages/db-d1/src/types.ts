/**
 * ReviewFlow D1 Database Types
 * Generated from D1 migration schema
 * Keep in sync with packages/db/d1/migrations/0001_initial_schema.sql
 */

// ============================================================================
// Base Types
// ============================================================================

/** ISO 8601 datetime string */
export type ISODateTime = string;

/** JSON stored as TEXT in SQLite */
export type JsonText = string;

/** SQLite boolean (0/1) */
export type SqliteBoolean = 0 | 1;

/** UUID v4 string */
export type UUID = string;

/**
 * Organization (business/agency account)
 */
export interface Organization {
  id: UUID;
  name: string;
  clerk_org_id: string | null;
  stripe_customer_id: string | null;
  subscription_status: string | null;
  subscription_tier: string | null;
  settings: JsonText;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface OrganizationInsert {
  id: UUID;
  name: string;
  clerk_org_id?: string | null;
  stripe_customer_id?: string | null;
  subscription_status?: string | null;
  subscription_tier?: string | null;
  settings?: JsonText;
  created_at?: ISODateTime;
  updated_at?: ISODateTime;
}

export interface OrganizationUpdate {
  name?: string;
  clerk_org_id?: string | null;
  stripe_customer_id?: string | null;
  subscription_status?: string | null;
  subscription_tier?: string | null;
  settings?: JsonText;
  updated_at?: ISODateTime;
}

/**
 * User (synced from Clerk)
 */
export interface User {
  id: UUID;
  clerk_id: string;
  organization_id: UUID | null;
  email: string | null;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  raw_json: JsonText | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface UserInsert {
  id: UUID;
  clerk_id: string;
  organization_id?: UUID | null;
  email?: string | null;
  role?: 'owner' | 'admin' | 'member' | 'viewer';
  raw_json?: JsonText | null;
  created_at?: ISODateTime;
  updated_at?: ISODateTime;
}

export interface UserUpdate {
  organization_id?: UUID | null;
  email?: string | null;
  role?: 'owner' | 'admin' | 'member' | 'viewer';
  raw_json?: JsonText | null;
  updated_at?: ISODateTime;
}

/**
 * Google Business Account
 */
export interface GoogleAccount {
  id: UUID;
  organization_id: UUID;
  google_account_email: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: ISODateTime;
  account_name: string | null;
  account_type: string | null;
  is_active: SqliteBoolean;
  last_sync_at: ISODateTime | null;
  sync_error: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface GoogleAccountInsert {
  id: UUID;
  organization_id: UUID;
  google_account_email: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: ISODateTime;
  account_name?: string | null;
  account_type?: string | null;
  is_active?: SqliteBoolean;
  last_sync_at?: ISODateTime | null;
  sync_error?: string | null;
  created_at?: ISODateTime;
  updated_at?: ISODateTime;
}

export interface GoogleAccountUpdate {
  google_account_email?: string;
  access_token_encrypted?: string;
  refresh_token_encrypted?: string;
  token_expires_at?: ISODateTime;
  account_name?: string | null;
  account_type?: string | null;
  is_active?: SqliteBoolean;
  last_sync_at?: ISODateTime | null;
  sync_error?: string | null;
  updated_at?: ISODateTime;
}

/**
 * Location (Google Business Profile location)
 */
export interface Location {
  id: UUID;
  google_account_id: UUID;
  organization_id: UUID;
  google_location_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  primary_category: string | null;
  place_id: string | null;
  maps_uri: string | null;
  is_active: SqliteBoolean;
  review_count: number;
  average_rating: number;
  last_review_sync_at: ISODateTime | null;
  settings: JsonText;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface LocationInsert {
  id: UUID;
  google_account_id: UUID;
  organization_id: UUID;
  google_location_id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  primary_category?: string | null;
  place_id?: string | null;
  maps_uri?: string | null;
  is_active?: SqliteBoolean;
  review_count?: number;
  average_rating?: number;
  last_review_sync_at?: ISODateTime | null;
  settings?: JsonText;
  created_at?: ISODateTime;
  updated_at?: ISODateTime;
}

export interface LocationUpdate {
  google_account_id?: UUID;
  name?: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  primary_category?: string | null;
  place_id?: string | null;
  maps_uri?: string | null;
  is_active?: SqliteBoolean;
  review_count?: number;
  average_rating?: number;
  last_review_sync_at?: ISODateTime | null;
  settings?: JsonText;
  updated_at?: ISODateTime;
}

/**
 * Review
 */
export interface Review {
  id: UUID;
  location_id: UUID;
  organization_id: UUID;
  google_review_id: string;
  google_reviewer_id: string | null;
  reviewer_name: string | null;
  reviewer_profile_photo: string | null;
  star_rating: number;
  comment: string | null;
  review_time: ISODateTime;
  reply_text: string | null;
  reply_time: ISODateTime | null;
  reply_author: string | null;
  has_reply: SqliteBoolean;
  is_replied_by_us: SqliteBoolean;
  internal_notes: string | null;
  assigned_to: UUID | null;
  status: 'new' | 'replied' | 'resolved' | 'flagged';
  raw_json: JsonText | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface ReviewInsert {
  id: UUID;
  location_id: UUID;
  organization_id: UUID;
  google_review_id: string;
  google_reviewer_id?: string | null;
  reviewer_name?: string | null;
  reviewer_profile_photo?: string | null;
  star_rating: number;
  comment?: string | null;
  review_time: ISODateTime;
  reply_text?: string | null;
  reply_time?: ISODateTime | null;
  reply_author?: string | null;
  has_reply?: SqliteBoolean;
  is_replied_by_us?: SqliteBoolean;
  internal_notes?: string | null;
  assigned_to?: UUID | null;
  status?: 'new' | 'replied' | 'resolved' | 'flagged';
  raw_json?: JsonText | null;
  created_at?: ISODateTime;
  updated_at?: ISODateTime;
}

export interface ReviewUpdate {
  google_reviewer_id?: string | null;
  reviewer_name?: string | null;
  reviewer_profile_photo?: string | null;
  star_rating?: number;
  comment?: string | null;
  review_time?: ISODateTime;
  reply_text?: string | null;
  reply_time?: ISODateTime | null;
  reply_author?: string | null;
  has_reply?: SqliteBoolean;
  is_replied_by_us?: SqliteBoolean;
  internal_notes?: string | null;
  assigned_to?: UUID | null;
  status?: 'new' | 'replied' | 'resolved' | 'flagged';
  raw_json?: JsonText | null;
  updated_at?: ISODateTime;
}

/**
 * Campaign
 */
export interface Campaign {
  id: UUID;
  organization_id: UUID;
  location_id: UUID | null;
  name: string;
  type: 'sms' | 'email' | 'qr' | 'link';
  template_sms: string | null;
  template_email_subject: string | null;
  template_email_body: string | null;
  trigger_type: 'manual' | 'automatic' | 'scheduled';
  is_active: SqliteBoolean;
  settings: JsonText;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface CampaignInsert {
  id: UUID;
  organization_id: UUID;
  location_id?: UUID | null;
  name: string;
  type: 'sms' | 'email' | 'qr' | 'link';
  template_sms?: string | null;
  template_email_subject?: string | null;
  template_email_body?: string | null;
  trigger_type?: 'manual' | 'automatic' | 'scheduled';
  is_active?: SqliteBoolean;
  settings?: JsonText;
  created_at?: ISODateTime;
  updated_at?: ISODateTime;
}

export interface CampaignUpdate {
  location_id?: UUID | null;
  name?: string;
  type?: 'sms' | 'email' | 'qr' | 'link';
  template_sms?: string | null;
  template_email_subject?: string | null;
  template_email_body?: string | null;
  trigger_type?: 'manual' | 'automatic' | 'scheduled';
  is_active?: SqliteBoolean;
  settings?: JsonText;
  updated_at?: ISODateTime;
}

/**
 * Campaign Recipient
 */
export interface CampaignRecipient {
  id: UUID;
  campaign_id: UUID;
  organization_id: UUID;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  status: 'pending' | 'sent' | 'delivered' | 'clicked' | 'submitted' | 'failed';
  sent_at: ISODateTime | null;
  delivered_at: ISODateTime | null;
  clicked_at: ISODateTime | null;
  submitted_at: ISODateTime | null;
  error_message: string | null;
  external_id: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface CampaignRecipientInsert {
  id: UUID;
  campaign_id: UUID;
  organization_id: UUID;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  status?: 'pending' | 'sent' | 'delivered' | 'clicked' | 'submitted' | 'failed';
  sent_at?: ISODateTime | null;
  delivered_at?: ISODateTime | null;
  clicked_at?: ISODateTime | null;
  submitted_at?: ISODateTime | null;
  error_message?: string | null;
  external_id?: string | null;
  created_at?: ISODateTime;
  updated_at?: ISODateTime;
}

export interface CampaignRecipientUpdate {
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  status?: 'pending' | 'sent' | 'delivered' | 'clicked' | 'submitted' | 'failed';
  sent_at?: ISODateTime | null;
  delivered_at?: ISODateTime | null;
  clicked_at?: ISODateTime | null;
  submitted_at?: ISODateTime | null;
  error_message?: string | null;
  external_id?: string | null;
  updated_at?: ISODateTime;
}

/**
 * Response Template
 */
export interface ResponseTemplate {
  id: UUID;
  organization_id: UUID;
  name: string;
  content: string;
  category: string | null;
  is_default: SqliteBoolean;
  usage_count: number;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface ResponseTemplateInsert {
  id: UUID;
  organization_id: UUID;
  name: string;
  content: string;
  category?: string | null;
  is_default?: SqliteBoolean;
  usage_count?: number;
  created_at?: ISODateTime;
  updated_at?: ISODateTime;
}

export interface ResponseTemplateUpdate {
  name?: string;
  content?: string;
  category?: string | null;
  is_default?: SqliteBoolean;
  usage_count?: number;
  updated_at?: ISODateTime;
}

/**
 * Webhook Log
 */
export interface WebhookLog {
  id: UUID;
  organization_id: UUID | null;
  source: 'clerk' | 'google' | 'stripe' | 'twilio' | 'resend' | string;
  event_type: string | null;
  payload: JsonText;
  status: 'received' | 'processed' | 'failed';
  error_message: string | null;
  created_at: ISODateTime;
}

export interface WebhookLogInsert {
  id: UUID;
  organization_id?: UUID | null;
  source: string;
  event_type?: string | null;
  payload: JsonText;
  status?: 'received' | 'processed' | 'failed';
  error_message?: string | null;
  created_at?: ISODateTime;
}

/**
 * QR Code
 */
export interface QRCode {
  id: UUID;
  campaign_id: UUID;
  organization_id: UUID;
  location_id: UUID | null;
  qr_data_url: string;
  target_url: string;
  scan_count: number;
  last_scanned_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface QRCodeInsert {
  id: UUID;
  campaign_id: UUID;
  organization_id: UUID;
  location_id?: UUID | null;
  qr_data_url: string;
  target_url: string;
  scan_count?: number;
  last_scanned_at?: ISODateTime | null;
  created_at?: ISODateTime;
  updated_at?: ISODateTime;
}

export interface QRCodeUpdate {
  qr_data_url?: string;
  target_url?: string;
  scan_count?: number;
  last_scanned_at?: ISODateTime | null;
  updated_at?: ISODateTime;
}

/**
 * Usage Record (for billing/limits)
 */
export interface UsageRecord {
  id: UUID;
  organization_id: UUID;
  metric: 'reviews_synced' | 'requests_sent' | 'qr_generated' | 'api_calls' | string;
  count: number;
  period_start: ISODateTime;
  period_end: ISODateTime;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface UsageRecordInsert {
  id: UUID;
  organization_id: UUID;
  metric: string;
  count?: number;
  period_start: ISODateTime;
  period_end: ISODateTime;
  created_at?: ISODateTime;
  updated_at?: ISODateTime;
}

export interface UsageRecordUpdate {
  count?: number;
  updated_at?: ISODateTime;
}

// ============================================================================
// Query Result Types (for returning from database)
// ============================================================================

export type OrganizationRow = Organization;
export type UserRow = User;
export type GoogleAccountRow = GoogleAccount;
export type LocationRow = Location;
export type ReviewRow = Review;
export type CampaignRow = Campaign;
export type CampaignRecipientRow = CampaignRecipient;
export type ResponseTemplateRow = ResponseTemplate;
export type WebhookLogRow = WebhookLog;
export type QRCodeRow = QRCode;
export type UsageRecordRow = UsageRecord;

// ============================================================================
// Pagination
// ============================================================================

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ============================================================================
// Filter Types (for query builders)
// ============================================================================

export interface OrganizationFilters {
  clerk_org_id?: string;
  subscription_status?: string;
  subscription_tier?: string;
}

export interface UserFilters {
  clerk_id?: string;
  organization_id?: UUID;
  role?: User['role'];
}

export interface GoogleAccountFilters {
  organization_id: UUID;
  is_active?: SqliteBoolean;
}

export interface LocationFilters {
  organization_id: UUID;
  google_account_id?: UUID;
  is_active?: SqliteBoolean;
}

export interface ReviewFilters {
  organization_id: UUID;
  location_id?: UUID;
  status?: Review['status'];
  star_rating?: number;
  assigned_to?: UUID;
  date_from?: ISODateTime;
  date_to?: ISODateTime;
}

export interface CampaignFilters {
  organization_id: UUID;
  location_id?: UUID;
  is_active?: SqliteBoolean;
  type?: Campaign['type'];
}

export interface CampaignRecipientFilters {
  campaign_id?: UUID;
  organization_id: UUID;
  status?: CampaignRecipient['status'];
}

export interface ResponseTemplateFilters {
  organization_id: UUID;
  category?: string;
  is_default?: SqliteBoolean;
}

export interface WebhookLogFilters {
  organization_id?: UUID;
  source?: WebhookLog['source'];
  status?: WebhookLog['status'];
  date_from?: ISODateTime;
  date_to?: ISODateTime;
}

export interface QRCodeFilters {
  campaign_id?: UUID;
  organization_id: UUID;
}

export interface UsageRecordFilters {
  organization_id: UUID;
  metric?: UsageRecord['metric'];
  period_start?: ISODateTime;
  period_end?: ISODateTime;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isOrganization(obj: unknown): obj is Organization {
  return typeof obj === 'object' && obj !== null && 'id' in obj && 'name' in obj;
}

export function isUser(obj: unknown): obj is User {
  return typeof obj === 'object' && obj !== null && 'clerk_id' in obj;
}

export function isLocation(obj: unknown): obj is Location {
  return typeof obj === 'object' && obj !== null && 'google_location_id' in obj;
}

export function isReview(obj: unknown): obj is Review {
  return typeof obj === 'object' && obj !== null && 'google_review_id' in obj;
}

export function isCampaign(obj: unknown): obj is Campaign {
  return typeof obj === 'object' && obj !== null && 'type' in obj;
}

// ============================================================================
// JSON Helpers
// ============================================================================

export function parseJson<T>(json: JsonText | null): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function stringifyJson(obj: unknown): JsonText {
  return JSON.stringify(obj);
}