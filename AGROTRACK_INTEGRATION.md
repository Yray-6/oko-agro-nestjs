# AgroTrack Integration — Oko Agro (NestJS) Side

This document covers the integration built between **Oko Agro** (this
repo — the marketplace connecting farmers and processors) and
**AgroTrack** (a separate Django logistics/dispatch backend). It explains
what was built, why, and exactly how each piece works.

Companion document: `OKO_INTEGRATION.md` in the `agro_track` repo covers
the same integration from AgroTrack's side.

---

## 1. The idea in one paragraph

Oko and AgroTrack stay two separate products with two separate databases.
When a farmer on Oko accepts a buy request and wants to ship it, this repo
calls AgroTrack server-to-server (no browser, the farmer never logs into
AgroTrack) to create a real shipment and get a tracking number back.
AgroTrack then pushes status updates back here as the shipment moves, so
this app's data stays current without polling. Everything is tied
together by one id — a buy request's own `id`, sent to AgroTrack as
`oko_request_id` — referenced on every call after creation.

---

## 2. What was built, package by package

| # | Package | What it added |
|---|---|---|
| 1 | Linking fields | `agroTrackOrderId`, `agroTrackStatus`, `agroTrackSyncedAt` on `BuyRequest` — pure additive migration |
| 2 | Signed service client | `AgroTrackClientService` — HMAC request signing matching AgroTrack's auth scheme |
| 3 | Arrange transit | `AgroTrackIntegrationService`, `arrangeTransitViaAgroTrack()`, `PUT :id/arrange-transit` |
| 4 | Inbound webhooks + reconciliation | `AgroTrackWebhookGuard`/`Controller`/`Service`, `AgroTrackReconciliationScheduler` |
| 5 | Cancellation | `cancelOrder()`, `cancelAgroTrackShipment()`, `PUT :id/cancel-transit` |
| 6 | SSO handoff (optional) | `issueSsoHandoffToken()`, `GET integrations/agrotrack/sso-handoff-token` |
| 7 | Local shipping-cost preview | `pricing/` — geocode/OSRM/formula replicated locally, `POST buy-requests/estimate-shipping-cost` |
| 8 | ETA sync | `agroTrackEstimatedDeliveryDate` on `BuyRequest`, kept current via webhook + reconciliation |

All of it lives under `src/integrations/agrotrack/` plus a handful of
additive methods on `BuyRequestsService`/`BuyRequestsController`. Nothing
pre-existing in this repo was rewritten — only extended.

---

## 3. New surface area

### New module: `src/integrations/agrotrack/`

```
integrations/agrotrack/
├── agrotrack-client.module.ts        # wires everything below together
├── agrotrack-client.service.ts       # signRequest() — HMAC signing
├── agrotrack-integration.service.ts  # estimateCost, createOrder, getOrderStatus, cancelOrder, issueSsoHandoffToken
├── agrotrack-webhook.controller.ts   # POST integrations/agrotrack/webhook (inbound)
├── agrotrack-webhook.service.ts      # dedup + status-update logic
├── agrotrack-sso.controller.ts       # GET integrations/agrotrack/sso-handoff-token
├── guards/
│   └── agrotrack-webhook.guard.ts    # verifies AgroTrack's signed webhooks
├── entities/
│   └── agrotrack-webhook-event.entity.ts   # dedup table
├── dtos/
│   └── webhook-event.dto.ts
└── pricing/
    ├── geo.util.ts                              # Nominatim/OSRM/Haversine — mirrors AgroTrack's geo.py
    ├── agrotrack-pricing-config.service.ts       # fetches + caches base_rate/per_km/multipliers
    └── local-shipping-cost-estimator.service.ts  # the same formula, run locally
```

### New/extended endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `PUT` | `/buy-requests/:id/arrange-transit` | JWT (farmer/admin) | One-click: create the shipment on AgroTrack |
| `PUT` | `/buy-requests/:id/cancel-transit` | JWT (farmer/admin) | Cancel a not-yet-picked-up shipment |
| `GET` | `/integrations/agrotrack/sso-handoff-token` | JWT | Get a token to skip a second AgroTrack login |
| `POST` | `/integrations/agrotrack/webhook` | HMAC signature (not JWT) | Receive a status-change event from AgroTrack |
| `POST` | `/buy-requests/estimate-shipping-cost` | JWT | Live price preview — no order, no AgroTrack round trip |

### New entity fields

`BuyRequest` — `agroTrackTrackingNumber` (pre-existing), plus:
`agroTrackOrderId`, `agroTrackStatus` (new `AgroTrackStatus` enum, kept
deliberately separate from `OrderState`/`paymentConfirmed`), `agroTrackSyncedAt`,
and — populated by `arrangeTransitViaAgroTrack()` from AgroTrack's create
response — `agroTrackBaseRate`, `agroTrackDistanceSurcharge`,
`agroTrackTotalCost` (all `decimal(30,2)`, stored and typed as strings, not
numbers, matching the existing `paymentAmount` convention — Postgres
decimals lose precision if round-tripped through a JS `number`). Before
these existed, a successful arrange-transit call returned pricing that had
already been computed but was silently discarded before reaching the
frontend. Also `agroTrackEstimatedDeliveryDate` (`date`, nullable string) —
AgroTrack's own dispatcher-set delivery estimate, kept via webhook/
reconciliation (§4.10) and deliberately separate from this app's own
`estimatedDeliveryDate` (the buyer's commercial target, set at buy-request
creation) — same reasoning as `agroTrackStatus` vs `orderState`.

### New env vars

```bash
AGROTRACK_BASE_URL=          # e.g. https://agrotrack-production.up.railway.app
AGROTRACK_API_KEY=            # must match AgroTrack's OKO_SERVICE_API_KEY
AGROTRACK_HMAC_SECRET=        # must match AgroTrack's OKO_SERVICE_HMAC_SECRET
AGROTRACK_WEBHOOK_SECRET=     # must match AgroTrack's OKO_WEBHOOK_SECRET
```

Leaving these unset means outbound calls throw a clear configuration
error rather than silently doing nothing — this integration is opt-in per
buy request (only triggered by the `arrange-transit` action), so an
unconfigured environment doesn't affect anything else in the app.

---

## 4. How it works, step by step

### 4.1 Linking fields (Package 1)

Just columns — nothing to run beyond the migration. `agroTrackStatus` uses
its own `AgroTrackStatus` enum (`new_request | assigned | pending_pickup |
in_transit | delivered | completed | cancelled`) matching AgroTrack's
vocabulary exactly, so it's never confused with this app's own `OrderState`.

### 4.2 Signing requests to AgroTrack (Package 2)

`agrotrack-client.service.ts` — `signRequest(body?)`:

1. Takes an optional JS object. If omitted, signs an **empty** raw body —
   needed for AgroTrack's GET/bodyless-POST endpoints, since its auth
   class signs over the request's literal bytes (empty for a bodyless
   request), not over `"undefined"` or `"{}"`.
2. Otherwise, `JSON.stringify(body)` — and that exact string is returned
   alongside the headers (`rawBody`). Every caller must send `rawBody`
   verbatim as the HTTP body, not re-serialize the original object — a
   different byte sequence (key order, whitespace) would fail AgroTrack's
   signature check even with the same logical payload.
3. Computes `HMAC-SHA256(AGROTRACK_HMAC_SECRET, "{timestamp}.{rawBody}")`
   and returns `{ 'X-Api-Key', 'X-Timestamp', 'X-Signature' }`.

Every other service in this module builds on top of this one function.

### 4.3 Arranging transit — one-click create (Package 3)

`buy-requests.service.ts` — `arrangeTransitViaAgroTrack(id, dto, currentUser)`:

1. Loads the `BuyRequest`. `404` if it doesn't exist.
2. Only the farmer (`seller`) on the request, or an admin, may call this —
   `403` otherwise.
3. Already has a tracking number? Return the existing record, `200` — no
   re-arranging.
4. Calls `AgroTrackIntegrationService.createOrder()` with the farmer's own
   identity (`oko_user_id: farmer.id`, email, name, phone) plus the
   structured pickup/delivery address from `ArrangeTransitDto` — that DTO
   exists because AgroTrack's contract needs state/LGA precision this
   app's `User`/`BuyRequest` entities don't otherwise capture; the calling
   UI that collects it is still to be built.
5. **If AgroTrack returns 409** (`AgroTrackSenderUnresolvedError` — it
   couldn't resolve/provision a sender), this is treated as an expected
   outcome, not a crash: returns `200` with `requiresManualFallback: true`
   so the frontend can fall back to a manual arrange-transit flow.
6. On success, stores `agroTrackTrackingNumber`, `agroTrackOrderId`, and
   the pricing AgroTrack computed for this shipment
   (`agroTrackBaseRate`/`agroTrackDistanceSurcharge`/`agroTrackTotalCost`)
   on the `BuyRequest` and returns it — this is the *authoritative* price,
   distinct from the preview in §4.9.

This never touches `orderState` or `paymentConfirmed` — logistics status
from AgroTrack is deliberately kept independent of this app's own
commercial/payment state.

### 4.4 Pulling order status — reconciliation (Package 4, pull side)

`AgroTrackIntegrationService.getOrderStatus(okoRequestId)` calls
AgroTrack's narrow read endpoint (bodyless GET, signed the same way as
§4.2). Returns `null` on a `404` (no order yet) rather than throwing —
that's an expected outcome for a reconciliation sweep, not an error.

### 4.5 Receiving webhooks (Package 4, push side)

This is the primary way `agroTrackStatus` actually gets updated day to
day — not the poller in §4.4/§4.6, which is a backstop.

**Prerequisite:** `main.ts` now captures the raw request body
(`app.use(json({ verify: (req, res, buf) => { req.rawBody = buf } }))`) —
without this, there'd be nothing to check a signature against, since
Nest's default body parser only exposes the already-parsed object.

`agrotrack-webhook.guard.ts` — `AgroTrackWebhookGuard`:

1. Reads `X-Signature`/`X-Timestamp` headers and `request.rawBody`.
2. Rejects outright if either header is missing, or (Express types a
   repeated header as an array) not a plain string — no attempt to guess
   how to coerce a malformed request into the signature check.
3. Checks the timestamp is within 5 minutes (replay protection).
4. Recomputes the HMAC the same way AgroTrack signed it and compares
   (`crypto.timingSafeEqual`).

`agrotrack-webhook.service.ts` — `handleStatusChanged(dto)`, once the
guard passes:

1. **Dedup:** if `event_id` is already in `AgroTrackWebhookEvent`, return
   `200` and do nothing else — a retried delivery is a no-op, not a
   double-applied status change.
2. Look up the `BuyRequest` by `id` (AgroTrack's `oko_request_id` *is*
   this app's buy-request id — see §4.3 step 4).
3. **Out-of-order protection:** if the event's `occurred_at` is older than
   the `agroTrackSyncedAt` already recorded, skip the update (but still
   record the event as processed).
4. Otherwise, updates `agroTrackStatus`, `agroTrackOrderId`,
   `agroTrackTrackingNumber`, `agroTrackSyncedAt`, and (if the payload
   carries the key at all — see §4.10) `agroTrackEstimatedDeliveryDate`.
   **Never** `orderState`, **never** `paymentConfirmed` — this is the one
   rule the whole integration is built around. AgroTrack's `in_transit`
   and this app's `in_transit` are not the same event; this app's
   `in_transit` also gates `paymentConfirmed`, so a naive merge would
   silently auto-confirm payment because a truck started moving.

### 4.6 Reconciliation scheduler (Package 4, backstop)

`agrotrack-reconciliation.scheduler.ts` — same `@Cron` + `RUN_SCHEDULER`
guard pattern as the pre-existing `buy-requests.scheduler.ts`. Every 30
minutes:

1. Finds buy requests with a tracking number, not yet `completed`/`cancelled`,
   whose `agroTrackSyncedAt` is stale (>60 min) or null.
2. Pulls fresh status for each via §4.4.
3. One request's failure doesn't stop the batch — errors are logged and
   the loop continues.

This is deliberately a long interval — it exists in case the webhook
mechanism fails systemically (e.g. AgroTrack's delivery command stops
running and nobody notices), not to compete with the webhook as the
primary sync path.

### 4.7 Cancelling a shipment (Package 5)

`cancelAgroTrackShipment(id, currentUser)` — same permission shape as
§4.3 (farmer or admin only). `400` if there's nothing linked to cancel.
Calls `AgroTrackIntegrationService.cancelOrder()`; if AgroTrack rejects
with `409` (already in transit), that's re-thrown as a real
`ConflictException` here — surfaced to the caller, not silently absorbed.
On success, optimistically sets `agroTrackStatus = CANCELLED` immediately
(the webhook will confirm it again shortly after, harmlessly, since §4.5
is already idempotent).

### 4.8 SSO handoff — optional (Package 6)

`agrotrack-sso.controller.ts` — `GET integrations/agrotrack/sso-handoff-token`,
JWT-guarded. Calls `issueSsoHandoffToken(currentUser.id)` — signed,
bodyless POST to AgroTrack. `404` (from AgroTrack) becomes a
`NotFoundException` here if the current user has no linked AgroTrack
account yet (i.e. never arranged a shipment). On success, returns the
token/expiry for the frontend to redeem against AgroTrack's public
`POST /api/v1/auth/sso/consume/` — letting the farmer skip AgroTrack's own
login screen.

### 4.9 Live shipping-cost preview, computed locally (Package 7)

Before a farmer commits to `arrange-transit` (§4.3), they need to see a
price. The straightforward version of that — call AgroTrack's own
`POST /api/v1/public/estimate/` on every form change — means a full
network hop to AgroTrack, which then itself calls Nominatim to geocode
both addresses and OSRM to route between them, for every quote. This
package cuts AgroTrack out of that path entirely for the preview.

`pricing/geo.util.ts` reimplements AgroTrack's `public_api/geo.py`
field-for-field: same Nominatim/OSRM URLs, same 1.3× Nigerian
road-correction factor, same 5km minimum billable distance, same
OSRM-then-Haversine fallback order — called directly from here instead of
through AgroTrack's server.

`pricing/agrotrack-pricing-config.service.ts` fetches the admin-configurable
pricing knobs (`base_rate`, `distance_surcharge_per_km`, `express_multiplier`,
`same_day_multiplier`) from AgroTrack's new
`GET /api/v1/integrations/oko/pricing-config/` (signed the same way as
every other call in this module — see §4.2), and caches them for 5
minutes. These values only change when an AgroTrack admin edits Platform
Settings, so refetching per estimate would defeat the entire point of
estimating locally. Falls back to AgroTrack's own model defaults if the
config endpoint is ever unreachable and nothing has been cached yet.

`pricing/local-shipping-cost-estimator.service.ts` runs the identical
formula AgroTrack uses — `(base_rate + distance_km * per_km) *
priority_multiplier` — against the geocoded distance and cached config
above, and is what `POST buy-requests/estimate-shipping-cost` calls.

**This is a preview only.** It never creates anything and is not scoped to
a specific buy request. The authoritative price is still whatever AgroTrack
itself computes and returns at order-creation time (§4.3 step 6) — a stale
pricing-config cache here can only ever make the *preview* slightly off,
never change what's actually billed.

### 4.10 Keeping `agroTrackEstimatedDeliveryDate` current (Package 8)

AgroTrack's own `estimated_delivery_date` (set manually by a dispatcher —
there's no auto-computed ETA on either side of this integration) wasn't
reaching this app at all before Package 8: AgroTrack's webhook only fired
on status changes and never included the field even when it did fire. Both
gaps are now closed on AgroTrack's side (`OKO_INTEGRATION.md` §4.10) —
setting the ETA alone now enqueues its own webhook (`event:
'order.eta_updated'`), and every webhook payload carries the current
value regardless of what triggered it.

On this side, `WebhookOrderStatusChangedDto` gained an optional
`estimated_delivery_date` field, and `agrotrack-webhook.service.ts`
applies it to `agroTrackEstimatedDeliveryDate` — but only when the key is
present at all (`!== undefined`, not just falsy) so an older/replayed
payload that omits the field entirely doesn't wipe out a value this app
already has; an explicit `null` in the payload *does* clear it, since that
means AgroTrack itself has no ETA set right now. Still governed by the
same out-of-order/staleness guard as every other field in this handler
(§4.5 step 3).

The reconciliation pull side (`getOrderStatus()`, §4.4) and its scheduler
(§4.6) carry the same field now too, so a reconciliation sweep restores
ETA along with status if the webhook mechanism was ever down.

---

## 5. Testing

```bash
# Everything this integration touched
npx jest integrations/agrotrack buy-requests.arrange-transit buy-requests.cancel-transit buy-requests.estimate-shipping-cost schedulers/agrotrack-reconciliation

# Build
npx nest build
```

82 tests across 12 suites, all passing, build clean.

One thing worth knowing if you run the *full* suite (`npx jest`): ~30
pre-existing spec files elsewhere in this repo fail — that predates this
integration (confirmed via baseline comparison) and is unrelated to it.
A real, separate fix (a `moduleNameMapper` entry in `package.json` for
this project's `src/` import alias) was needed just to get *this*
integration's own tests running at all; that fix incidentally lets those
30 pre-existing suites actually attempt to run instead of failing on an
import error, which is what surfaced them as failing for their own
(unrelated, pre-existing) reasons.

---

## 6. Before this goes near production

- **Set the four env vars** (§3) identically to AgroTrack's corresponding
  secrets, per environment.
- **The `ArrangeTransitDto` UI doesn't exist yet.** The backend accepts
  structured pickup/delivery address data; nothing in this repo's
  frontend (or the separate frontend repos) collects and submits it yet.
- **No consent screen.** `arrangeTransitViaAgroTrack` passes
  `oko_consent_ack` through to AgroTrack, but nothing here currently sets
  it to `true` — that's a one-time notice AgroTrack recommends showing a
  farmer before their first shadow-account creation, which is a frontend
  concern.
- **Migrations were hand-written** to match this repo's existing
  migration style (not machine-generated against a live DB) — worth a
  dry run against staging Postgres before trusting them in production.
- **No frontend calls `estimate-shipping-cost` yet** (§4.9) — same
  situation as the `ArrangeTransitDto` UI above, the backend is ready but
  nothing collects/submits pickup/delivery/priority ahead of the arrange
  step yet.

---

## 7. Changelog since Packages 1–6 were first built

- **Fixed:** `AgroTrackClientService.signRequest()` always
  `JSON.stringify`'d even when called with no body, breaking every
  bodyless GET/POST call (`getOrderStatus`, `cancelOrder`,
  `issueSsoHandoffToken`) — AgroTrack signs over the *actual* raw (empty)
  body, not the string `"undefined"`. Now signs `''` when `body` is
  omitted. See §4.2.
- **Fixed:** a Jest `moduleNameMapper` gap for this project's `src/`
  import alias blocked even this integration's own new tests from
  resolving imports — added the mapper. This incidentally unblocked ~30
  pre-existing, unrelated broken stub test suites elsewhere in the repo to
  fail for their own reasons instead of an import error; confirmed
  pre-existing via a `git stash` baseline comparison and left untouched,
  per this repo's "don't modify code that predates this integration" rule.
- **Added:** pricing fields (`agroTrackBaseRate`/`agroTrackDistanceSurcharge`/
  `agroTrackTotalCost`) on `BuyRequest`, populated from AgroTrack's create
  response — previously computed by AgroTrack but discarded before
  reaching the frontend. See the note under "New entity fields" in §3.
- **Added:** Package 7, local shipping-cost preview — see §4.9.
- **Added:** Package 8, ETA sync — see §4.10.
- **Merged:** a teammate's `LocationsModule` (`src/locations/*`, Nigerian
  states/LGAs for location pickers) landed on `main` around the same time
  as this integration. It's independent of everything here, but worth a
  look together at some point — AgroTrack has its own Nigerian states/LGA
  dataset (`public_api/data/nigeria_states.json`) backing both the pricing
  formula and this integration's own `pickupState`/`pickupLga` fields, and
  it's not yet clear whether the two should be the same source of truth.
