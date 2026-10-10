# HappyLand Hotel Diani — Staff Booking & Operations

The repository root is the private staff booking and hotel operations system. Deploy it at `https://booking.happylandhoteldiani.co.ke`. The separate public website is in [`dni/`](./dni/) and deploys independently at `https://happylandhoteldiani.co.ke`.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

The first server request creates `data/happyland.sqlite` and initializes the supplied 20-unit inventory when there are no saved reservations: 5 studios, 10 one-bedroom units, and 5 two-bedroom units. Copy `.env.example` to `.env.local`. Set a unique `ADMIN_PASSWORD`, `ADMIN_USERNAME`, and `ADMIN_SESSION_SECRET` (at least 32 random characters) in every environment, including local development. The environment-configured account is the initial administrator; use Operations → Settings → Staff accounts to add named team accounts. Without these credentials, staff pages redirect to `/login` and the login API fails closed. Do not expose the local development server to untrusted networks.

## Production deployment

Both apps include independent Dockerfiles and `.dockerignore` files for Coolify's Dockerfile build pack. The root Dockerfile builds only the staff app; `dni/` has its own Dockerfile and can be moved/deployed separately without moving or merging its source into the staff app. Use the instructions in each app's README when setting them up independently.

### Coolify: staff booking system

1. In Coolify, create an application from the Git repository and select the production branch. Select **Dockerfile** as the build pack.
2. Set **Base Directory** to `/` (the repository root) and **Dockerfile Location** to `/Dockerfile`. Do not select `dni/` for the staff service. The container listens on port `3000`.
3. In the application's **Storages** section, add a persistent volume with container mount path `/app/data`. The container runs as the unprivileged `node` user (UID/GID 1000); ensure a host-path volume is writable by that user. Never use ephemeral storage for this path. The Docker image sets `HOTEL_DATABASE_PATH=/app/data/happyland.sqlite` and `HOTEL_MEDIA_PATH=/app/data/room-media`.
4. Set the application domain to `https://booking.happylandhoteldiani.co.ke` and enable Coolify's HTTPS proxy/certificate.
5. Add these **runtime** environment variables in Coolify:
   - `ADMIN_USERNAME`, `ADMIN_NAME`, `ADMIN_PASSWORD`, and a unique random `ADMIN_SESSION_SECRET` of at least 32 characters. Do not use the example values or commit these secrets.
   - `HOTEL_SITE_URL=https://booking.happylandhoteldiani.co.ke` (also add as a build-time variable)
   - `HOTEL_DATABASE_PATH=/app/data/happyland.sqlite`
   - `HOTEL_MEDIA_PATH=/app/data/room-media`
   - Optional SMTP settings: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and `HOTEL_NOTIFICATION_EMAIL`.
6. Deploy and check the deployment logs. Test that `/login` loads, sign in with the configured administrator, and confirm `https://booking.happylandhoteldiani.co.ke/api/public/hotel` returns public hotel content.
7. Back up the mounted volume regularly, including both the SQLite database and room media. Restore them together when migrating. Do not run multiple staff app replicas against one SQLite file.

### Coolify: separate public website

1. Create a **second** Coolify application from the same Git repository and production branch; do not combine it with the staff app. Select **Dockerfile** as the build pack.
2. While the website remains in this repository, set **Base Directory** to `/dni` and **Dockerfile Location** to `/Dockerfile` (relative to that base). Its Dockerfile and `.dockerignore` are already inside `dni/`. If you later move the website to its own repository/root, update this app's Base Directory to `/` and keep its Dockerfile at the new root; do not move or change the staff app.
3. Set the app domain to `https://happylandhoteldiani.co.ke`, enable HTTPS, and expose container port `3000`. Do not attach a database/media volume to this website.
4. Add these variables in Coolify as both **build-time and runtime** values:
   - `HOTEL_SITE_URL=https://happylandhoteldiani.co.ke`
   - `BOOKING_SYSTEM_URL=https://booking.happylandhoteldiani.co.ke` (server-only; never name it `NEXT_PUBLIC_*`)
   - `HOTEL_IMAGE_HOSTS` (optional comma-separated hostnames when staff room images use additional HTTPS hosts)
5. Deploy the staff app first, then deploy the website. Confirm the website container can reach the staff domain over HTTPS. The website proxies live inventory and guest submissions to the staff app; do not add a database or local inventory volume to it.
6. After deployment, check that the homepage and room pages load live room content, then submit a test enquiry or booking only if using a safe test setup. Verify public room photos load through the staff service.

Configure DNS A/AAAA records for both hostnames to the Coolify server and allow inbound ports 80 and 443. Keep the two Coolify apps separate even if they initially use the same Git repository. Do not select static export: both apps require a Node.js server, and the staff system additionally requires Node.js 22.5+ for `node:sqlite`.

## System boundary and synchronization — priority

This app is the single source of truth for inventory, rates, availability, published room details/photos, enquiries, and reservations. The public website fetches its published content from `GET /api/public/hotel` and proxies visitor availability, enquiry, and booking requests to this system. Do not create a second live inventory/reservation store in `dni/` or copy SQLite/media files between the two deployments.

Website bookings are validated and checked again against current stock inside a SQLite immediate transaction here, then saved with source `Website`. Staff see them in Operations → Reservations and use this system to update/cancel them. Room descriptions and photo URLs are maintained in Operations → Rooms; public changes flow to the website from the public hotel API without a website redeploy. Keep API payloads and photo URLs compatible across both projects.

## Public API

| Endpoint | Use |
| --- | --- |
| `GET /api/public/hotel` | Property profile and published accommodations, including rooms and virtual combinations, with capacity, KES rates, descriptions, amenities, and photo URLs. Pass `checkIn`, `checkOut`, and `guests` for date-specific availability. Internal physical room codes are not public. |
| `GET /api/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&guests=2` | Current room and combination availability with remaining bookable units; responses are not cached. |
| `POST /api/bookings` | Create a reservation with `{roomSlug,checkIn,checkOut,guests,name,email,phone,source}`; `roomSlug` may identify a room category or a virtual combination. Inventory is rechecked and locked for all combination components at write time. |
| `POST /api/payments/lookup` | Look up `{reservationReference,email}` and return the matching stay's total charges, verified/pending payments, balance due, and amount still available to submit. |
| `POST /api/payments` | Submit a guest's M-Pesa partial/full payment with `{reservationReference,email,amountKsh,transactionReference}`. The booking reference and email must match; the transaction is saved as pending and consumes available-to-record balance until staff verify or reject it. |
| `POST /api/enquiries` | Save a visitor enquiry for staff follow-up. |

Add physical room units, guest limits, nightly KES rates, public descriptions, amenities, and approved photos in Operations → Rooms. The three-bedroom accommodations are virtual combinations of A2+A3, C2+C3, and D2+D3, not extra physical units. Each combination is managed and priced in staff operations and reserves all component units together. Public room-image paths are served by this system; keep the media storage reachable and durable.

Room photos are uploaded to one folder per physical room category. The default folders are `data/room-media/studio/`, `data/room-media/1-bedroom/`, and `data/room-media/2-bedroom/`, relative to this staff project. Virtual combinations use the galleries of their component categories; they do not have a separate physical three-bedroom folder. If `HOTEL_MEDIA_PATH` is configured, the category folders are created under that storage root. Keep exterior and drone photos in the separate property gallery.

## Staff operations

The staff dashboard is at `/`; workspaces are under `/operations/*` (reservations, notifications, check-outs, rooms, guests, front desk, payments, housekeeping, maintenance, guest services, inventory, reports, expenses, suppliers, and settings). The Next.js Proxy redirects all page requests without a valid signed eight-hour session to `/login`, preserving the requested internal path for after sign-in. `/login`, static assets, and API routes are excluded from page redirects; staff APIs independently require a valid staff session and public booking APIs remain available to the separate website. Only administrators can access Settings or manage staff accounts. A maximum of two active administrator accounts is allowed, counting the environment-configured bootstrap administrator when it is a separate account; this limit does not apply to other roles. Admins and managers can verify payments, while receptionists cannot; chief accountants can verify payments. Managers have full system access except deleting rooms or reservations. The person who records a payment cannot verify that same payment. Reservation changes, rates, payments, verifications, folio charges, and operational records are audited.

In Reservations, each active stay shows its remaining balance and has a **Record payment** action that carries the exact reservation reference into the payment form. Guests can submit partial/full M-Pesa amounts and transaction codes from their booking confirmation after contacting the hotel to confirm current payment details. The booking reference and guest email must match, amounts cannot exceed the remaining recordable balance, and duplicate transaction codes are rejected. Guest submissions are saved as pending and consume available-to-record balance until an independent verifier reviews them. The verifier can verify or reject a payment with a required reason; rejected payments are audited and no longer reserve any of the guest's available balance. The Payments workspace shows room and service charges, verified and pending amounts, balance due, and amount available to record.

Every saved payment receives a unique, database-backed receipt number and an immutable charge/stay snapshot. The payment form opens its saved receipt preview after recording; Payments also provides Preview and Print actions for existing records, including guest-submitted M-Pesa payments after staff verification. Receipts show the actual transaction amount (including partial payments), itemized stay and posted folio charges, verified-to-date payments, pending payments, and the current remaining balance; an unverified submission is clearly marked and its balance is labelled as conditional on verification. The receipt identifies the staff member who recorded it and does not require a signature. For printing, select **A4**, **Portrait**, **Actual size / 100%**, and **No margins**; disable browser headers and footers. The 210 × 99 mm receipt is positioned at the top of the A4 page for trimming. Keep the A4 page size selected; the receipt stylesheet sets the A4 page and zero margins.

The protected Operations → Notifications workspace and the top-bar bell show new website bookings with guest, stay, room, and contact details; website enquiries with guest contact details and message; reservation status updates; and payment events. New events are checked every 12 seconds while the staff session is active. The bell shows unread counts, supports marking items read and clearing the feed, and offers an optional browser-generated alert sound; browsers require a user interaction to enable audio playback.

The staff workspace also includes **Check-outs Today** (`/operations/checkouts`). It reports the Nairobi-local date and exact guest total for checked-in reservations departing that day, and lists each reservation with the guest, contact details, assigned physical room codes, stay dates, and status. Daily checkout notifications are deduplicated and open this page when selected.

## Validation

```powershell
npm.cmd run lint
npm.cmd run build
```
