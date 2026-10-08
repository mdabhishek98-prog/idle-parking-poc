import { useSearchParams } from 'react-router-dom'
import { Tabs } from '../components/ui'

/** Interactive flow diagrams generated with Archify from the specs in /diagrams. */
const DIAGRAMS = [
  { id: 'journey', file: 'plotpark-flow.html', label: 'End-to-end journey', blurb: 'How a plot goes from listing to verification, bookings and the owner’s nightly payout.' },
  { id: 'booking', file: 'booking-payment.html', label: 'Booking & payment', blurb: 'Step by step: slot check, split payment, QR ticket, gate check-in/out and settlement.' },
  { id: 'status', file: 'booking-status.html', label: 'Booking status', blurb: 'Every status a booking can be in, including overstays, disputes, cancellations and refunds.' },
] as const

type Id = (typeof DIAGRAMS)[number]['id']

export default function FlowPage() {
  const [params, setParams] = useSearchParams()
  const current = DIAGRAMS.find(d => d.id === params.get('d')) ?? DIAGRAMS[0]
  const src = `${import.meta.env.BASE_URL}flow/${current.file}`

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>How PlotPark works</h1>
          <p className="muted">{current.blurb} Click a box to see its details, or use Path to trace a route.</p>
        </div>
        <a className="btn btn-sm" href={src} target="_blank" rel="noreferrer">Open full screen ↗</a>
      </div>
      <Tabs<Id> value={current.id} onChange={id => setParams({ d: id }, { replace: true })} items={DIAGRAMS.map(d => ({ id: d.id, label: d.label }))} />
      <iframe key={current.id} className="flow-frame" src={src} title={current.label} />
    </div>
  )
}
