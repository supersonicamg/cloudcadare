# 17. Deploying on Dokploy

Dokploy is the way to run the VPS layout in [14 §5](14-delivery-and-hosting.md): one Dokploy application per client, each with its own environment and domain. Dokploy's proxy (Traefik) handles TLS. The image comes from the root `Dockerfile`.

## 1. Before the first deploy

1. **Database.** Apply every migration to the client's Supabase project, from `packages/db`:
   `npx supabase link --project-ref <ref>` then `npx supabase db push`.
   Do this again before deploying a release that adds migrations.
2. **Supabase Auth settings:** [14 §2](14-delivery-and-hosting.md), step 4. Set the site URL to the client's domain.
3. **Tenant and owner** exist in that project (14 §2, step 3).
4. **Resend**: an API key and a verified sending domain. Without it **new learners cannot sign up**, because the 6-digit confirmation code is sent by email.

## 2. Application settings

Source: this repository, branch `main`.

**Build Type** tab:

| Field | Value |
|---|---|
| Build Type | `Dockerfile` |
| Docker File | `Dockerfile` |
| Docker Context Path | `.` |
| Docker Build Stage | leave empty |

**Environment** tab (read when the container starts; the build needs none of them):

```
BASE_DOMAIN=example.com
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
RESEND_API_KEY=
EMAIL_FROM_ADDRESS=
CRON_SECRET=
```

- `CRON_SECRET`: any long random string (`openssl rand -hex 32`).
- Only if used: `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY` (signed videos). Full list: `apps/academy/.env.example`.
- **Never set `EDUCORE_FAKE_GATEWAY`** on a client's server.
- Leave `UPSTASH_REDIS_REST_*` unset. When set, only hostnames listed in Redis are served.

**Domains** tab: host `<slug>.<BASE_DOMAIN>`, container port `3000`, HTTPS on (Let's Encrypt). Point the DNS record at the server first.

## 3. Which address works

The app picks the academy from the hostname. With `BASE_DOMAIN=example.com`, the academy with slug `cloudcadre` is `cloudcadre.example.com`. The bare domain and any other address show "This address isn't an academy". These subdomains are reserved and cannot be a slug: `console`, `start`, `auth`, `api`, `www`, `app`, `admin`.

**A different address** (for example `learn.client.com`): add this variable, on one line, with the tenant's real id.

```
EDUCORE_DOMAIN_MAP={"learn.client.com":{"tenantId":"<tenant uuid>","slug":"cloudcadre","planeId":"pooled-1","frontend":"default","status":"active"}}
```

Links inside emails are still built as `https://<slug>.<BASE_DOMAIN>`, so keep that address working too.

## 4. Scheduled mail

Queued mail is sent, and unpaid UPI orders are cancelled, when `/api/cron/outbox` is called. In the application's **Schedules** tab add a job with cron `* * * * *`, shell `sh`, and this command (put the academy's real hostname in it):

```
node -e "fetch('https://cloudcadre.example.com/api/cron/outbox',{headers:{authorization:'Bearer '+process.env.CRON_SECRET}}).then(r=>{if(!r.ok)process.exit(1)})"
```

## 5. The console (optional, separate application)

Same repository and Dockerfile. In **Environment → Build-time Arguments** set `APP=console`. Runtime variables: `apps/console/.env.example` (`CONTROL_DATABASE_URL`, the three Supabase values, `BASE_DOMAIN`). Container port `3000`.

## 6. Check it locally

```bash
podman build -t academy .                      # or: docker build -t academy .
podman run --rm -p 3000:3000 --env-file apps/academy/.env.local -e EDUCORE_FAKE_GATEWAY= -e BASE_DOMAIN=localhost academy
# then open http://<slug>.localhost:3000
```

## 7. What has been checked

Both images build with Podman with no environment variables. The academy container was run against a development project with proxy-style headers: public pages load, signed-in pages redirect to log in, static files are served, and a mapped custom domain resolves. The console container was only started without a database. **Not yet checked:** a deploy on a real Dokploy server, TLS, signing in and checkout from the container, and the scheduled job.
