import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Booking, Plot } from '../types'
import { addHours, dayKey, fmtDate, fmtDateTime, fmtTime, rupees } from '../lib/format'
import { appOccupied, freeSlotsAt, ownerPlots, useStore } from '../store/store'
import { Badge, Empty, Meter, Modal, Stat, Tabs } from '../components/ui'
import { parseTicketCode, STATUS_LABEL, STATUS_TONE } from '../components/Ticket'
import QrScanner, { canScan } from '../components/QrScanner'
import Signboard, { plotLink } from '../components/Signboard'
import ListPlotForm from '../components/ListPlotForm'

type Tab = 'today' | 'earnings' | 'plot' | 'add'
const OWNER_KEY = 'plotpark-owner'

export default function OwnerPage() {
  const { db } = useStore()
  const [params] = useSearchParams()
  const [ownerId, setOwnerId] = useState<string | null>(() => (params.get('new') ? null : localStorage.getItem(OWNER_KEY) ?? 'o1'))
  const [tab, setTab] = useState<Tab>(params.get('new') ? 'add' : 'today')
  const plots = ownerId ? ownerPlots(db, ownerId) : []
  const [plotId, setPlotId] = useState<string | null>(null)
  const plot = plots.find(p => p.id === plotId) ?? plots.find(p => p.status === 'live') ?? plots[0]
  const [submitted, setSubmitted] = useState<Plot | null>(null)

  const switchOwner = (id: string) => {
    setOwnerId(id || null)
    setPlotId(null)
    if (id) localStorage.setItem(OWNER_KEY, id)
    setTab(id ? 'today' : 'add')
  }

  const owner = db.owners.find(o => o.id === ownerId)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Owner app</h1>
          <p className="muted">Run your plot as a parking lot: check cars in and out, see today's bookings and your payouts.</p>
        </div>
        <label className="inline">
          <span className="muted small">Signed in as</span>
          <select value={ownerId ?? ''} onChange={e => switchOwner(e.target.value)}>
            {db.owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            <option value="">+ New landowner</option>
          </select>
        </label>
      </div>

      {plots.length > 1 && (
        <div className="row gap wrap">
          {plots.map(p => (
            <button key={p.id} className={`chip ${plot?.id === p.id ? 'on' : ''}`} onClick={() => setPlotId(p.id)}>{p.name}</button>
          ))}
        </div>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          ...(plot ? [{ id: 'today' as Tab, label: 'Today' }, { id: 'earnings' as Tab, label: 'Earnings & payouts' }, { id: 'plot' as Tab, label: 'My plot & QR board' }] : []),
          { id: 'add' as Tab, label: '+ List a plot' },
        ]}
      />

      {plot && plot.status !== 'live' && tab !== 'add' && (
        <div className={`notice ${plot.status === 'rejected' ? 'notice-bad' : ''}`}>
          {plot.status === 'pending' && 'This plot is waiting for verification by our team (usually within 2 working days). It will appear to drivers once approved.'}
          {plot.status === 'paused' && 'Listing paused. Drivers cannot book until you resume it.'}
          {plot.status === 'rejected' && `Listing not approved: ${plot.rejectionReason ?? 'see email'}`}
        </div>
      )}

      {tab === 'today' && plot && <Today plot={plot} />}
      {tab === 'earnings' && plot && owner && <Earnings ownerId={owner.id} />}
      {tab === 'plot' && plot && <MyPlot key={plot.id} plot={plot} />}
      {tab === 'add' && (
        <ListPlotForm
          ownerId={ownerId}
          onSubmitted={p => {
            setSubmitted(p)
            setOwnerId(p.ownerId)
            localStorage.setItem(OWNER_KEY, p.ownerId)
            setPlotId(p.id)
            setTab('plot')
          }}
        />
      )}

      {submitted && (
        <Modal title="Plot submitted" onClose={() => setSubmitted(null)}>
          <p><b>{submitted.name}</b> is with our team for verification. Next steps in your launch week:</p>
          <ol className="steps">
            <li>Document check: trade licence and land use (we call you within 2 days)</li>
            <li>Setup kit delivered: QR signboard{submitted.checklist.insurance ? '' : ', insurance options'}</li>
            <li>30-minute training on this owner screen</li>
            <li>Go live and start receiving bookings</li>
          </ol>
          <button className="btn btn-primary" onClick={() => setSubmitted(null)}>Got it</button>
        </Modal>
      )}
    </div>
  )
}

/* ---------------- Today: gate + bookings ---------------- */

function Today({ plot }: { plot: Plot }) {
  const { db, now, checkIn, checkOut, logWalkIn, walkInLeft, raiseDispute } = useStore()
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [scanning, setScanning] = useState(false)
  const [walkHours, setWalkHours] = useState(2)
  const [disputeFor, setDisputeFor] = useState<Booking | null>(null)

  const today = dayKey(now)
  const todays = db.bookings
    .filter(b => b.plotId === plot.id && (dayKey(b.start) === today || b.status === 'checked_in'))
    .sort((a, b) => a.start.localeCompare(b.start))
  const parkedApp = appOccupied(db, plot.id, now)
  const free = freeSlotsAt(db, plot, now)
  const earnedToday = todays.filter(b => b.status !== 'cancelled').reduce((a, b) => a + b.ownerPayout, 0)
  const walk = db.walkIns.find(w => w.plotId === plot.id && w.date === today)
  const passes = db.passes.filter(p => p.plotId === plot.id && new Date(p.validTo) > now)

  const gate = (action: 'in' | 'out', raw = code) => {
    const c = parseTicketCode(raw)
    if (!c) return
    if (action === 'in' && passes.some(p => p.code === c)) {
      setMsg({ ok: true, text: `Monthly pass ${c} is valid. Let the car in.` })
      setCode('')
      return
    }
    const r = action === 'in' ? checkIn(plot.id, c) : checkOut(plot.id, c)
    setMsg(r.ok ? { ok: true, text: `${action === 'in' ? 'Checked in' : 'Checked out'} ${r.value.vehicleNo} (${r.value.driverName})` } : { ok: false, text: r.error })
    if (r.ok) setCode('')
  }

  const onScan = useCallback((text: string) => {
    setScanning(false)
    setCode(parseTicketCode(text))
  }, [])

  return (
    <div className="stack">
      <div className="stats">
        <Stat label="Free slots now" value={`${free} / ${plot.totalSlots}`} sub={<Meter value={plot.totalSlots - free} max={plot.totalSlots} />} />
        <Stat label="App cars on lot" value={parkedApp} sub={`${todays.filter(b => b.status === 'booked').length} more booked today`} />
        <Stat label="Cash walk-ins on lot" value={plot.walkInsNow} sub={`${walk?.cars ?? 0} today · ${rupees(walk?.amount ?? 0)} cash`} />
        <Stat label="App earnings today" value={rupees(earnedToday)} sub="after commission, paid out tonight" />
      </div>

      <div className="grid-2 align-start">
        <div className="card">
          <h3>Gate: check in / check out</h3>
          <p className="small muted">Scan the driver's ticket QR or type the 6-letter code. Monthly passes are checked too.</p>
          <div className="row gap">
            <input className="mono code-input" placeholder="CODE" value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && gate('in')} aria-label="Ticket code" />
            {canScan() && <button className="btn" onClick={() => setScanning(true)}>Scan QR</button>}
          </div>
          {scanning && <QrScanner onResult={onScan} onClose={() => setScanning(false)} />}
          <div className="row gap">
            <button className="btn btn-primary" onClick={() => gate('in')} disabled={!code}>Check in</button>
            <button className="btn" onClick={() => gate('out')} disabled={!code}>Check out</button>
          </div>
          {msg && <p className={msg.ok ? 'success-line' : 'error'}>{msg.text}</p>}
        </div>

        <div className="card">
          <h3>Cash walk-ins</h3>
          <p className="small muted">Log drivers who pay you directly so the free-slot count stays right for app users.</p>
          <div className="row gap">
            <select value={walkHours} onChange={e => setWalkHours(Number(e.target.value))} aria-label="Hours">
              {[1, 2, 3, 4, 6, 8].map(h => <option key={h} value={h}>{h} h · {rupees(h * plot.pricePerHour)}</option>)}
            </select>
            <button className="btn" onClick={() => logWalkIn(plot.id, walkHours)}>+ Car in</button>
            <button className="btn btn-ghost" disabled={!plot.walkInsNow} onClick={() => walkInLeft(plot.id)}>− Car left</button>
          </div>
          <p className="small muted">Tip: drivers who book in the app get a guaranteed slot and you get paid automatically, with no cash to count.</p>
        </div>
      </div>

      <div className="card">
        <h3>Today's bookings</h3>
        {todays.length === 0 ? <Empty>No bookings today yet.</Empty> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Code</th><th>Vehicle</th><th>Driver</th><th>Time</th><th>Your share</th><th>Status</th><th /></tr></thead>
              <tbody>
                {todays.map(b => {
                  const overdue = b.status === 'checked_in' && new Date(addHours(b.start, b.hours)) < now
                  return (
                    <tr key={b.id}>
                      <td className="mono">{b.code}</td>
                      <td className="mono">{b.vehicleNo}</td>
                      <td>{b.driverName}{b.channel === 'whatsapp' && <Badge tone="info">WhatsApp</Badge>}</td>
                      <td>{fmtTime(b.start)}–{fmtTime(addHours(b.start, b.hours))}</td>
                      <td>{rupees(b.ownerPayout)}</td>
                      <td>
                        <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                        {overdue && <Badge tone="warn">Overstay</Badge>}
                      </td>
                      <td className="actions">
                        {b.status === 'booked' && <button className="btn btn-sm" onClick={() => gate('in', b.code)}>Check in</button>}
                        {b.status === 'checked_in' && <button className="btn btn-sm" onClick={() => gate('out', b.code)}>Check out</button>}
                        {b.status !== 'cancelled' && <button className="btn btn-sm btn-ghost" onClick={() => setDisputeFor(b)}>Report</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {passes.length > 0 && (
        <div className="card">
          <h3>Active monthly passes ({passes.length})</h3>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Code</th><th>Vehicle</th><th>Holder</th><th>Company</th><th>Valid till</th></tr></thead>
              <tbody>
                {passes.map(p => (
                  <tr key={p.id}><td className="mono">{p.code}</td><td className="mono">{p.vehicleNo}</td><td>{p.holderName}</td><td>{p.corporateClient ?? '—'}</td><td>{fmtDate(p.validTo)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {disputeFor && <DisputeDialog booking={disputeFor} onClose={() => setDisputeFor(null)} onSend={r => { raiseDispute(disputeFor.id, 'owner', r); setDisputeFor(null) }} />}
    </div>
  )
}

function DisputeDialog({ booking, onSend, onClose }: { booking: Booking; onSend: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState('')
  return (
    <Modal title={`Report booking ${booking.code}`} onClose={onClose}>
      <div className="form">
        <p className="small muted">{booking.vehicleNo} · {fmtDateTime(booking.start)}. Our support team will contact the driver.</p>
        <textarea rows={3} placeholder="e.g. overstayed by 2 hours, damaged the gate…" value={reason} onChange={e => setReason(e.target.value)} />
        <button className="btn btn-primary" disabled={!reason.trim()} onClick={() => onSend(reason.trim())}>Send to support</button>
      </div>
    </Modal>
  )
}

/* ---------------- Earnings ---------------- */

function Earnings({ ownerId }: { ownerId: string }) {
  const { db, now, rateApp } = useStore()
  const plotIds = new Set(ownerPlots(db, ownerId).map(p => p.id))
  const bookings = db.bookings.filter(b => plotIds.has(b.plotId) && b.status !== 'cancelled')
  const passes = db.passes.filter(p => plotIds.has(p.plotId))
  const since = now.getTime() - 30 * 86_400_000
  const last30 = bookings.filter(b => new Date(b.start).getTime() >= since)
  const gross = last30.reduce((a, b) => a + b.amount, 0) + passes.filter(p => new Date(p.createdAt).getTime() >= since).reduce((a, p) => a + p.amount, 0)
  const commission = last30.reduce((a, b) => a + b.commission, 0) + passes.filter(p => new Date(p.createdAt).getTime() >= since).reduce((a, p) => a + p.commission, 0)
  const pending = bookings.filter(b => b.status === 'completed' && !b.payoutId).reduce((a, b) => a + b.ownerPayout, 0) + passes.filter(p => !p.payoutId).reduce((a, p) => a + p.ownerPayout, 0)
  const payouts = db.payouts.filter(p => p.ownerId === ownerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const owner = db.owners.find(o => o.id === ownerId)!

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (13 - i))
    const key = dayKey(d)
    const app = bookings.filter(b => dayKey(b.start) === key).reduce((a, b) => a + b.ownerPayout, 0)
    const cash = db.walkIns.filter(w => plotIds.has(w.plotId) && w.date === key).reduce((a, w) => a + w.amount, 0)
    return { key, label: d.toLocaleDateString('en-IN', { day: 'numeric' }), app, cash }
  })
  const max = Math.max(...days.map(d => d.app + d.cash), 1)

  return (
    <div className="stack">
      <div className="stats">
        <Stat label="App bookings (30 days)" value={rupees(gross)} sub={`${last30.length} bookings`} />
        <Stat label={`Commission (${db.settings.commissionPct}%)`} value={`− ${rupees(commission)}`} />
        <Stat label="Your net (30 days)" value={rupees(gross - commission)} tone="good" />
        <Stat label="Next payout (tonight)" value={rupees(pending)} sub="auto-transfer to your bank" />
      </div>

      <div className="card">
        <div className="row-between">
          <h3>Last 14 days</h3>
          <div className="legend small"><span className="sw sw-app" /> App (net) <span className="sw sw-cash" /> Cash walk-ins</div>
        </div>
        <div className="bars" role="img" aria-label="Daily earnings, last 14 days">
          {days.map(d => (
            <div key={d.key} className="bar-col" title={`${d.key}: app ${rupees(d.app)}, cash ${rupees(d.cash)}`}>
              <div className="bar-stack" style={{ height: `${((d.app + d.cash) / max) * 100}%` }}>
                <div className="bar-cash" style={{ flex: d.cash }} />
                <div className="bar-app" style={{ flex: d.app }} />
              </div>
              <span>{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2 align-start">
        <div className="card">
          <h3>Payouts</h3>
          {payouts.length === 0 ? <Empty>No payouts yet.</Empty> : (
            <div className="table-wrap scroll-y">
              <table className="table">
                <thead><tr><th>Date</th><th>Items</th><th>Gross</th><th>Commission</th><th>Paid</th><th>UTR</th></tr></thead>
                <tbody>
                  {payouts.map(p => (
                    <tr key={p.id}><td>{fmtDate(p.createdAt)}</td><td>{p.items}</td><td>{rupees(p.gross)}</td><td>−{rupees(p.commission)}</td><td><b>{rupees(p.amount)}</b></td><td className="mono small">{p.utr}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card">
          <h3>How are we doing?</h3>
          <p className="small muted">Rate the app. This is one of our pilot success measures.</p>
          <div className="stars" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} role="radio" aria-checked={owner.appRating === n} className={(owner.appRating ?? 0) >= n ? 'on' : ''} onClick={() => rateApp(ownerId, n)}>★</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------- My plot ---------------- */

function MyPlot({ plot }: { plot: Plot }) {
  const { updatePlot } = useStore()
  const [f, setF] = useState({ pricePerHour: plot.pricePerHour, monthlyPassPrice: plot.monthlyPassPrice, totalSlots: plot.totalSlots, opensAt: plot.opensAt, closesAt: plot.closesAt })
  const [saved, setSaved] = useState(false)
  const dirty = (Object.keys(f) as (keyof typeof f)[]).some(k => f[k] !== plot[k])

  return (
    <div className="grid-2 align-start">
      <div className="card">
        <h3>Listing</h3>
        <form className="form" onSubmit={e => { e.preventDefault(); updatePlot(plot.id, f); setSaved(true) }}>
          <div className="grid-2">
            <label>Price per hour (₹)<input type="number" min={5} value={f.pricePerHour} onChange={e => { setF({ ...f, pricePerHour: Number(e.target.value) }); setSaved(false) }} /></label>
            <label>Monthly pass (₹)<input type="number" min={100} step={100} value={f.monthlyPassPrice} onChange={e => { setF({ ...f, monthlyPassPrice: Number(e.target.value) }); setSaved(false) }} /></label>
          </div>
          <div className="grid-3">
            <label>Slots<input type="number" min={1} value={f.totalSlots} onChange={e => { setF({ ...f, totalSlots: Number(e.target.value) }); setSaved(false) }} /></label>
            <label>Opens<input type="time" value={f.opensAt} onChange={e => { setF({ ...f, opensAt: e.target.value }); setSaved(false) }} /></label>
            <label>Closes<input type="time" value={f.closesAt} onChange={e => { setF({ ...f, closesAt: e.target.value }); setSaved(false) }} /></label>
          </div>
          <div className="row gap">
            <button className="btn btn-primary" disabled={!dirty}>Save changes</button>
            {saved && !dirty && <span className="text-good small">Saved</span>}
          </div>
        </form>
        <hr />
        <h4>Compliance</h4>
        <ul className="checklist">
          <li className={plot.checklist.tradeLicence ? 'ok' : 'no'}>Trade licence</li>
          <li className={plot.checklist.landUseAllowsParking ? 'ok' : 'no'}>Land use allows parking</li>
          <li className={plot.checklist.notAgricultural ? 'ok' : 'no'}>Not agricultural land</li>
          <li className={plot.checklist.insurance ? 'ok' : 'warn'}>Liability insurance {plot.checklist.insurance ? '' : '(recommended)'}</li>
        </ul>
        {plot.status === 'live' && <button className="btn btn-ghost" onClick={() => updatePlot(plot.id, { status: 'paused' })}>Pause listing</button>}
        {plot.status === 'paused' && <button className="btn" onClick={() => updatePlot(plot.id, { status: 'live' })}>Resume listing</button>}
      </div>
      <div className="card center">
        <h3>QR signboard</h3>
        <p className="small muted">Put this at your gate. Drivers scan it to book and pay. Part of your free setup kit.</p>
        <Signboard plot={plot} />
        <div className="row gap center">
          <button className="btn" onClick={() => window.print()}>Print board</button>
          <a className="btn btn-ghost" href={plotLink(plot)} target="_blank" rel="noreferrer">Open driver link</a>
        </div>
      </div>
    </div>
  )
}
