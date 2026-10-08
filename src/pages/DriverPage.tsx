import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { DemandType } from '../types'
import { normaliseVehicle, rupees } from '../lib/format'
import { DEMAND_LABEL } from '../lib/pricing'
import { freeSlotsAt, is24x7, isOpenAt, useStore } from '../store/store'
import PlotMap from '../components/PlotMap'
import { BookingFlow, loadProfile, PassFlow } from '../components/BookingFlow'
import { BookingTicket, PassTicket } from '../components/Ticket'
import { Badge, Empty, Meter, Tabs } from '../components/ui'

type Sort = 'free' | 'price'

export default function DriverPage() {
  const { db, now } = useStore()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<'find' | 'tickets'>('find')
  const [selected, setSelected] = useState<string | null>(params.get('plot'))
  const [booking, setBooking] = useState<string | null>(params.get('plot'))
  const [passFor, setPassFor] = useState<string | null>(null)
  const [demand, setDemand] = useState<DemandType | 'all'>('all')
  const [sort, setSort] = useState<Sort>('free')
  const [profile, setProfile] = useState(loadProfile)

  const live = db.plots.filter(p => p.status === 'live')
  const rows = useMemo(
    () =>
      live
        .filter(p => demand === 'all' || p.demandType === demand)
        .map(p => ({ plot: p, free: freeSlotsAt(db, p, now), open: isOpenAt(p, now) }))
        .sort((a, b) => (sort === 'free' ? b.free - a.free : a.plot.pricePerHour - b.plot.pricePerHour)),
    [db, now, demand, sort, live],
  )

  const myVehicle = normaliseVehicle(profile.vehicleNo)
  const myBookings = db.bookings.filter(b => myVehicle && b.vehicleNo === myVehicle).sort((a, b) => b.start.localeCompare(a.start))
  const myPasses = db.passes.filter(p => myVehicle && p.vehicleNo === myVehicle)
  const active = myBookings.filter(b => b.status === 'booked' || b.status === 'checked_in')

  const closeBooking = () => {
    setBooking(null)
    if (params.has('plot')) setParams({}, { replace: true })
  }
  const bookingPlot = live.find(p => p.id === booking)
  const passPlot = live.find(p => p.id === passFor)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Find parking</h1>
          <p className="muted">Live slots at owner-run lots near Indiranagar Metro and CV Raman Nagar tech parks. Book and pay by UPI in under a minute.</p>
        </div>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: 'find', label: 'Map & lots' },
            { id: 'tickets', label: <>My tickets {active.length > 0 && <span className="count">{active.length}</span>}</> },
          ]}
        />
      </div>

      {tab === 'find' && (
        <div className="split">
          <div className="list-col">
            <div className="toolbar">
              <select value={demand} onChange={e => setDemand(e.target.value as DemandType | 'all')} aria-label="Area type">
                <option value="all">All areas</option>
                {(Object.keys(DEMAND_LABEL) as DemandType[]).map(d => <option key={d} value={d}>{DEMAND_LABEL[d]}</option>)}
              </select>
              <select value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Sort">
                <option value="free">Most free slots</option>
                <option value="price">Cheapest</option>
              </select>
            </div>
            {rows.length === 0 && <Empty>No live lots match.</Empty>}
            {rows.map(({ plot, free, open }) => (
              <article
                key={plot.id}
                className={`lot ${selected === plot.id ? 'lot-selected' : ''}`}
                onClick={() => setSelected(plot.id)}
              >
                <div className="row-between">
                  <h3>{plot.name}</h3>
                  <span className="price">{rupees(plot.pricePerHour)}<small>/h</small></span>
                </div>
                <p className="muted small">{plot.address}</p>
                <div className="row gap small">
                  <Badge>{DEMAND_LABEL[plot.demandType]}</Badge>
                  <span className="muted">{is24x7(plot) ? 'Open 24×7' : `${plot.opensAt}–${plot.closesAt}`}</span>
                  {plot.driverRating > 0 && <span className="muted">★ {plot.driverRating.toFixed(1)}</span>}
                </div>
                <div className="occ">
                  <Meter value={plot.totalSlots - free} max={plot.totalSlots} />
                  <span className={free === 0 ? 'text-bad' : free < 5 ? 'text-warn' : 'text-good'}>
                    {open ? `${free} of ${plot.totalSlots} free` : 'Closed now'}
                  </span>
                </div>
                <div className="row gap">
                  <button className="btn btn-primary btn-sm" disabled={free === 0} onClick={e => { e.stopPropagation(); setBooking(plot.id) }}>Book</button>
                  <button className="btn btn-sm" onClick={e => { e.stopPropagation(); setPassFor(plot.id) }}>Monthly pass · {rupees(plot.monthlyPassPrice)}</button>
                </div>
              </article>
            ))}
            <p className="small muted">No smartphone data? Book on WhatsApp: send the lot name to the number on the QR board.</p>
          </div>
          <div className="map-col">
            <PlotMap pins={rows.map(r => ({ plot: r.plot, free: r.free }))} selectedId={selected} onSelect={setSelected} height={620} />
          </div>
        </div>
      )}

      {tab === 'tickets' && (
        <div className="stack">
          {!myVehicle && <Empty>Book a slot or buy a pass and your tickets will show here.</Empty>}
          {myVehicle && <p className="muted">Showing tickets for <span className="mono">{myVehicle}</span>.</p>}
          {myPasses.map(p => <PassTicket key={p.id} pass={p} plot={db.plots.find(x => x.id === p.plotId)!} />)}
          {myBookings.slice(0, 20).map(b => <BookingTicket key={b.id} booking={b} plot={db.plots.find(x => x.id === b.plotId)!} />)}
          {myVehicle && !myBookings.length && !myPasses.length && <Empty>No bookings yet for this vehicle.</Empty>}
        </div>
      )}

      {bookingPlot && <BookingFlow plot={bookingPlot} onDone={closeBooking} onProfile={setProfile} />}
      {passPlot && <PassFlow plot={passPlot} onDone={() => setPassFor(null)} onProfile={setProfile} />}
    </div>
  )
}
