import { useState } from 'react'
import type { Booking, Pass, Plot } from '../types'
import { addHours, fmtTime, rupees } from '../lib/format'
import { split } from '../lib/pricing'
import { freeSlotsAt, isOpenAt, useStore } from '../store/store'
import PaymentDialog from './PaymentDialog'
import { BookingTicket, PassTicket } from './Ticket'
import { Modal } from './ui'

export interface DriverProfile {
  name: string
  phone: string
  vehicleNo: string
}

const PROFILE_KEY = 'plotpark-driver'

export function loadProfile(): DriverProfile {
  try {
    return { name: '', phone: '', vehicleNo: '', ...JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}') }
  } catch {
    return { name: '', phone: '', vehicleNo: '' }
  }
}

function saveProfile(p: DriverProfile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

/** datetime-local value for "now", rounded up to the next 15 minutes. */
function nextQuarter() {
  const d = new Date()
  d.setSeconds(0, 0)
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15)
  const off = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}

export function BookingFlow({ plot, onDone, onProfile }: { plot: Plot; onDone: () => void; onProfile: (p: DriverProfile) => void }) {
  const { db, createBooking } = useStore()
  const owner = db.owners.find(o => o.id === plot.ownerId)!
  const [profile, setProfile] = useState(loadProfile)
  const [when, setWhen] = useState<'now' | 'later'>('now')
  const [later, setLater] = useState(nextQuarter)
  const [hours, setHours] = useState(2)
  const [step, setStep] = useState<'form' | 'pay' | 'done'>('form')
  const [error, setError] = useState('')
  const [booking, setBooking] = useState<Booking | null>(null)

  const start = when === 'now' ? new Date() : new Date(later)
  const s = split(plot.pricePerHour * hours, db.settings)
  const free = freeSlotsAt(db, plot, start, hours)
  const open = isOpenAt(plot, start)
  const valid = profile.name.trim() && profile.phone.trim().length >= 10 && profile.vehicleNo.trim().length >= 6

  if (step === 'pay')
    return (
      <PaymentDialog
        title={`${plot.name} · ${hours} h`}
        s={s}
        ownerName={owner.name}
        onClose={() => setStep('form')}
        onPaid={method => {
          const r = createBooking({ plotId: plot.id, driverName: profile.name, phone: profile.phone, vehicleNo: profile.vehicleNo, start: start.toISOString(), hours, paymentMethod: method })
          if (!r.ok) {
            setError(r.error)
            setStep('form')
            return
          }
          saveProfile(profile)
          onProfile(profile)
          setBooking(r.value)
          setStep('done')
        }}
      />
    )

  if (step === 'done' && booking)
    return (
      <Modal title="Booking confirmed" onClose={onDone} wide>
        <p className="success-line">Paid. Your slot is reserved. This ticket is also saved under My tickets.</p>
        <BookingTicket booking={booking} plot={plot} />
      </Modal>
    )

  return (
    <Modal title={`Book · ${plot.name}`} onClose={onDone}>
      <form
        className="form"
        onSubmit={e => {
          e.preventDefault()
          setError('')
          setStep('pay')
        }}
      >
        <div className="grid-2">
          <label>Your name<input required value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></label>
          <label>Mobile<input required inputMode="tel" placeholder="10-digit number" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} /></label>
        </div>
        <label>Vehicle number<input required className="mono" placeholder="KA01AB1234" value={profile.vehicleNo} onChange={e => setProfile({ ...profile, vehicleNo: e.target.value.toUpperCase() })} /></label>
        <div className="grid-2">
          <label>
            Start
            <select value={when} onChange={e => setWhen(e.target.value as 'now' | 'later')}>
              <option value="now">Now</option>
              <option value="later">Later…</option>
            </select>
          </label>
          <label>
            Duration
            <select value={hours} onChange={e => setHours(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(h => <option key={h} value={h}>{h} hour{h > 1 ? 's' : ''}</option>)}
            </select>
          </label>
        </div>
        {when === 'later' && <label>Arrival time<input type="datetime-local" value={later} min={nextQuarter()} onChange={e => setLater(e.target.value)} /></label>}

        <div className="summary">
          <div className="row-between"><span>{rupees(plot.pricePerHour)} × {hours} h</span><span>{rupees(s.amount)}</span></div>
          {s.convenienceFee > 0 && <div className="row-between"><span>Convenience fee</span><span>{rupees(s.convenienceFee)}</span></div>}
          <div className="row-between strong"><span>Total</span><span>{rupees(s.driverPays)}</span></div>
          <div className="small muted">
            {fmtTime(start.toISOString())} – {fmtTime(addHours(start.toISOString(), hours))} ·{' '}
            {!open ? <span className="text-bad">closed at this time</span> : free > 0 ? <span className="text-good">{free} slots free</span> : <span className="text-bad">full</span>}
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={!valid || !open || free <= 0}>Continue to pay</button>
      </form>
    </Modal>
  )
}

export function PassFlow({ plot, onDone, onProfile }: { plot: Plot; onDone: () => void; onProfile: (p: DriverProfile) => void }) {
  const { db, buyPass } = useStore()
  const owner = db.owners.find(o => o.id === plot.ownerId)!
  const [profile, setProfile] = useState(loadProfile)
  const [company, setCompany] = useState('')
  const [step, setStep] = useState<'form' | 'pay' | 'done'>('form')
  const [pass, setPass] = useState<Pass | null>(null)
  const s = split(plot.monthlyPassPrice, db.settings)

  if (step === 'pay')
    return (
      <PaymentDialog
        title={`Monthly pass · ${plot.name}`}
        s={{ ...s, convenienceFee: 0, driverPays: s.amount }}
        ownerName={owner.name}
        onClose={() => setStep('form')}
        onPaid={() => {
          setPass(buyPass({ plotId: plot.id, holderName: profile.name, vehicleNo: profile.vehicleNo, corporateClient: company }))
          saveProfile(profile)
          onProfile(profile)
          setStep('done')
        }}
      />
    )

  if (step === 'done' && pass)
    return (
      <Modal title="Monthly pass active" onClose={onDone} wide>
        <p className="success-line">Park any time during opening hours for the next 30 days.</p>
        <PassTicket pass={pass} plot={plot} />
      </Modal>
    )

  return (
    <Modal title={`Monthly pass · ${plot.name}`} onClose={onDone}>
      <form className="form" onSubmit={e => { e.preventDefault(); setStep('pay') }}>
        <p className="muted small">Unlimited parking for one vehicle for 30 days, {plot.opensAt}–{plot.closesAt}. For regular commuters to {plot.zone}.</p>
        <label>Name on pass<input required value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></label>
        <label>Vehicle number<input required className="mono" value={profile.vehicleNo} onChange={e => setProfile({ ...profile, vehicleNo: e.target.value.toUpperCase() })} /></label>
        <label>Company / apartment (optional)<input placeholder="For corporate & RWA passes" value={company} onChange={e => setCompany(e.target.value)} /></label>
        <div className="summary">
          <div className="row-between strong"><span>30-day pass</span><span>{rupees(plot.monthlyPassPrice)}</span></div>
          <div className="small muted">≈ {rupees(plot.monthlyPassPrice / 22)} per working day vs {rupees(plot.pricePerHour * 4)} for 4 h pay-as-you-go</div>
        </div>
        <button className="btn btn-primary btn-block" disabled={!profile.name.trim() || profile.vehicleNo.trim().length < 6}>Continue to pay</button>
      </form>
    </Modal>
  )
}
