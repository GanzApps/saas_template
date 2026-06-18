/**
 * D1 Database Client Wrapper
 * Provides type-safe query execution with D1 bindings
 */

import type { D1Database, D1PreparedStatement, D1Result } from '@cloudflare/workers-types';
import type {
  ISODateTime,
  JsonText,
  SqliteBoolean,
  UUID,
  Organization,
  OrganizationInsert,
  OrganizationUpdate,
  User,
  UserInsert,
  UserUpdate,
  GoogleAccount,
  GoogleAccountInsert,
  GoogleAccountUpdate,
  Location,
  LocationInsert,
  LocationUpdate,
  Review,
  ReviewInsert,
  ReviewUpdate,
  Campaign,
  CampaignInsert,
  CampaignUpdate,
  CampaignRecipient,
  CampaignRecipientInsert,
  CampaignRecipientUpdate,
  ResponseTemplate,
  ResponseTemplateInsert,
  ResponseTemplateUpdate,
  WebhookLog,
  WebhookLogInsert,
  QRCode,
  QRCodeInsert,
  QRCodeUpdate,
  UsageRecord,
  UsageRecordInsert,
  UsageRecordUpdate,
  PaginationParams,
  PaginatedResult,
} from './types';

// ============================================================================
// Type Utilities
// ============================================================================

type RowMap = {
  organizations Organization;
  users User;
  google_accounts GoogleAccount;
  locations Location;
  reviews Review;
  campaigns Campaign;
  campaign_recipients CampaignRecipient;
  response_templates ResponseTemplate;
  webhook_logs WebhookLog;
  qr_codes QRCode;
  usage_records UsageRecord;
};

type InsertMap = {
  organizations OrganizationInsert;
  users UserInsert;
  google_accounts GoogleAccountInsert;
  locations LocationInsert;
  reviews ReviewInsert;
  campaigns CampaignInsert;
  campaign_recipients CampaignRecipientInsert;
  response_templates ResponseTemplateInsert;
  webhook_logs WebhookLogInsert;
  qr_codes QRCodeInsert;
  usage_records UsageRecordInsert;
};

type UpdateMap = {
  organizations OrganizationUpdate;
  users UserUpdate;
  google_accounts GoogleAccountUpdate;
  locations LocationUpdate;
  reviews ReviewUpdate;
  campaigns CampaignUpdate;
  campaign_recipients CampaignRecipientUpdate;
  response_templates ResponseTemplateUpdate;
  qr_codes QRCodeUpdate;
  usage_records UsageRecordUpdate;
};

// ============================================================================
// D1 Client Class
// ============================================================================

export class D1Client {
  constructor(private db: D1Database) {}

  // ---- Raw Query Execution ----

  /** Execute a raw query and return all rows */
  async query<T = unknown>(sql: string, bindings: unknown[] = []): Promise<D1Result<T>> {
    const stmt = this.db.prepare(sql);
    return stmt.bind(...bindings).all();
  }

  /** Execute a raw query and return first row */
  async queryFirst<T = unknown>(sql: string, bindings: unknown[] = []): Promise<T | null> {
    const stmt = this.db.prepare(sql);
    const result = await stmt.bind(...bindings).first();
    return result as T | null;
  }

  /** Execute a raw query and run */
  async run(sql: string, bindings: unknown[] = []): Promise<D1Result> {
    const stmt = this.db.prepare(sql);
    return stmt.bind(...bindings).run();
  }

  // ---- Transaction Support ----

  /**
   * Execute multiple statements in a batch (atomic-ish in D1)
   * Note: D1 doesn't support true transactions, but batch executes sequentially
   */
  async batch(statements: { sql: string; bindings?: unknown[] }[]): Promise<D1Result[]> {
    const results: D1Result[] = [];
    for (const { sql, bindings = [] } of statements) {
      results.push(await this.run(sql, bindings));
    }
    return results;
  }

  // ---- CRUD Helpers ----

  /** Generate a UUID v4 */
  static uuid(): UUID {
    // Use crypto.randomUUID() if available, fallback for edge runtime
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback UUID v4 generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /** Current ISO 8601 timestamp */
  static now(): ISODateTime {
    return new Date().toISOString();
  }

  /** Convert boolean to SQLite integer */
  static toBool(val: boolean): SqliteBoolean {
    return val ? 1 : 0;
  }

  /** Convert SQLite integer to boolean */
  static fromBool(val: SqliteBoolean | number | null): boolean {
    return val === 1;
  }

  /** Safe JSON stringify */
  static json(obj: unknown): JsonText {
    return JSON.stringify(obj);
  }

  /** Safe JSON parse */
  static parseJson<T>(json: JsonText | null): T | null {
    if (!json) return null;
    try {
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  }

  // ---- Generic Table Operations ----

  /**
   * Insert a single row
   * Returns the inserted row with generated fields
   */
  async insert<TTable extends keyof InsertMap>(
    table: TTable,
    data: InsertMap[TTable]
  ): Promise<RowMap[TTable]> {
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const bindings = Object.values(data);

    const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.queryFirst<RowMap[TTable]>(sql, bindings);
    return result!;
  }

  /**
   * Find by primary key
   */
  async findById<TTable extends keyof RowMap>(
    table: TTable,
    id: UUID
  ): Promise<RowMap[TTable] | null> {
    const sql = `SELECT * FROM ${table} WHERE id = ?`;
    return this.queryFirst<RowMap[TTable]>(sql, [id]);
  }

  /**
   * Find first matching where clause
   */
  async findFirst<TTable extends keyof RowMap>(
    table: TTable,
    where: string,
    bindings: unknown[] = []
  ): Promise<RowMap[TTable] | null> {
    const sql = `SELECT * FROM ${table} WHERE ${where} LIMIT 1`;
    return this.queryFirst<RowMap[TTable]>(sql, bindings);
  }

  /**
   * Find many with pagination
   */
  async findMany<TTable extends keyof RowMap>(
    table: TTable,
    options: {
      where?: string;
      bindings?: unknown[];
      orderBy?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<RowMap[TTable][]> {
    let sql = `SELECT * FROM ${table}`;
    const bindings = options.bindings || [];

    if (options.where) {
      sql += ` WHERE ${options.where}`;
    }
    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    }
    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
      if (options.offset) {
        sql += ` OFFSET ${options.offset}`;
      }
    }

    const result = await this.query<RowMap[TTable]>(sql, bindings);
    return result.results;
  }

  /**
   * Find many with pagination metadata
   */
  async findPaginated<TTable extends keyof RowMap>(
    table: TTable,
    options: {
      where?: string;
      bindings?: unknown[];
      orderBy?: string;
      pagination: PaginationParams;
    }
  ): Promise<PaginatedResult<RowMap[TTable]>> {
    const { pagination, where, bindings, orderBy } = options;
    const { limit, offset } = pagination;

    // Build base query
    let baseSql = `FROM ${table}`;
    const baseBindings = bindings || [];

    if (where) {
      baseSql += ` WHERE ${where}`;
    }

    // Get total count
    const countResult = await this.queryFirst<{ count: number }>(
      `SELECT COUNT(*) as count ${baseSql}`,
      baseBindings
    );
    const total = countResult?.count || 0;

    // Get items
    let sql = `SELECT * ${baseSql}`;
    if (orderBy) sql += ` ORDER BY ${orderBy}`;
    sql += ` LIMIT ? OFFSET ?`;
    
    const itemResults = await this.query<RowMap[TTable]>(sql, [...baseBindings, limit, offset]);

    return {
      items: itemResults.results,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Update by primary key
   */
  async update<TTable extends keyof RowMap>(
    table: TTable,
    id: UUID,
    data: UpdateMap[TTable]
  ): Promise<RowMap[TTable] | null> {
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (entries.length === 0) {
      return this.findById(table, id);
    }

    const setClause = entries.map(([k]) => `${k} = ?`).join(', ');
    const bindings = [...entries.map(([, v]) => v), id];

    const sql = `UPDATE ${table} SET ${setClause}, updated_at = ? WHERE id = ? RETURNING *`;
    // Add updated_at before id
    const withTimestamp = [...entries.map(([, v]) => v), this.constructor.now(), id];
    
    return this.queryFirst<RowMap[TTable]>(sql, withTimestamp);
  }

  /**
   * Delete by primary key
   */
  async delete(table: keyof RowMap, id: UUID): Promise<boolean> {
    const sql = `DELETE FROM ${table} WHERE id = ?`;
    const result = await this.run(sql, [id]);
    return (result.changes ?? 0) > 0;
  }

  /**
   * Soft delete (if table has deleted_at)
   * Not implemented for current schema - use hard delete
   */

  // ---- Organization-Specific Queries ----

  async getOrganizationByClerkId(clerkOrgId: string): Promise<Organization | null> {
    return this.findFirst('organizations', 'clerk_org_id = ?', [clerkOrgId]);
  }

  async getOrganizationWithStats(orgId: UUID): Promise<{
    org: Organization | null;
    locationCount: number;
    reviewCount: number;
    userCount: number;
  } | null> {
    const org = await this.findById('organizations', orgId);
    if (!org) return null;

    const [locations, reviews, users] = await Promise.all([
      this.queryFirst<{ count: number }>('SELECT COUNT(*) as count FROM locations WHERE organization_id = ?', [orgId]),
      this.queryFirst<{ count: number }>('SELECT COUNT(*) as count FROM reviews WHERE organization_id = ?', [orgId]),
      this.queryFirst<{ count: number }>('SELECT COUNT(*) as count FROM users WHERE organization_id = ?', [orgId]),
    ]);

    return {
      org,
      locationCount: locations?.count || 0,
      reviewCount: reviews?.count || 0,
      userCount: users?.count || 0,
    };
  }

  // ---- User-Specific Queries ----

  async getUserByClerkId(clerkId: string): Promise<User | null> {
    return this.findFirst('users', 'clerk_id = ?', [clerkId]);
  }

  async getUsersByOrganization(orgId: UUID): Promise<User[]> {
    return this.findMany('users', {
      where: 'organization_id = ?',
      bindings: [orgId],
      orderBy: 'created_at ASC',
    });
  }

  async getUserWithOrganization(clerkId: string): Promise<(User & { organization: Organization | null }) | null> {
    const user = await this.getUserByClerkId(clerkId);
    if (!user || !user.organization_id) return user ? { ...user, organization: null } : null;
    
    const org = await this.findById('organizations', user.organization_id);
    return { ...user, organization: org };
  }

  // ---- Location-Specific Queries ----

  async getLocationsByOrganization(orgId: UUID, activeOnly = true): Promise<Location[]> {
    const where = activeOnly 
      ? 'organization_id = ? AND is_active = 1' 
      : 'organization_id = ?';
    return this.findMany('locations', {
      where,
      bindings: [orgId],
      orderBy: 'name ASC',
    });
  }

  async getLocationWithReviewStats(locationId: UUID): Promise<{
    location: Location | null;
    reviewCount: number;
    averageRating: number;
  } | null> {
    const location = await this.findById('locations', locationId);
    if (!location) return null;

    const stats = await this.queryFirst<{ count: number; avg: number }>(
      `SELECT COUNT(*) as count, AVG(star_rating) as avg FROM reviews WHERE location_id = ?`,
      [locationId]
    );

    return {
      location,
      reviewCount: stats?.count || 0,
      averageRating: stats?.avg || 0,
    };
  }

  // ---- Review-Specific Queries ----

  async getReviewsByOrganization(
    orgId: UUID,
    filters: {
      location_id?: UUID;
      status?: Review['status'];
      star_rating?: number;
      assigned_to?: UUID;
      date_from?: ISODateTime;
      date_to?: ISODateTime;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Review[]> {
    const conditions = ['organization_id = ?'];
    const bindings: unknown[] = [orgId];

    if (filters.location_id) {
      conditions.push('location_id = ?');
      bindings.push(filters.location_id);
    }
    if (filters.status) {
      conditions.push('status = ?');
      bindings.push(filters.status);
    }
    if (filters.star_rating) {
      conditions.push('star_rating = ?');
      bindings.push(filters.star_rating);
    }
    if (filters.assigned_to) {
      conditions.push('assigned_to = ?');
      bindings.push(filters.assigned_to);
    }
    if (filters.date_from) {
      conditions.push('review_time >= ?');
      bindings.push(filters.date_from);
    }
    if (filters.date_to) {
      conditions.push('review_time <= ?');
      bindings.push(filters.date_to);
    }

    return this.findMany('reviews', {
      where: conditions.join(' AND '),
      bindings,
      orderBy: 'review_time DESC',
      limit: filters.limit,
      offset: filters.offset,
    });
  }

  async getReviewWithLocation(reviewId: UUID): Promise<{
    review: Review | null;
    location: Location | null;
  } | null> {
    const review = await this.findById('reviews', reviewId);
    if (!review) return null;

    const location = await this.findById('locations', review.location_id);
    return { review, location };
  }

  async incrementReviewReplyCount(reviewId: UUID): Promise<void> {
    await this.run(
      `UPDATE reviews SET has_reply = 1, is_replied_by_us = 1, updated_at = ? WHERE id = ?`,
      [D1Client.now(), reviewId]
    );
  }

  // ---- Campaign-Specific Queries ----

  async getCampaignsByOrganization(orgId: UUID, activeOnly = true): Promise<Campaign[]> {
    const where = activeOnly 
      ? 'organization_id = ? AND is_active = 1' 
      : 'organization_id = ?';
    return this.findMany('campaigns', {
      where,
      bindings: [orgId],
      orderBy: 'created_at DESC',
    });
  }

  async getCampaignWithRecipients(campaignId: UUID): Promise<{
    campaign: Campaign | null;
    recipients: CampaignRecipient[];
  } | null> {
    const campaign = await this.findById('campaigns', campaignId);
    if (!campaign) return null;

    const recipients = await this.findMany('campaign_recipients', {
      where: 'campaign_id = ?',
      bindings: [campaignId],
      orderBy: 'created_at ASC',
    });

    return { campaign, recipients };
  }

  // ---- Response Template Queries ----

  async getTemplatesByOrganization(orgId: UUID, category?: string): Promise<ResponseTemplate[]> {
    const conditions = ['organization_id = ?'];
    const bindings: unknown[] = [orgId];

    if (category) {
      conditions.push('category = ?');
      bindings.push(category);
    }

    return this.findMany('response_templates', {
      where: conditions.join(' AND '),
      bindings,
      orderBy: 'usage_count DESC, created_at DESC',
    });
  }

  async incrementTemplateUsage(templateId: UUID): Promise<void> {
    await this.run(
      `UPDATE response_templates SET usage_count = usage_count + 1, updated_at = ? WHERE id = ?`,
      [D1Client.now(), templateId]
    );
  }

  // ---- Analytics Queries ----

  async getReviewStatsByOrganization(
    orgId: UUID,
    dateFrom: ISODateTime,
    dateTo: ISODateTime
  ): Promise<{
    totalReviews: number;
    averageRating: number;
    repliedCount: number;
    byRating: Record<number, number>;
    byStatus: Record<string, number>;
  }> {
    const baseWhere = 'organization_id = ? AND review_time >= ? AND review_time <= ?';
    const baseBindings = [orgId, dateFrom, dateTo];

    const [total, avg, replied, byRating, byStatus] = await Promise.all([
      this.queryFirst<{ count: number }>(
        `SELECT COUNT(*) as count FROM reviews WHERE ${baseWhere}`,
        baseBindings
      ),
      this.queryFirst<{ avg: number }>(
        `SELECT AVG(star_rating) as avg FROM reviews WHERE ${baseWhere}`,
        baseBindings
      ),
      this.queryFirst<{ count: number }>(
        `SELECT COUNT(*) as count FROM reviews WHERE ${baseWhere} AND has_reply = 1`,
        baseBindings
      ),
      this.query<{ star_rating: number; count: number }>(
        `SELECT star_rating, COUNT(*) as count FROM reviews WHERE ${baseWhere} GROUP BY star_rating`,
        baseBindings
      ),
      this.query<{ status: string; count: number }>(
        `SELECT status, COUNT(*) as count FROM reviews WHERE ${baseWhere} GROUP BY status`,
        baseBindings
      ),
    ]);

    return {
      totalReviews: total?.count || 0,
      averageRating: avg?.avg || 0,
      repliedCount: replied?.count || 0,
      byRating: Object.fromEntries(byRating.results.map(r => [r.star_rating, r.count])),
      byStatus: Object.fromEntries(byStatus.results.map(r => [r.status, r.count])),
    };
  }

  // ---- Usage Tracking ----

  async incrementUsage(
    orgId: UUID,
    metric: UsageRecord['metric'],
    periodStart: ISODateTime,
    periodEnd: ISODateTime,
    count = 1
  ): Promise<void> {
    await this.run(
      `INSERT INTO usage_records (id, organization_id, metric, count, period_start, period_end, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(organization_id, metric, period_start) 
       DO UPDATE SET count = count + ?, updated_at = ?`,
      [D1Client.uuid(), orgId, metric, count, periodStart, periodEnd, D1Client.now(), D1Client.now(), count, D1Client.now()]
    );
  }

  async getUsageByOrganization(
    orgId: UUID,
    periodStart: ISODateTime,
    periodEnd: ISODateTime
  ): Promise<UsageRecord[]> {
    return this.findMany('usage_records', {
      where: 'organization_id = ? AND period_start >= ? AND period_end <= ?',
      bindings: [orgId, periodStart, periodEnd],
      orderBy: 'metric ASC',
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createD1Client(db: D1Database): D1Client {
  return new D1Client(db);
}