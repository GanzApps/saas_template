# Rollback Cloudflare Worker

## Symptom
Production API (Cloudflare Workers) has critical bug or regression.

## Diagnosis
1. Check Cloudflare Workers dashboard for deployment status
2. Review error logs in Sentry / Workers Logs
3. Confirm issue is API-related

## Fix
### Option 1: Wrangler Rollback (Fastest)
```bash
# List recent deployments
npx wrangler deployments list --env production

# Rollback to specific version
npx wrangler rollback <deployment-id> --env production
```

### Option 2: Dashboard
1. Go to Cloudflare Dashboard → Workers & Pages → saas-api
2. Click "Deployments" tab
3. Find last working deployment → "Rollback"

### Option 3: Git Revert + Redeploy
```bash
git revert <bad-commit-sha>
git push origin main
# deploy-api.yml workflow redeploys
```

## Verification
- [ ] `GET https://api.yourdomain.com/api/health` returns 200
- [ ] Authenticated requests work (Clerk JWT verified)
- [ ] Supabase queries succeed
- [ ] No Sentry errors spike
- [ ] Cloudflare Workers Analytics normal

## Post-Incident
- Create postmortem in `/docs/postmortems/`
- Add regression test
- Update runbook if needed