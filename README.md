# EduCore

White-label, multi-tenant, feature-toggled academy platform. First client: CloudCadre.
**Start here:** [PROGRESS.md](PROGRESS.md) (what is built, what is next), then [plan/HANDOFF.md](plan/HANDOFF.md) and [plan/README.md](plan/README.md).

```
apps/academy     multi-tenant academy site (host → tenant → theme)        http://demo.localhost:3000
apps/console     distributor console: license keys, redeem flow, academies http://localhost:3001
packages/db      Supabase migrations, DB tests, catalog generator
packages/{tenancy,auth,features,permissions,ui,core,themes/default,config}
plan/            the planning package (13 docs + original SQL)
```

## Run it

Needs **Node 22+**, pnpm 10 (`corepack enable`), and podman for the local Supabase stack. The full recipe (database, mail sink, env, e2e) is in [PROGRESS.md](PROGRESS.md#run-the-whole-stack-locally).

```bash
pnpm install
pnpm dev:academy        # http://demo.localhost:3000 works with no database (fixture tenant) when SUPABASE_URL is unset
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm db:start           # local Supabase; pnpm e2e runs the browser tests against it
```
