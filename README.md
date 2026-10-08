# PlotPark: Idle Land to Managed Parking (POC)

A React (Vite + TypeScript) proof of concept for the "Parking App for Idle Land" pilot: owners of idle urban land run it as a paid parking lot; the app brings drivers, bookings and payments, and takes a commission.

```bash
npm install
npm run dev      # http://localhost:5180
npm run build
```

## What's in the POC (the MVP column of the tech-platform table)

| Part | Route | What you can do |
|---|---|---|
| Driver app | `/driver` | Map of lots with live free slots, filter/sort, book by the hour, pay (UPI/card, sandbox), QR ticket, monthly pass (incl. corporate/RWA), "My tickets", report a problem |
| Owner app | `/owner` | Gate check-in/check-out by code or camera QR scan, cash walk-in counter, today's bookings, earnings and nightly payouts, rate the app, edit price/hours, pause listing, printable QR signboard |
| Owner onboarding | `/owner?new=1` | List a plot: map pin, slots, hours, suggested pricing, licence & land-use checklist, owner agreement → pending verification |
| Admin console | `/admin` | Pilot success metrics vs targets, roadmap gates, plot verification, disputes (resolve / refund), nightly split-payout job, economics calculator (5-plot pilot model), commission & convenience-fee settings |
| Signboard deep link | `/driver?plot=<id>` | What the QR board opens: jumps straight to booking that lot |

## Notes

- **Frontend only.** Data is seeded (5 live plots near Indiranagar Metro and CV Raman Nagar, plus 1 pending plot and 30 days of history) and persisted in `localStorage`. Use *Admin → Settings → Reset demo data* to start over.
- **Payments are simulated.** The checkout mimics a gateway with split payouts (commission deducted from the owner's share). For production, use Razorpay Route or Cashfree split payouts.
- **Map** uses Google Maps when `VITE_GOOGLE_MAPS_API_KEY` is set at build time, otherwise Leaflet + OpenStreetMap. See *Google Maps* below.
- Suggested production stack (from the doc): Spring Boot 3 + PostgreSQL/PostGIS, Razorpay/Cashfree, Airflow for nightly payout & occupancy jobs. `src/store/store.tsx` is the seam where API calls would replace local state.

## Deployment

Every push to `main` builds and deploys to GitHub Pages via `.github/workflows/deploy.yml` (pull requests build only).

## Google Maps

1. In [Google Cloud Console](https://console.cloud.google.com/): create a project, enable billing, and enable **Maps JavaScript API**.
2. Create an API key (APIs & Services → Credentials) and restrict it:
   - Application restriction: **HTTP referrers** → `http://localhost:5180/*` and `https://<user>.github.io/idle-parking-poc/*`
   - API restriction: **Maps JavaScript API** only
3. Local: `cp .env.example .env.local`, paste the key, restart `npm run dev`.
4. Deployed: add a repository secret `VITE_GOOGLE_MAPS_API_KEY` (Settings → Secrets and variables → Actions), then re-run the deploy workflow.
5. Optional: create a Map ID (Map Management) for custom styling and set `VITE_GOOGLE_MAPS_MAP_ID`; otherwise `DEMO_MAP_ID` is used.

Maps JavaScript keys are always visible in the browser; the referrer restriction is what protects them.
