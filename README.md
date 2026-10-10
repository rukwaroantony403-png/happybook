# HappyLand Hotel Diani — Staff Booking & Operations

The repository root is the private staff booking and hotel operations system. Deploy it at `https://portal.happylandhoteldiani.co.ke`. The separate public website is maintained in `C:\dni` and deploys independently at `https://happylandhoteldiani.co.ke`.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

The first server request creates `data/happyland.sqlite` and initializes the supplied 20-unit inventory when there are no saved reservations: 5 studios, 10 one-bedroom units, and 5 two-bedroom units. Copy `.env.example` to `.env.local`. Set a unique `ADMIN_PASSWORD`, `ADMIN_USERNAME`, and `ADMIN_SESSION_SECRET` (at least 32 random characters) in every environment, including local development. The environment-configured account is the initial administrator; use Operations → Settings → Staff accounts to add named team accounts. Without these credentials, staff pages redirect to `/login` and the login API fails closed. Do not expose the local development server to untrusted networks.

## Production deployment with Coolify

There are two independent applications and two independent Coolify deployments:

| Application | Project folder/source | Public domain | Purpose |
| --- | --- | --- | --- |
| Staff booking system | This repository root | `https://portal.happylandhoteldiani.co.ke` | Private hotel operations and the authoritative database |
| Public website | Separate project at `C:\dni` | `https://happylandhoteldiani.co.ke` | Guest-facing room browsing and booking |

Deploy the staff system first. Then follow the public website's separate guide in `C:\dni\README.md`. Never point both Coolify applications at the same Base Directory, persistent volume, or production database.

### Before you start

1. Make sure the staff-system Dockerfile and code are pushed to the Git branch you intend to deploy.
2. In your domain provider, point the `portal` subdomain to the server running Coolify. You can prepare the public root domain too, but it is used by the separate website deployment.
3. In your server firewall, allow inbound HTTP and HTTPS traffic on ports `80` and `443`. Coolify's proxy uses these to issue and renew HTTPS certificates.
4. Prepare a strong administrator password and a unique random session secret of at least 32 characters. Keep them private; do not put real secrets in Git, this README, or the public website's environment.

### Create the staff application

1. In Coolify, choose **Projects → Add Resource → Application** (the exact menu wording may vary slightly by Coolify version), then choose the Git provider and repository containing this staff system. Select the branch to deploy.
2. Choose **Dockerfile** as the build pack. Use these paths:
   - **Base Directory:** `/` (the repository root)
   - **Dockerfile Location:** `/Dockerfile`
   - **Build context:** `/` if Coolify asks for it

   Do not set the staff app's Base Directory to `dni/`. The staff container serves HTTP on port `3000`; Coolify's proxy connects to that port.
3. Open the application's **Storages** (or **Persistent Storage**) settings. Add a persistent volume mounted inside the container at **`/app/data`**. This folder holds the live SQLite database and room-photo files. It must persist across redeployments and be writable by the container's `node` user (UID/GID 1000). Do not use an ephemeral container filesystem. Do not mount the same SQLite volume into multiple app replicas.
4. Open the application's **Environment Variables** and add the following values:

   | Variable | Value / instructions | Available at |
   | --- | --- | --- |
   | `ADMIN_USERNAME` | Your chosen first administrator username, for example `admin` | Runtime |
   | `ADMIN_NAME` | Display name for the first administrator | Runtime |
   | `ADMIN_PASSWORD` | A strong private password; never use an example password | Runtime |
   | `ADMIN_SESSION_SECRET` | Unique random secret, at least 32 characters | Runtime |
   | `HOTEL_SITE_URL` | `https://portal.happylandhoteldiani.co.ke` | Build and runtime |
   | `HOTEL_DATABASE_PATH` | `/app/data/happyland.sqlite` | Runtime |
   | `HOTEL_MEDIA_PATH` | `/app/data/room-media` | Runtime |

   Coolify may label build-time variables **Build Arguments** and runtime variables **Environment Variables**. Add `HOTEL_SITE_URL` in both places. Keep administrator credentials and `ADMIN_SESSION_SECRET` runtime-only. The Docker image already supplies the database and media paths above, but setting them explicitly in Coolify makes the persistent-storage configuration visible and easy to check.

   To generate a random session secret on your computer, run `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"` and paste the result into Coolify. Do not share or commit it.
5. (Optional) For email notifications, add the SMTP variables as **runtime** values: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and `HOTEL_NOTIFICATION_EMAIL`. Without SMTP, bookings and enquiries are still saved, but email notifications are not sent.
6. In **Domains**, enter **`https://portal.happylandhoteldiani.co.ke`** and enable Coolify's HTTPS proxy/certificate. Check that the `portal` DNS record points to this Coolify server.
7. Save the configuration and click **Deploy**. Wait for the build and deployment to finish, then open the deployment logs. The image uses Node.js 22 and the application needs Node.js 22.5 or later for SQLite.

### Check the staff deployment

1. Open `https://portal.happylandhoteldiani.co.ke/login`. If it does not load, check the deployment logs, domain spelling, DNS record, and ports 80/443.
2. Sign in using the `ADMIN_USERNAME` and `ADMIN_PASSWORD` you configured. Change or rotate credentials through the application's supported staff settings; do not edit the production SQLite file manually.
3. Open `https://portal.happylandhoteldiani.co.ke/api/public/hotel`. It should return the hotel's public room and property data as JSON. A browser may display the JSON as plain text; that is expected.
4. In Operations → Rooms, verify the 20 physical starter units (5 studios, 10 one-bedroom, and 5 two-bedroom) and configure current rates, descriptions, amenities, and approved photos before accepting live bookings.
5. Set up regular backups of the **entire `/app/data` volume**. The SQLite database and room photos must be backed up and restored together. Test that a backup can be restored before relying on it.

After the staff app is working, deploy the guest-facing website separately using `C:\dni\README.md`. The website must call this staff system at `https://portal.happylandhoteldiani.co.ke`; it must not have a second production reservations database.

### Common setup mistakes

- **Login redirects or rejects every password:** check that all four `ADMIN_*` values are set as runtime variables, then redeploy. Do not put `ADMIN_PASSWORD` or `ADMIN_SESSION_SECRET` in build arguments.
- **Room photos or reservations disappear after redeploy:** confirm a persistent volume is mounted at `/app/data`, and that it is writable by the container.
- **HTTPS certificate does not issue:** check the `portal` DNS record, make sure ports 80 and 443 reach Coolify, and confirm the exact domain is configured on this app.
- **The public website cannot show rooms or submit bookings:** deploy the staff service first and verify `/api/public/hotel` is reachable over HTTPS from outside the server.
- **Build fails on a non-Docker setup:** confirm the Dockerfile build pack is selected and the Dockerfile path is `/Dockerfile` relative to Base Directory `/`.

Do not select static export. Do not run multiple staff app replicas against one SQLite file.

## System boundary and synchronization — priority

This app is the single source of truth for inventory, rates, availability, published room details/photos, enquiries, and reservations. The public website in the separate `C:\dni` project fetches its published content from `GET /api/public/hotel` and proxies visitor availability, enquiry, and booking requests to this system. Do not create a second live inventory/reservation store in the website or copy SQLite/media files between the two deployments.

Website bookings are validated and checked again against current stock inside a SQLite immediate transaction here, then saved with source `Website` and status `pending`. Their selected unit or combination components are held while staff review the request. Staff use Reservations → Review booking to confirm or decline it; a decline releases the room. Only a confirmed booking can be checked in or accept guest payment submissions. When SMTP is configured, the guest receives the initial request-received email and an additional email after staff confirms or declines it. Room descriptions and photo URLs are maintained in Operations → Rooms; public changes flow to the website from the public hotel API without a website redeploy. Keep API payloads and photo URLs compatible across both projects.

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

The staff dashboard is at `/`; workspaces are under `/operations/*` (reservations, notifications, check-outs, rooms, guests, front desk, payments, housekeeping, maintenance, guest services, inventory, reports, expenses, suppliers, and settings). New website bookings arrive in Reservations as pending and are listed first. Open **Review booking** to inspect the guest contact, dates, accommodation, assigned unit(s), price, and payment state. Confirm the request only after the details are checked; decline it to cancel and release its room hold. Confirmed reservations then move through the Front desk workspace from confirmed → checked-in → checked-out. The transition controls reject invalid state changes. When email is configured, confirming or declining also emails the guest. The Next.js Proxy redirects all page requests without a valid signed eight-hour session to `/login`, preserving the requested internal path for after sign-in. `/login`, static assets, and API routes are excluded from page redirects; staff APIs independently require a valid staff session and public booking APIs remain available to the separate website. Only administrators can access Settings or manage staff accounts. A maximum of two active administrator accounts is allowed, counting the environment-configured bootstrap administrator when it is a separate account; this limit does not apply to other roles. Admins and managers can verify payments, while receptionists cannot; chief accountants can verify payments. Managers have full system access except deleting rooms or reservations. The person who records a payment cannot verify that same payment. Reservation changes, rates, payments, verifications, folio charges, and operational records are audited.

Operations → Inventory is the stock register for hotel consumables and supplies; it is separate from bookable room inventory. Add an item with its SKU, category, unit of measure, opening quantity, reorder level, unit cost, and supplier. Use **Receive** for incoming stock, **Issue** when stock is used, and **Adjust** for a documented count correction. Each movement requires a reason, can include a delivery/issue reference, updates the current balance transactionally, and writes an audit record. The workspace shows stock value, low/out-of-stock alerts, and a dated movement ledger. Existing inventory items are retained when the ledger is introduced, with their current quantity recorded as a migration opening balance.

In Reservations, each active stay shows its remaining balance and has a **Record payment** action that carries the exact reservation reference into the payment form. Guests can submit partial/full M-Pesa amounts and transaction codes from their booking confirmation after contacting the hotel to confirm current payment details. The booking reference and guest email must match, amounts cannot exceed the remaining recordable balance, and duplicate transaction codes are rejected. Guest submissions are saved as pending and consume available-to-record balance until an independent verifier reviews them. The verifier can verify or reject a payment with a required reason; rejected payments are audited and no longer reserve any of the guest's available balance. The Payments workspace shows room and service charges, verified and pending amounts, balance due, and amount available to record.

Administrators can permanently delete individual reservations from Operations → Reservations and payments from Operations → Payments. Deleting a reservation also deletes its linked payment records and folio charges, releases its room-unit locks, removes linked reservation/payment notifications, and writes an audit event. Deleting a payment updates the reservation's balance and is audited. Other staff roles cannot use these delete actions, and the server enforces the role restriction. Deletion is permanent; retain a database backup before using it.

Every saved payment receives a unique, database-backed receipt number and an immutable charge/stay snapshot. The payment form opens its saved receipt preview after recording; Payments also provides Preview and Print actions for existing records, including guest-submitted M-Pesa payments after staff verification. Receipts show the actual transaction amount (including partial payments), itemized stay and posted folio charges, verified-to-date payments, pending payments, and the current remaining balance; an unverified submission is clearly marked and its balance is labelled as conditional on verification. The receipt identifies the staff member who recorded it and does not require a signature. For printing, select **A4**, **Portrait**, **Actual size / 100%**, and **No margins**; disable browser headers and footers. The 210 × 99 mm receipt is positioned at the top of the A4 page for trimming. Keep the A4 page size selected; the receipt stylesheet sets the A4 page and zero margins.

The protected Operations → Notifications workspace and the top-bar bell show new website bookings with guest, stay, room, and contact details; website enquiries with guest contact details and message; reservation status updates; and payment events. New events are checked every 12 seconds while the staff session is active. The bell shows unread counts, supports marking items read and clearing the feed, and offers an optional browser-generated alert sound; browsers require a user interaction to enable audio playback.

The staff workspace also includes **Check-outs Today** (`/operations/checkouts`). It reports the Nairobi-local date and exact guest total for checked-in reservations departing that day, and lists each reservation with the guest, contact details, assigned physical room codes, stay dates, and status. Daily checkout notifications are deduplicated and open this page when selected.

## Validation

```powershell
npm.cmd run lint
npm.cmd run build
```
