/**
 * FileVault D1 Database Types
 * Keep in sync with packages/db-d1/migrations/0001_initial.sql
 */

// Unix epoch milliseconds
export type EpochMs = number;

export type UUID = string;
export type SqliteBoolean = 0 | 1;
export type JsonText = string;

export type Plan = 'free' | 'pro' | 'business';
export type Role = 'owner' | 'admin' | 'member';

// ============================================================================
// organizations
// ============================================================================

export interface Organization {
  id: UUID;
  name: string;
  slug: string;
  clerk_org_id: string | null;
  plan: Plan;
  created_at: EpochMs;
  updated_at: EpochMs;
}

export interface OrganizationInsert {
  id: UUID;
  name: string;
  slug: string;
  clerk_org_id?: string | null;
  plan?: Plan;
  created_at?: EpochMs;
  updated_at?: EpochMs;
}

export interface OrganizationUpdate {
  name?: string;
  slug?: string;
  clerk_org_id?: string | null;
  plan?: Plan;
  updated_at?: EpochMs;
}

// ============================================================================
// memberships
// ============================================================================

export interface Membership {
  id: UUID;
  org_id: UUID;
  user_id: string; // Clerk user id
  role: Role;
  created_at: EpochMs;
}

export interface MembershipInsert {
  id: UUID;
  org_id: UUID;
  user_id: string;
  role?: Role;
  created_at?: EpochMs;
}

export interface MembershipUpdate {
  role?: Role;
}

// ============================================================================
// files
// ============================================================================

export interface FileRow {
  id: UUID;
  org_id: UUID;
  key: string;
  name: string;
  size: number;
  content_type: string;
  uploaded_by: string;
  created_at: EpochMs;
}

export interface FileInsert {
  id: UUID;
  org_id: UUID;
  key: string;
  name: string;
  size: number;
  content_type: string;
  uploaded_by: string;
  created_at?: EpochMs;
}

// ============================================================================
// shares
// ============================================================================

export interface Share {
  id: UUID;
  file_id: UUID;
  org_id: UUID;
  token: string;
  expires_at: EpochMs | null;
  max_downloads: number | null;
  download_count: number;
  created_by: string;
  created_at: EpochMs;
}

export interface ShareInsert {
  id: UUID;
  file_id: UUID;
  org_id: UUID;
  token: string;
  expires_at?: EpochMs | null;
  max_downloads?: number | null;
  download_count?: number;
  created_by: string;
  created_at?: EpochMs;
}

export interface ShareUpdate {
  download_count?: number;
}

// ============================================================================
// upload_tokens
// ============================================================================

export interface UploadToken {
  token: string;
  org_id: UUID;
  user_id: string;
  file_id: UUID;
  key: string;
  content_type: string;
  max_size: number;
  expires_at: EpochMs;
  consumed: SqliteBoolean;
  created_at: EpochMs;
}

export interface UploadTokenInsert {
  token: string;
  org_id: UUID;
  user_id: string;
  file_id: UUID;
  key: string;
  content_type: string;
  max_size: number;
  expires_at: EpochMs;
  consumed?: SqliteBoolean;
  created_at?: EpochMs;
}

// ============================================================================
// Row maps for generic CRUD
// ============================================================================

export type RowMap = {
  organizations: Organization;
  memberships: Membership;
  files: FileRow;
  shares: Share;
  upload_tokens: UploadToken;
};

export type InsertMap = {
  organizations: OrganizationInsert;
  memberships: MembershipInsert;
  files: FileInsert;
  shares: ShareInsert;
  upload_tokens: UploadTokenInsert;
};

export type UpdateMap = {
  organizations: OrganizationUpdate;
  memberships: MembershipUpdate;
  files: Partial<FileRow>;
  shares: ShareUpdate;
  upload_tokens: Partial<UploadToken>;
};

// ============================================================================
// Pagination
// ============================================================================

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
