# Rollback Vercel Deployment

## Symptom
Production frontend deployment has critical bug or regression.

## Diagnosis
1. Check Vercel dashboard for deployment status
2. Review error logs in Sentry
3. Confirm issue is frontend-related (not API)

## Fix
### Option 1: Vercel Dashboard (Recommended)
1. Go to Vercel Dashboard → Project → Deployments
2. Find last working deployment
3. Click "..." → "Promote to Production"
4. Verify at https://your-domain.com

### Option 2: CLI
```bash
# List deployments
vercel list <project-name>

# Promote specific deployment
vercel promote <deployment-url> --token=$VERCEL_TOKEN
```

### Option 3: Git Revert + Redeploy
```bash
git revert <bad-commit-sha>
git push origin main
# CI/CD will redeploy
```

## Verification
- [ ] Homepage loads
- [ ] Sign in/up works
- [ ] Dashboard accessible
- [ ] No Sentry errors spike
- [ ] Cloudflare Analytics normal

## Post-Incident
- Create postmortem in `/docs/postmortems/`
- Add regression test
- Update runbook if needed