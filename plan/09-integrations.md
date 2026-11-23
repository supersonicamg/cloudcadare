# 09 · Integrations (ports & adapters)

All third parties sit behind interfaces in `packages/integrations`. Domain code calls the **port**. Each tenant's `integrations` row (or the platform default) selects the **adapter**. Secrets live in Supabase Vault and are referenced by `secret_vault_id`.

```ts
// packages/integrations/src/payments/port.ts
export interface PaymentGateway {
  createOrder(i: { orderId: string; amountMinor: number; currency: string; customer: Customer; notes?: Record<string,string> }): Promise<{ gatewayOrderId: string; clientPayload: unknown }>
  verifyWebhook(rawBody: string, headers: Headers): Promise<GatewayEvent>         // throws on bad signature
  refund(i: { gatewayPaymentId: string; amountMinor: number; reason?: string }): Promise<{ gatewayRefundId: string }>
  createSubscription?(…): Promise<…>
}
// adapters: razorpay.ts · stripe.ts · cashfree.ts · phonepe.ts
```

## 1. Payments

| | Razorpay (default, India) | Stripe (international) |
|---|---|---|
| Methods | UPI, cards, netbanking, wallets, EMI, UPI AutoPay | Cards, wallets, local methods |
| Academy setup | Academy enters key_id + secret (or Razorpay **OAuth/Partner** onboarding to avoid key copy-paste) | Stripe Connect Standard (OAuth) |
| Webhook | `/api/webhooks/razorpay/{tenantId}`; HMAC with tenant webhook secret | `/api/webhooks/stripe/{tenantId}` |
| Events used | `payment.captured`, `payment.failed`, `refund.processed`, `subscription.*`, `order.paid` | `checkout.session.completed`, `invoice.paid`, `charge.refunded`, `customer.subscription.*` |

**Webhook flow:**

1. Read the raw body and verify the signature.
2. Insert into `gateway_webhook_inbox`; on conflict with the event id, return 200 (dedupe).
3. Enqueue processing and return 200 fast.
4. The worker handles the event in one transaction: payment row, order status, fulfilment (enrollments), invoice number, outbox events.
5. Reconciliation (daily) pulls the last 48 h of payments from the gateway API and repairs anything missed.

**Platform billing** (you → academies): Razorpay Subscriptions on the platform's own account, recorded in `control.tenant_subscriptions` and `control.platform_invoices`.

## 2. Video

| Provider | Use when | Notes |
|---|---|---|
| **Mux** (default) | Best developer experience, signed playback, analytics, auto captions | Direct upload from browser (signed upload URL) → webhook `video.asset.ready` → `media_assets.status='ready'`, `playback_id` |
| **Bunny Stream** | Cost-sensitive tenants, high volume | Token-authenticated URLs, India PoPs |
| **VdoCipher** | DRM add-on (`content.video_drm`), piracy-sensitive coaching | Widevine/FairPlay, dynamic watermark built in, OTP-based playback |
| Cloudflare Stream | Alternative | Signed URLs |
| YouTube/Vimeo | Free/preview content only | Unlisted embeds; no protection |

**Port:**

- `createUpload()`
- `getPlaybackToken(assetId, member, ttl)` (binds the watermark text)
- `deleteAsset()`
- `getUsage(period)` → `limit.video_hours` metering

**Live recordings:** Zoom/100ms webhook → `ingestFromUrl()`.

## 3. Live classes

| Provider | Integration |
|---|---|
| Zoom | Server-to-Server OAuth app per tenant (or platform-level app with per-tenant account); create meetings on session schedule; `meeting.ended` → fetch participants report → attendance; `recording.completed` → ingest |
| Google Meet | Google Calendar API (Workspace); conference data; attendance via Meet API (Workspace editions) |
| MS Teams | Graph API online meetings; attendance reports |
| 100ms | In-app classroom (embedded, branded), webhooks for peer join/leave → precise attendance, recordings |
| YouTube Live | One-to-many webinars; no attendance (join click logged) |
| Custom / in-person | Manual or QR attendance |

## 4. Messaging

| Channel | Provider | India compliance |
|---|---|---|
| Email | Resend (developer experience) or AWS SES (cost at volume); per-tenant "from" name; custom sending domain (DKIM/SPF via provider API) for Pro+ | — |
| SMS | **MSG91** (or Gupshup/Kaleyra) | DLT: each tenant registers entity + sender ID + templates; we store `provider_template_id` per template; OTPs via DLT OTP route |
| WhatsApp | **Meta WhatsApp Cloud API** via BSP (Gupshup / Interakt / AiSensy) | Template approval per tenant number; opt-in stored in `consents`; 24-hour session rule handled by adapter |
| Push | Web Push (VAPID) for PWA; FCM/APNs for mobile later | — |
| In-app | `notifications` table + Realtime broadcast | — |

The notification worker picks the channel per event × tenant entitlement × quota × member preference × quiet hours (default 21:00–08:00 for promotional messages).

## 5. Storage & files

- Supabase Storage buckets: `public-assets`, `course-media`, `submissions`, `exports` (policies in `96_storage.sql`).
- **Uploads:** the browser uploads directly with a signed upload URL (resumable TUS for large files). The worker post-processes: MIME sniff, image re-encode (sharp → AVIF/WebP), PDF page count and thumbnails, optional virus scan.
- **Delivery:** public assets through the Supabase CDN plus `next/image` (remote patterns per plane); private assets through server-minted signed URLs.

## 6. Other integrations

| Need | Choice |
|---|---|
| Bot protection | Cloudflare Turnstile |
| Rate limit / cache | Upstash Redis |
| Domains & TLS | Vercel Domains API (custom domains), wildcard cert for `*.yourplatform.app` |
| Errors / tracing | Sentry (Next.js SDK, source maps, tenant tag on every event) |
| Product analytics | PostHog (self-serve funnels, feature-usage per tenant, session replay with input masking); **no third-party trackers for minors** |
| Maps / address | Google Places autocomplete (branches, billing) – optional |
| Calendar | ICS feeds per learner (`/api/v1/me/calendar.ics?token=`) + Google Calendar add |
| Labs (cloud training) | Adapter for external lab providers (e.g. AWS/Azure sandbox vendors, Instruqt, Killercoda): launch URL + completion callback → lesson completion |
| AI (later) | Anthropic Claude via API for doubt assistant (RAG over tenant content, citations to lessons), question generation; usage metered in `limit.ai_credits_monthly` |
| E-sign (optional) | Admission forms / agreements via Leegality / Digio (India) |

## 7. Adapter rules

1. **No SDK calls from domain code.** Domain code calls ports only, so providers can be swapped per tenant.
2. **Every outbound call** has a timeout, retries with jitter (idempotency keys where the provider supports them) and a circuit breaker per provider.
3. **Every inbound webhook** has signature verification, an inbox dedupe, a fast 200 and async processing.
4. **Per-tenant credentials** are loaded from Vault at call time and cached in memory (≤ 5 min); they are never logged.
5. **Sandbox mode** per tenant (`mode: test|live`), with clear UI badges while in test mode.
