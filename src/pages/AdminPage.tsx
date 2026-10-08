import { useState } from 'react'
import type { Payout } from '../types'
import { fmtDate, fmtDateTime, rupees } from '../lib/format'
import { actuals, DOC_ASSUMPTIONS, economics, pilotMetrics, type Economics } from '../lib/metrics'
import { DEMAND_LABEL } from '../lib/pricing'
import { freeSlotsAt, useStore } from '../store/store'
import PlotMap from '../components/PlotMap'
import { Badge, Empty, Meter, Stat, Tabs } from '../components/ui'

type Tab = 'pilot' | 'verify' | 'disputes' | 'payouts' | 'economics' | 'settings'

export default function AdminPage() {
  const { db } = useStore()
  const [tab, setTab] = useState<Tab>('pilot')
  const pending = db.plots.filter(p => p.status === 'pending').length
  const open = db.disputes.filter(d => d.status === 'open').length
  const count = (n: number) => (n ? <span className="count">{n}</span> : null)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Admin console</h1>
          <p className="muted">Onboard owners, verify documents, handle disputes and track the 5-plot Bengaluru pilot.</p>
        </div>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'pilot', label: 'Pilot dashboard' },
          { id: 'verify', label: <>Verification {count(pending)}</> },
          { id: 'disputes', label: <>Disputes {count(open)}</> },
          { id: 'payouts', label: 'Payouts' },
          { id: 'economics', label: 'Economics' },
          { id: 'settings', label: 'Settings' },
        ]}
      />
      {tab === 'pilot' && <Pilot />}
      {tab === 'verify' && <Verify />}
      {tab === 'disputes' && <Disputes />}
      {tab === 'payouts' && <Payouts />}
      {tab === 'economics' && <EconomicsView />}
      {tab === 'settings' && <SettingsView />}
    </div>
  )
}

const PHASES = [
  { name: '1. Pilot', when: 'Months 0–3', items: ['5 plots, one area', 'Web app, UPI', 'Commission only'], gate: '4 of 5 owners stay · 40% app bookings' },
  { name: '2. Cluster', when: 'Months 4–8', items: ['25 plots, one zone', 'Driver + owner apps', 'Corporate passes'], gate: 'Commission covers running costs' },
  { name: '3. City', when: 'Months 8–18', items: ['300+ plots, Bengaluru', 'Owner subscription', 'Pricing engine'], gate: 'Profit holds at 300 plots' },
  { name: '4. Scale', when: 'Month 18 onward', items: ['Hyderabad, Pune', 'Setup kits, EV, ads', 'Raise funding'] },
]

function Pilot() {
  const { db, now } = useStore()
  const metrics = pilotMetrics(db, now)
  const passed = metrics.filter(m => m.pass).length
  const gate1 = metrics[0].pass && metrics[1].pass
  const live = db.plots.filter(p => p.status === 'live')
  const act = actuals(db, now)

  return (
    <div className="stack">
      <div className="card">
        <div className="row-between">
          <h3>Success metrics: target to continue past week 12</h3>
          <Badge tone={passed === metrics.length ? 'good' : 'warn'}>{passed} of {metrics.length} on track</Badge>
        </div>
        <div className="metrics">
          {metrics.map(m => (
            <div key={m.label} className={`metric ${m.pass ? 'pass' : 'fail'}`}>
              <div className="metric-label">{m.label}</div>
              <div className="metric-value">{m.display}</div>
              <div className="metric-target">{m.pass ? '✓' : '✗'} target {m.target}</div>
              <div className="small muted">{m.hint}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="stats">
        <Stat label="App GMV (30 days)" value={rupees(act.gmv)} sub={`${act.bookings} bookings · ${act.passes} passes`} />
        <Stat label="Our commission (30 days)" value={rupees(act.commission)} tone="good" />
        <Stat label="Live plots" value={live.length} sub={`${db.plots.filter(p => p.status === 'pending').length} awaiting verification`} />
        <Stat label="Cars on lots now" value={live.reduce((a, p) => a + p.totalSlots - freeSlotsAt(db, p, now), 0)} sub={`of ${live.reduce((a, p) => a + p.totalSlots, 0)} slots`} />
      </div>

      <div className="grid-2 align-start">
        <div className="card">
          <h3>Plots</h3>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Plot</th><th>Type</th><th>Occupancy now</th><th>Status</th></tr></thead>
              <tbody>
                {db.plots.map(p => {
                  const occ = p.totalSlots - freeSlotsAt(db, p, now)
                  return (
                    <tr key={p.id}>
                      <td>{p.name}<div className="small muted">{db.owners.find(o => o.id === p.ownerId)?.name}</div></td>
                      <td>{DEMAND_LABEL[p.demandType]}</td>
                      <td style={{ minWidth: 120 }}>{p.status === 'live' ? <><Meter value={occ} max={p.totalSlots} /><span className="small">{occ}/{p.totalSlots}</span></> : '—'}</td>
                      <td><Badge tone={p.status === 'live' ? 'good' : p.status === 'pending' ? 'warn' : p.status === 'rejected' ? 'bad' : 'neutral'}><span className="cap">{p.status}</span></Badge></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h3>Pilot area</h3>
          <PlotMap pins={db.plots.map(p => ({ plot: p, free: freeSlotsAt(db, p, now) }))} height={300} />
        </div>
      </div>

      <div className="card">
        <h3>Growth roadmap: each phase opens only when the last one proves out</h3>
        <div className="roadmap">
          {PHASES.map((ph, i) => (
            <div key={ph.name} className="phase-wrap">
              <div className={`phase ${i === 0 ? 'current' : ''}`}>
                <b>{ph.name}</b>
                <div className="small muted">{ph.when}</div>
                <ul>{ph.items.map(it => <li key={it}>{it}</li>)}</ul>
              </div>
              {ph.gate && (
                <div className={`gate ${i === 0 ? (gate1 ? 'gate-pass' : 'gate-wait') : ''}`}>
                  <span className="diamond" />
                  <span className="small">{ph.gate}{i === 0 && (gate1 ? ' · passing' : ' · not yet')}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Verify() {
  const { db, reviewPlot } = useStore()
  const [reason, setReason] = useState<Record<string, string>>({})
  const pending = db.plots.filter(p => p.status === 'pending')
  const reviewed = db.plots.filter(p => p.status === 'rejected')

  return (
    <div className="stack">
      {pending.length === 0 && <Empty>No plots waiting for verification. New listings from the owner app show up here.</Empty>}
      {pending.map(p => {
        const owner = db.owners.find(o => o.id === p.ownerId)
        const c = p.checklist
        const blocking = !c.tradeLicence || !c.landUseAllowsParking || !c.notAgricultural
        return (
          <div key={p.id} className="card">
            <div className="row-between">
              <div>
                <h3>{p.name}</h3>
                <p className="muted small">{p.address} · {p.zone} · submitted {fmtDateTime(p.createdAt)}</p>
              </div>
              <Badge tone="warn">Pending</Badge>
            </div>
            <div className="grid-3">
              <div><div className="small muted">Owner</div>{owner?.name}<div className="small">{owner?.phone}</div></div>
              <div><div className="small muted">Plot</div>{p.totalSlots} slots · {DEMAND_LABEL[p.demandType]}<div className="small">{p.opensAt}–{p.closesAt}</div></div>
              <div><div className="small muted">Price</div>{rupees(p.pricePerHour)}/h · pass {rupees(p.monthlyPassPrice)}</div>
            </div>
            <ul className="checklist">
              <li className={c.tradeLicence ? 'ok' : 'no'}>Trade licence from city corporation</li>
              <li className={c.landUseAllowsParking ? 'ok' : 'no'}>Land use allows parking</li>
              <li className={c.notAgricultural ? 'ok' : 'no'}>Not agricultural land</li>
              <li className={c.insurance ? 'ok' : 'warn'}>Liability insurance (recommended)</li>
            </ul>
            <p className="small muted">Before approving, confirm the licence and land-use documents on a call or site visit.</p>
            <div className="row gap wrap">
              <button className="btn btn-primary" disabled={blocking} onClick={() => reviewPlot(p.id, true)}>Approve & go live</button>
              <input placeholder="Reason for rejection" value={reason[p.id] ?? ''} onChange={e => setReason({ ...reason, [p.id]: e.target.value })} />
              <button className="btn btn-ghost" disabled={!reason[p.id]?.trim()} onClick={() => reviewPlot(p.id, false, reason[p.id])}>Reject</button>
            </div>
          </div>
        )
      })}
      {reviewed.length > 0 && (
        <div className="card">
          <h3>Rejected</h3>
          {reviewed.map(p => (
            <div key={p.id} className="row-between">
              <span>{p.name} <span className="muted small">· {p.rejectionReason}</span></span>
              <button className="btn btn-sm" onClick={() => reviewPlot(p.id, true)}>Approve anyway</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Disputes() {
  const { db, resolveDispute } = useStore()
  const [note, setNote] = useState<Record<string, string>>({})
  const list = [...db.disputes].sort((a, b) => (a.status === b.status ? b.createdAt.localeCompare(a.createdAt) : a.status === 'open' ? -1 : 1))

  if (!list.length) return <Empty>No disputes.</Empty>
  return (
    <div className="stack">
      {list.map(d => {
        const b = db.bookings.find(x => x.id === d.bookingId)
        const plot = db.plots.find(p => p.id === b?.plotId)
        return (
          <div key={d.id} className="card">
            <div className="row-between">
              <div>
                <b>Raised by {d.raisedBy}</b> <span className="muted small">· {fmtDateTime(d.createdAt)}</span>
              </div>
              <Badge tone={d.status === 'open' ? 'warn' : 'good'}><span className="cap">{d.status}</span></Badge>
            </div>
            <p>"{d.reason}"</p>
            {b && (
              <p className="small muted">
                Booking <span className="mono">{b.code}</span> · {b.vehicleNo} · {b.driverName} · {plot?.name} · {fmtDateTime(b.start)}, {b.hours} h · {rupees(b.amount)}
              </p>
            )}
            {d.status === 'resolved' ? (
              <p className="small"><b>Resolution:</b> {d.resolution}</p>
            ) : (
              <div className="row gap wrap">
                <input placeholder="Resolution note" value={note[d.id] ?? ''} onChange={e => setNote({ ...note, [d.id]: e.target.value })} style={{ flex: 1, minWidth: 200 }} />
                <button className="btn" disabled={!note[d.id]?.trim()} onClick={() => resolveDispute(d.id, note[d.id], false)}>Resolve</button>
                <button className="btn btn-primary" disabled={!note[d.id]?.trim() || !!b?.payoutId} title={b?.payoutId ? 'Already paid out to owner' : ''} onClick={() => resolveDispute(d.id, note[d.id], true)}>Resolve & refund</button>
              </div>
            )}
          </div>
        )
      })}
      <p className="small muted">Terms: the owner operates the lot; PlotPark provides booking only. Damage and theft claims go to the owner's insurance.</p>
    </div>
  )
}

function Payouts() {
  const { db, runPayouts } = useStore()
  const [last, setLast] = useState<Payout[] | null>(null)
  const unpaidB = db.bookings.filter(b => b.status === 'completed' && !b.payoutId)
  const unpaidP = db.passes.filter(p => !p.payoutId)
  const due = unpaidB.reduce((a, b) => a + b.ownerPayout, 0) + unpaidP.reduce((a, p) => a + p.ownerPayout, 0)
  const commission = unpaidB.reduce((a, b) => a + b.commission, 0) + unpaidP.reduce((a, p) => a + p.commission, 0)
  const history = [...db.payouts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40)
  const name = (id: string) => db.owners.find(o => o.id === id)?.name ?? id

  return (
    <div className="stack">
      <div className="card">
        <div className="row-between wrap">
          <div>
            <h3>Nightly payout job</h3>
            <p className="small muted">Settles completed bookings and passes through the gateway's split payouts. Owners get their share; commission stays with us. We never hold owners' money.</p>
          </div>
          <button className="btn btn-primary" disabled={!due} onClick={() => setLast(runPayouts())}>Run payout job now</button>
        </div>
        <div className="stats">
          <Stat label="Owed to owners" value={rupees(due)} sub={`${unpaidB.length} bookings · ${unpaidP.length} passes`} />
          <Stat label="Our commission in this run" value={rupees(commission)} tone="good" />
        </div>
        {last && (
          <p className="success-line">
            {last.length ? `Paid ${last.length} owner${last.length > 1 ? 's' : ''}: ${last.map(p => `${name(p.ownerId)} ${rupees(p.amount)}`).join(', ')}` : 'Nothing to pay.'}
          </p>
        )}
      </div>
      <div className="card">
        <h3>Recent payouts</h3>
        <div className="table-wrap scroll-y">
          <table className="table">
            <thead><tr><th>Date</th><th>Owner</th><th>Items</th><th>Gross</th><th>Commission</th><th>Paid to owner</th><th>UTR</th></tr></thead>
            <tbody>
              {history.map(p => (
                <tr key={p.id}><td>{fmtDate(p.createdAt)}</td><td>{name(p.ownerId)}</td><td>{p.items}</td><td>{rupees(p.gross)}</td><td>{rupees(p.commission)}</td><td><b>{rupees(p.amount)}</b></td><td className="mono small">{p.utr}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function EconomicsView() {
  const { db, now } = useStore()
  const [e, setE] = useState<Economics>({ ...DOC_ASSUMPTIONS, commissionPct: db.settings.commissionPct })
  const r = economics(e)
  const act = actuals(db, now)
  const field = (k: keyof Economics, label: string, step = 1, scale = 1) => (
    <label>
      {label}
      <input type="number" step={step} value={Math.round(e[k] * scale * 100) / 100} onChange={ev => setE({ ...e, [k]: Number(ev.target.value) / scale })} />
    </label>
  )

  return (
    <div className="grid-2 align-start">
      <div className="card">
        <h3>Assumptions</h3>
        <p className="small muted">Defaults are the 5-plot pilot assumptions. All figures are estimates to validate, not market data.</p>
        <div className="form grid-2">
          {field('plots', 'Plots')}
          {field('slots', 'Car slots per plot')}
          {field('rate', '₹ per hour')}
          {field('paidHours', 'Paid hours / slot / day', 0.5)}
          {field('appShare', '% booked through app', 5, 100)}
          {field('commissionPct', 'Commission %', 1)}
          {field('hosting', 'Cloud, maps, SMS ₹/mo', 500)}
          {field('marketing', 'Local marketing ₹/mo', 500)}
          {field('fieldHelp', 'Field onboarding help ₹/mo', 500)}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setE({ ...DOC_ASSUMPTIONS, commissionPct: db.settings.commissionPct })}>Reset to pilot assumptions</button>
      </div>
      <div className="card">
        <h3>Monthly result</h3>
        <table className="kv big-kv">
          <tbody>
            <tr><td>Total parking value ({e.plots} × {e.slots} × {e.paidHours} h × ₹{e.rate} × 30)</td><td>{rupees(r.totalValue)}</td></tr>
            <tr><td>Booked through the app ({Math.round(e.appShare * 100)}%)</td><td>{rupees(r.viaApp)}</td></tr>
            <tr className="strong"><td>Our commission ({e.commissionPct}%)</td><td>{rupees(r.commission)}</td></tr>
            <tr><td>Cloud hosting, maps, SMS</td><td>− {rupees(e.hosting)}</td></tr>
            <tr><td>Local marketing</td><td>− {rupees(e.marketing)}</td></tr>
            <tr><td>Field help for owner onboarding</td><td>− {rupees(e.fieldHelp)}</td></tr>
            <tr className={`strong ${r.result >= 0 ? 'text-good' : 'text-bad'}`}><td>Operating result</td><td>{rupees(r.result)}</td></tr>
          </tbody>
        </table>
        <p className="small muted">Each extra plot adds about {rupees(r.perExtraPlot)}/month in commission with little extra cost. Break-even at about {r.perExtraPlot ? Math.ceil(r.costs / r.perExtraPlot) : '—'} plots.</p>
        <hr />
        <h4>Actual pilot data, last 30 days</h4>
        <table className="kv">
          <tbody>
            <tr><td>App GMV (bookings + passes)</td><td>{rupees(act.gmv)}</td></tr>
            <tr><td>Commission earned</td><td>{rupees(act.commission)}</td></tr>
            <tr><td>vs model commission</td><td>{r.commission ? `${Math.round((act.commission / r.commission) * 100)}%` : '—'}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SettingsView() {
  const { db, updateSettings, reset } = useStore()
  return (
    <div className="card narrow">
      <h3>Platform settings</h3>
      <div className="form">
        <label>
          Booking commission (%) <span className="small muted">deducted from owner payout · plan: 10–20%</span>
          <input type="number" min={0} max={30} value={db.settings.commissionPct} onChange={e => updateSettings({ commissionPct: Number(e.target.value) })} />
        </label>
        <label>
          Driver convenience fee (₹) <span className="small muted">plan: ₹5–10, only once the app has enough lots</span>
          <input type="number" min={0} max={20} value={db.settings.convenienceFee} onChange={e => updateSettings({ convenienceFee: Number(e.target.value) })} />
        </label>
        <p className="small muted">Changes apply to new bookings only. Pilot rule: commission only, no fees for owners.</p>
        <hr />
        <button className="btn btn-ghost" onClick={() => confirm('Reset all demo data to the seeded pilot?') && reset()}>Reset demo data</button>
      </div>
    </div>
  )
}
