<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Priority: separate public website and staff booking system

- The repository root is the hotel staff booking/operations system and is deployed at `https://portal.happylandhoteldiani.co.ke`.
- `C:\dni` is a separate Next.js public website project, deployed independently at `https://happylandhoteldiani.co.ke`. Treat it as its own application and deployment; do not merge its files into the root app or deploy it at the portal subdomain.
- The root booking system is the single source of truth for room inventory, rates, availability, room descriptions/photos, enquiries, and reservations. The `C:\dni` website must fetch public content and proxy availability, enquiry, and booking requests to it using `BOOKING_SYSTEM_URL`.
- Model physical inventory as bookable room categories: Studio, 1-bedroom, and 2-bedroom. Adding a category with a count creates that many individual physical room units; each unit has its own room code and independently editable capacity, beds, rates, description, and amenities. Only the photo gallery is shared by units in the same category. Three-bedroom accommodations are virtual combinations, not a physical category. Keep exterior/drone photos in the property gallery, separate from room photos.
- The supplied starter inventory is exactly 20 physical units: 5 studios, 10 one-bedroom units, and 5 two-bedroom units. The three-bedroom products are virtual combinations A2+A3, C2+C3, and D2+D3; never create or count a separate physical three-bedroom room. A combination booking must lock every component unit for the full stay, and cancellation must release all of them.
- Internal unit codes and staff-only data must stay out of public APIs and website pages. Staff can see and manage the component units; public guests book a combination using its accommodation slug.
- Store and serve room photos under separate category directories below `HOTEL_MEDIA_PATH` (default `data/room-media/{category-slug}/`); preserve category-specific image URLs in the public API.
- Never add a second production inventory/reservation database to the website project, synchronize SQLite files between deployments, or show stale hard-coded room stock/photos as live data. A website booking must be saved by the staff system and appear in its reservations workspace as source `Website`.
- Keep this integration a high-priority requirement in future work. Changes to the public API, booking payloads, room photo URLs, or deployment domains must be coordinated across both projects and their README/environment instructions.
- Permanent deletion of reservations and payments is admin-only, enforced in server routes. Deleting a reservation must remove linked payments and folio charges transactionally, release inventory links, and preserve an audit event. Do not delete production data unless specifically asked.
