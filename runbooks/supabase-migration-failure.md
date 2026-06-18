# Supabase Migration Failure

## Symptom
`db-migrate.yml` workflow fails or manual `supabase db push` fails.

## Common Causes
1. **Breaking schema change** (dropping column, changing type)
2. **RLS policy conflict** (circular references, missing grants)
3. **Migration dependency issue** (out of order)
4. **Supabase service degradation**

## Diagnosis
```bash
# Check migration status
supabase migration list --linked

# View failed migration SQL
supabase migration show <migration-name>

# Check database logs
supabase logs --linked --level error
```

## Fix

### Case 1: Breaking Change (Column Drop/Type Change)
1. **Do NOT force push** - data loss risk
2. Create **new migration** with safe transition:
   ```sql
   -- Add new column
   ALTER TABLE public.users ADD COLUMN new_email TEXT;
   
   -- Backfill
   UPDATE public.users SET new_email = email;
   
   -- Verify
   SELECT * FROM public.users WHERE new_email IS NULL;
   
   -- Swap (in next migration)
   ALTER TABLE public.users DROP COLUMN email;
   ALTER TABLE public.users RENAME COLUMN new_email TO email;
   ```

### Case 2: RLS Policy Conflict
```sql
-- Check existing policies
SELECT * FROM pg_policies WHERE tablename = 'your_table';

-- Drop conflicting policy
DROP POLICY IF EXISTS "conflicting_policy" ON public.your_table;

-- Recreate with correct logic
CREATE POLICY "correct_policy" ON public.your_table
  FOR SELECT USING (user_id = auth.uid());
```

### Case 3: Migration Order Issue
```bash
# Reset local DB and reapply
supabase db reset

# If production, manual intervention needed:
# 1. Connect to production DB
# 2. Manually fix schema
# 3. Mark migration as applied in supabase_migrations.schema_migrations
```

## Verification
- [ ] `supabase db push` succeeds locally
- [ ] `supabase db push --linked` succeeds (staging)
- [ ] All RLS policies work (test with different users)
- [ ] Generated types update correctly (`pnpm db:types`)

## Emergency: Production Down
1. Enable maintenance mode (Cloudflare Worker → return 503)
2. Restore from Supabase PITR (Point-in-Time Recovery)
3. Coordinate with team before any manual SQL

## Post-Incident
- Create postmortem
- Review migration review process
- Add migration linting to CI