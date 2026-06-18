/**
 * D1 Database Client for FileVault
 * Generic CRUD + FileVault-specific helpers (org-scoped).
 */

import type { D1Database, D1Result } from '@cloudflare/workers-types'
import type {
  CursorPage,
  EpochMs,
  InsertMap,
  Membership,
  Organization,
  Role,
  RowMap,
  Share,
  UpdateMap,
  UploadToken,
  UUID,
} from './types'

export class D1Client {
  constructor(private db: D1Database) {}

  // ---- Utilities ----

  static uuid(): UUID {
    return crypto.randomUUID()
  }

  static now(): EpochMs {
    return Date.now()
  }

  // ---- Raw query ----

  async query<T = unknown>(sql: string, bindings: unknown[] = []): Promise<D1Result<T>> {
    return this.db.prepare(sql).bind(...bindings).all<T>()
  }

  async queryFirst<T = unknown>(sql: string, bindings: unknown[] = []): Promise<T | null> {
    return (await this.db.prepare(sql).bind(...bindings).first<T>()) ?? null
  }

  async run(sql: string, bindings: unknown[] = []): Promise<D1Result> {
    return this.db.prepare(sql).bind(...bindings).run()
  }

  // ---- Generic CRUD ----

  async insert<TTable extends keyof InsertMap>(
    table: TTable,
    data: InsertMap[TTable],
  ): Promise<RowMap[TTable]> {
    const cols = Object.keys(data)
    const placeholders = cols.map(() => '?').join(', ')
    const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`
    const row = await this.queryFirst<RowMap[TTable]>(sql, Object.values(data))
    if (!row) throw new Error(`Insert into ${table} returned no row`)
    return row
  }

  async findById<TTable extends keyof RowMap>(
    table: TTable,
    id: string,
  ): Promise<RowMap[TTable] | null> {
    return this.queryFirst<RowMap[TTable]>(`SELECT * FROM ${table} WHERE id = ?`, [id])
  }

  async findFirst<TTable extends keyof RowMap>(
    table: TTable,
    where: string,
    bindings: unknown[] = [],
  ): Promise<RowMap[TTable] | null> {
    return this.queryFirst<RowMap[TTable]>(
      `SELECT * FROM ${table} WHERE ${where} LIMIT 1`,
      bindings,
    )
  }

  async findMany<TTable extends keyof RowMap>(
    table: TTable,
    options: {
      where?: string
      bindings?: unknown[]
      orderBy?: string
      limit?: number
      offset?: number
    } = {},
  ): Promise<RowMap[TTable][]> {
    let sql = `SELECT * FROM ${table}`
    const bindings = options.bindings ?? []
    if (options.where) sql += ` WHERE ${options.where}`
    if (options.orderBy) sql += ` ORDER BY ${options.orderBy}`
    if (options.limit) {
      sql += ` LIMIT ${options.limit}`
      if (options.offset) sql += ` OFFSET ${options.offset}`
    }
    return (await this.query<RowMap[TTable]>(sql, bindings)).results
  }

  async update<TTable extends keyof UpdateMap>(
    table: TTable,
    where: string,
    data: UpdateMap[TTable],
    bindings: unknown[],
  ): Promise<RowMap[TTable] | null> {
    const entries = Object.entries(data as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    )
    if (!entries.length) return null
    const setClause = entries.map(([k]) => `${k} = ?`).join(', ')
    const sql = `UPDATE ${table} SET ${setClause} WHERE ${where} RETURNING *`
    return this.queryFirst<RowMap[TTable]>(sql, [...entries.map(([, v]) => v), ...bindings])
  }

  async delete(table: keyof RowMap, where: string, bindings: unknown[]): Promise<number> {
    const result = await this.run(`DELETE FROM ${table} WHERE ${where}`, bindings)
    return result.meta?.changes ?? 0
  }

  // ---- Organization helpers ----

  async getOrganization(orgId: UUID): Promise<Organization | null> {
    return this.findById('organizations', orgId)
  }

  async getOrganizationByClerkId(clerkOrgId: string): Promise<Organization | null> {
    return this.findFirst('organizations', 'clerk_org_id = ?', [clerkOrgId])
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    return this.findFirst('organizations', 'slug = ?', [slug])
  }

  async listOrganizationsForUser(userId: string): Promise<Organization[]> {
    const rows = await this.query<{ org: Organization }>(
      `SELECT o.* as org FROM organizations o
       INNER JOIN memberships m ON m.org_id = o.id
       WHERE m.user_id = ?
       ORDER BY o.created_at DESC`,
      [userId],
    )
    return rows.results.map((r) => r.org)
  }

  // ---- Membership helpers ----

  async getMembership(orgId: UUID, userId: string): Promise<Membership | null> {
    return this.findFirst(
      'memberships',
      'org_id = ? AND user_id = ?',
      [orgId, userId],
    )
  }

  async getFirstMembershipForUser(userId: string): Promise<Membership | null> {
    return this.findFirst(
      'memberships',
      'user_id = ?',
      [userId],
    )
  }

  async listMembers(orgId: UUID): Promise<Membership[]> {
    return this.findMany('memberships', {
      where: 'org_id = ?',
      bindings: [orgId],
      orderBy: 'created_at ASC',
    })
  }

  async upsertMembership(
    orgId: UUID,
    userId: string,
    role: Role = 'member',
  ): Promise<Membership> {
    const existing = await this.getMembership(orgId, userId)
    if (existing) {
      if (existing.role !== role) {
        const updated = await this.update(
          'memberships',
          'id = ?',
          { role },
          [existing.id],
        )
        return updated ?? existing
      }
      return existing
    }
    return this.insert('memberships', {
      id: D1Client.uuid(),
      org_id: orgId,
      user_id: userId,
      role,
    })
  }

  // ---- File helpers (org-scoped) ----

  async listFilesByOrg(
    orgId: UUID,
    opts: { limit?: number; cursor?: number } = {},
  ): Promise<CursorPage<RowMap['files']>> {
    const limit = Math.min(opts.limit ?? 50, 200)
    const cursor = opts.cursor ?? Number.MAX_SAFE_INTEGER
    const items = await this.findMany('files', {
      where: 'org_id = ? AND created_at < ?',
      bindings: [orgId, cursor],
      orderBy: 'created_at DESC',
      limit: limit + 1,
    })
    const hasMore = items.length > limit
    const page = hasMore ? items.slice(0, limit) : items
    const nextCursor = hasMore ? String(page[page.length - 1].created_at) : null
    return { items: page, nextCursor }
  }

  async getFileForOrg(orgId: UUID, fileId: UUID): Promise<RowMap['files'] | null> {
    return this.findFirst('files', 'org_id = ? AND id = ?', [orgId, fileId])
  }

  async deleteFileForOrg(orgId: UUID, fileId: UUID): Promise<number> {
    return this.delete('files', 'org_id = ? AND id = ?', [orgId, fileId])
  }

  // ---- Share helpers ----

  async getShareByToken(token: string): Promise<Share | null> {
    return this.findFirst('shares', 'token = ?', [token])
  }

  async listSharesForOrg(orgId: UUID): Promise<Share[]> {
    return this.findMany('shares', {
      where: 'org_id = ?',
      bindings: [orgId],
      orderBy: 'created_at DESC',
    })
  }

  async listSharesForFile(orgId: UUID, fileId: UUID): Promise<Share[]> {
    return this.findMany('shares', {
      where: 'org_id = ? AND file_id = ?',
      bindings: [orgId, fileId],
      orderBy: 'created_at DESC',
    })
  }

  async incrementShareDownloadCount(shareId: UUID): Promise<void> {
    await this.run(
      `UPDATE shares SET download_count = download_count + 1 WHERE id = ?`,
      [shareId],
    )
  }

  // ---- Upload token helpers ----

  async getUploadToken(token: string): Promise<UploadToken | null> {
    return this.findById('upload_tokens', token)
  }

  async consumeUploadToken(token: string): Promise<boolean> {
    const result = await this.run(
      `UPDATE upload_tokens SET consumed = 1 WHERE token = ? AND consumed = 0 AND expires_at > ?`,
      [token, D1Client.now()],
    )
    return (result.meta?.changes ?? 0) > 0
  }

  async pruneExpiredUploadTokens(): Promise<number> {
    return this.delete('upload_tokens', 'expires_at < ?', [D1Client.now()])
  }
}

export function createD1Client(db: D1Database): D1Client {
  return new D1Client(db)
}
