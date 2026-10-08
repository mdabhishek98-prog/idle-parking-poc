import { Link } from 'react-router-dom'
import { rupees } from '../lib/format'
import { freeSlotsAt, useStore } from '../store/store'

export default function HomePage() {
  const { db, now } = useStore()
  const live = db.plots.filter(p => p.status === 'live')
  const free = live.reduce((a, p) => a + freeSlotsAt(db, p, now), 0)
  const minPrice = Math.min(...live.map(p => p.pricePerHour))

  return (
    <div className="page home">
      <section className="hero">
        <div>
          <span className="eyebrow">Pilot · Bengaluru</span>
          <h1>Turn idle land into a paid parking lot in a week.</h1>
          <p className="lead">
            Owners keep and run their plots. We bring the drivers, bookings and UPI payments, and take a small commission. No land rent, no staff, no setup cost.
          </p>
          <div className="row gap wrap">
            <Link className="btn btn-primary btn-lg" to="/driver">Find parking</Link>
            <Link className="btn btn-lg" to="/owner?new=1">List your land</Link>
          </div>
        </div>
        <div className="hero-stats">
          <div><b>{live.length}</b><span>live lots</span></div>
          <div><b>{free}</b><span>slots free now</span></div>
          <div><b>{rupees(minPrice)}</b><span>per hour from</span></div>
          <div><b>{100 - db.settings.commissionPct}%</b><span>goes to the owner</span></div>
        </div>
      </section>

      <section className="roles">
        <Link to="/driver" className="role">
          <span className="role-tag">Drivers</span>
          <h3>Find, book, pay</h3>
          <p>Map with live free slots. Book a slot, pay by UPI or card, show a QR at the gate. Monthly passes for daily commuters.</p>
        </Link>
        <Link to="/owner" className="role">
          <span className="role-tag">Landowners</span>
          <h3>Run the lot from your phone</h3>
          <p>List the plot with a suggested price, print the QR board, check cars in and out, and get automatic payouts every night.</p>
        </Link>
        <Link to="/admin" className="role">
          <span className="role-tag">Our team</span>
          <h3>Admin console</h3>
          <p>Verify licences and land use, resolve disputes, run payouts, and track the pilot against its success targets.</p>
        </Link>
      </section>

      <section className="card">
        <h2>How it works</h2>
        <ol className="how">
          <li><b>List.</b> Owner lists the plot with photos, slots, hours and price.</li>
          <li><b>Launch kit.</b> QR signboard, suggested pricing and this owner screen for check-in and check-out.</li>
          <li><b>Book.</b> Drivers find, book and pay in the app (UPI, cards), or buy a monthly pass.</li>
          <li><b>Get paid.</b> Payments go through a regulated gateway; owners get automatic payouts minus our commission.</li>
          <li><b>Track.</b> Owners see bookings, earnings and occupancy on a dashboard.</li>
        </ol>
      </section>

      <p className="small muted disclaimer">
        Proof-of-concept build. Data is simulated and stored in this browser; payments use a sandbox, so no real money moves.
      </p>
    </div>
  )
}
