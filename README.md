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
- **Map** uses Leaflet + OpenStreetMap tiles. The doc suggests Google Maps for production.
- Suggested production stack (from the doc): Spring Boot 3 + PostgreSQL/PostGIS, Razorpay/Cashfree, Airflow for nightly payout & occupancy jobs. `src/store/store.tsx` is the seam where API calls would replace local state.

## Deployment

Every push to `main` builds and deploys to GitHub Pages via `.github/workflows/deploy.yml` (pull requests build only).
