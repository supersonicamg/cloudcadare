# 14. Delivery and hosting model (decided 2026-11-25)

Owner's decision, in their words: *"I create a Supabase project, get the credentials, migrate everything onto it (schema and data), and run the application on my own VPS. The database is fixed: Supabase. No need to test locally against a local Supabase. I will supply the credentials."*

This replaces "pooled data plane on Vercel, local Supabase for everything" as the working assumption. It is the **dedicated data plane** option from [03 §5](03-distribution-and-tenancy.md) and ADR-02, now the default way a client is delivered.

## 1. The model

| Piece | Decision |
|---|---|
| Database, Auth, Storage | **One cloud Supabase project per client**, created by the owner (the distributor), in the owner's Supabase organisation. Mumbai (`ap-south-1`) unless a client needs otherwise. |
| Application | The same Next.js app (frontend and backend in one), one **running instance per client**, configured with that client's Supabase URL and keys. |
| Hosting, early | **Vercel** (frontend and backend together). Fine while there are few or no paying clients. |
| Hosting, once real clients arrive | **Owner's VPS** (KVM 2 or KVM 4 class). Low-usage clients share one VPS (two or three per box); heavier clients get their own. |
| Billing | The owner charges each client for hosting and the Supabase project as part of the service. Each Supabase project is a separate bill, so price it in. |
| Local Supabase | **Not the test path any more.** Develop and test against a cloud **dev** project. The local stack (`pnpm db:start`) stays available only for the SQL tests (`pnpm db:test`) and the old e2e suite, and is optional. |

Nothing in the data model changes: every table still has `tenant_id`, and each client's project simply holds one tenant. Moving a client between projects stays possible for the reason given in 03 §5.

## 2. What a client project needs (checklist, not yet scripted)

1. Create the Supabase project (owner's org, `ap-south-1`). Note the URL, the publishable key and the **secret** key. Never reuse a key across clients.
2. Apply every migration in `packages/db/supabase/migrations/` (`supabase link` then `supabase db push` from `packages/db`). Keep a record of which migration version each client is on; all clients should be brought to the same version together.
3. Create the tenant and its owner (the `control` schema lives in the same project in Phase 1, see doc 02 §"Phase 1"). Today this is done through the console's licence key and `/start` redeem flow, or by hand; **a single provisioning script does not exist yet.**
4. Auth settings in the Supabase dashboard (ADR-13): email provider enabled with **"Confirm email" off** (there is no mail server; sign-up fails with it on), phone and social providers off, minimum password length 8, TOTP MFA enabled for staff, site URL set to the client's domain. All sign-ins reach Supabase from the app server's IP address, so review the sign-in rate limit before launch.
5. Storage buckets are created by the migrations; check they exist.
6. Fill the app's environment (see §3) and deploy.
7. Moving existing data in (a client who already has learners or courses) needs its own import; **not designed yet.**

## 3. Environment per client

The app reads one `SUPABASE_URL` from the process environment, so **one running instance serves one client's project.** Per client:

```
BASE_DOMAIN=<client's domain or the platform's base domain>
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...            # server only, never in the browser
RESEND_API_KEY=...  EMAIL_FROM_ADDRESS=...   # receipts, refunds, certificates
CRON_SECRET=...                    # protects GET /api/cron/outbox
UPSTASH_REDIS_REST_URL / _TOKEN    # only if custom domains are used (untested, see PROGRESS)
```

Do not set `EDUCORE_FAKE_GATEWAY` on a client's server. Full list: `apps/academy/.env.example`.

## 4. Things that behave differently from local

- **Sign-in.** Email and password, so no mail is needed to sign in. There is no self-serve password reset: after checking who is asking, run `node --env-file=<that client's env file> scripts/set-password.mjs <email>` and send them the temporary password. Receipts and certificates are still emails; they need `RESEND_API_KEY`, and without it each attempt is recorded as `email_not_configured`.
- **The e2e suite.** Sign-in now works through the Auth admin API plus the login form, but the receipt checks still read the local mail sink, so the full suite runs against the local stack only. Test cloud projects by hand.
- **Never test against a client's project.** Use one dev project. The tests and manual checks create courses, users and orders.
- **Scheduled mail.** `/api/cron/outbox` must be called every minute or so. On Vercel use a cron job; on a VPS use system cron or a systemd timer (`curl -H "Authorization: Bearer $CRON_SECRET" …`).

## 5. VPS layout (when the time comes)

Build and run settings for Dokploy are in [17](17-deploy-dokploy.md); no server has been set up yet. The intended shape:

- One process per client (Node or a container), each with its own env file, on its own port.
- A reverse proxy (Caddy or nginx) on the VPS maps each client's domain to its port and handles TLS.
- Build once per release, deploy the same build to each client's process; roll clients forward one at a time.
- Backups: Supabase's own backups per project, plus the VPS config in version control. Monitoring and log shipping per client are open.
- Which clients share a box is a capacity call; watch memory first (a Next.js process needs a few hundred MB).

## 6. Open items this creates

1. A **provisioning script** for a new client (steps 2 to 5 above), so a project can be stood up repeatably.
2. A way to **roll a migration out to every client project** and record versions.
3. **Re-working the e2e helper** so tests can run against a cloud dev project, or accepting local-only e2e.
4. **Custom domains on a VPS**: the domain map (Upstash Redis) was designed for Vercel's edge; with one instance per client the map may be unnecessary, since the instance knows its own tenant. To decide.
5. The console (distributor's control plane) assumed one project holding the `control` schema for all tenants. With one project per client, decide whether the console stays a separate project that only provisions and tracks clients, or is dropped for now.
6. Supabase plan limits and cost per client project.
