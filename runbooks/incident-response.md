# Incident Response

## Severity Levels

| Level | Definition | Response Time | Examples |
|-------|------------|---------------|----------|
| **SEV-1** | Customer-facing outage, data loss, security breach | < 15 min | API 5xx > 5%, Auth down, DB unavailable |
| **SEV-2** | Degraded performance, partial functionality loss | < 1 hour | Slow queries, feature broken for subset |
| **SEV-3** | Minor bug, non-critical feature broken | < 4 hours | UI glitch, non-core feature |

## Response Process

### 1. Acknowledge (All SEV)
- [ ] Post in `#incidents` Discord/Slack: "🚨 SEV-X: <title>"
- [ ] Assign Incident Commander (IC)
- [ ] Start timeline document

### 2. Assess (SEV-1/2)
- [ ] Check dashboards: Vercel, Cloudflare, Supabase, Sentry
- [ ] Identifyblast radius
- [ ] Determine if rollback needed

### 3. Mitigate
- [ ] Apply quickest fix (rollback, feature flag, config change)
- [ ] Communicate status every 15 min (SEV-1) / 30 min (SEV-2)

### 4. Resolve
- [ ] Root cause fix deployed
- [ ] Verify fix works
- [ ] Close incident: "✅ RESOLVED: <title>"

### 5. Postmortem (SEV-1/2, within 48h)
- [ ] Create `/docs/postmortems/YYYY-MM-DD-title.md`
- [ ] Include: timeline, root cause, impact, action items
- [ ] Share with team, assign action item owners

## Communication Templates

### Initial Alert
```
🚨 SEV-X: <Brief title>
Status: Investigating
Impact: <User-facing impact>
IC: @username
Started: <timestamp>
```

### Status Update
```
🔄 SEV-X Update: <title>
Status: <Investigating/Mitigating/Resolved>
Progress: <What we know, what we're doing>
Next update: <timestamp>
```

### Resolution
```
✅ SEV-X RESOLVED: <title>
Root cause: <one sentence>
Fix: <what was deployed>
Postmortem: <link>
```

## Key Contacts
- **On-call**: @username (Discord/Slack)
- **Vercel**: Support dashboard
- **Cloudflare**: Support dashboard
- **Supabase**: Support dashboard
- **Clerk**: Support dashboard

## Runbook Links
- [Rollback Vercel](./rollback-vercel.md)
- [Rollback Cloudflare](./rollback-cloudflare.md)
- [Supabase Migration Failure](./supabase-migration-failure.md)