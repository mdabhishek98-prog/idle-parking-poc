import { useState } from 'react'
import type { Checklist, DemandType, Plot } from '../types'
import { rupees, uid } from '../lib/format'
import { DEMAND_LABEL, suggestPrice } from '../lib/pricing'
import { freeSlotsAt, useStore } from '../store/store'
import PlotMap from './PlotMap'

const CHECKS: { key: keyof Checklist; label: string; required: boolean }[] = [
  { key: 'tradeLicence', label: 'I hold a trade licence from the city corporation for this plot (we can help with paperwork)', required: true },
  { key: 'landUseAllowsParking', label: 'Land use for this plot allows parking', required: true },
  { key: 'notAgricultural', label: 'This is not agricultural land', required: true },
  { key: 'insurance', label: 'I have liability insurance (recommended, not required)', required: false },
]

/** Owner onboarding: list a plot in a few minutes. New listings go to admin verification. */
export default function ListPlotForm({ ownerId, onSubmitted }: { ownerId: string | null; onSubmitted: (p: Plot) => void }) {
  const { db, now, submitPlot } = useStore()
  const [owner, setOwner] = useState({ name: '', phone: '' })
  const [f, setF] = useState({
    name: '', address: '', zone: 'Indiranagar Metro', demandType: 'metro' as DemandType,
    totalSlots: 20, pricePerHour: 30, monthlyPassPrice: 2500, opensAt: '07:00', closesAt: '22:00', allDay: false,
  })
  const [where, setWhere] = useState<{ lat: number; lng: number } | null>(null)
  const [checks, setChecks] = useState<Checklist>({ tradeLicence: false, landUseAllowsParking: false, notAgricultural: false, insurance: false })
  const [photos, setPhotos] = useState<string[]>([])
  const [terms, setTerms] = useState(false)

  const suggestion = suggestPrice(f.demandType, where, db.plots)
  const requiredOk = CHECKS.filter(c => c.required).every(c => checks[c.key])
  const ownerOk = ownerId || (owner.name.trim() && owner.phone.trim().length >= 10)
  const ready = ownerOk && f.name.trim() && f.address.trim() && where && requiredOk && terms && f.totalSlots > 0

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v })

  return (
    <form
      className="form list-plot"
      onSubmit={e => {
        e.preventDefault()
        if (!ready || !where) return
        const oid = ownerId ?? uid('o')
        const { allDay, ...rest } = f
        const plot = submitPlot(
          { ...rest, ...where, ownerId: oid, checklist: checks, opensAt: allDay ? '00:00' : f.opensAt, closesAt: allDay ? '23:59' : f.closesAt },
          ownerId ? undefined : owner,
        )
        onSubmitted(plot)
      }}
    >
      {!ownerId && (
        <section>
          <h3>1 · About you</h3>
          <div className="grid-2">
            <label>Your name<input required value={owner.name} onChange={e => setOwner({ ...owner, name: e.target.value })} /></label>
            <label>Mobile (for payouts & alerts)<input required inputMode="tel" value={owner.phone} onChange={e => setOwner({ ...owner, phone: e.target.value })} /></label>
          </div>
        </section>
      )}

      <section>
        <h3>{ownerId ? '1' : '2'} · Your plot</h3>
        <div className="grid-2">
          <label>Plot name drivers will see<input required placeholder="e.g. Rao Plot – Hospital Rd" value={f.name} onChange={e => set('name', e.target.value)} /></label>
          <label>
            What is nearby?
            <select value={f.demandType} onChange={e => set('demandType', e.target.value as DemandType)}>
              {(Object.keys(DEMAND_LABEL) as DemandType[]).map(d => <option key={d} value={d}>{DEMAND_LABEL[d]}</option>)}
            </select>
          </label>
        </div>
        <label>Address / landmark<input required value={f.address} onChange={e => set('address', e.target.value)} /></label>
        <label>Area<input value={f.zone} onChange={e => set('zone', e.target.value)} /></label>
        <div className="field-label">Tap the map to drop a pin on your plot {where && <span className="text-good">✓ pinned</span>}</div>
        <PlotMap
          pins={db.plots.filter(p => p.status === 'live').map(p => ({ plot: p, free: freeSlotsAt(db, p, now) }))}
          picked={where}
          onPick={(lat, lng) => setWhere({ lat, lng })}
          height={280}
        />
        <label>
          Photos of the plot
          <input type="file" accept="image/*" multiple onChange={e => setPhotos([...(e.target.files ?? [])].map(file => URL.createObjectURL(file)))} />
        </label>
        {photos.length > 0 && <div className="thumbs">{photos.map(src => <img key={src} src={src} alt="Plot" />)}</div>}
      </section>

      <section>
        <h3>{ownerId ? '2' : '3'} · Slots, hours & price</h3>
        <div className="grid-3">
          <label>Car slots<input type="number" min={1} max={500} value={f.totalSlots} onChange={e => set('totalSlots', Number(e.target.value))} /></label>
          <label>Opens<input type="time" disabled={f.allDay} value={f.opensAt} onChange={e => set('opensAt', e.target.value)} /></label>
          <label>Closes<input type="time" disabled={f.allDay} value={f.closesAt} onChange={e => set('closesAt', e.target.value)} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={f.allDay} onChange={e => set('allDay', e.target.checked)} /> Open 24 × 7</label>
        <div className="suggest">
          <div>
            <b>Suggested price: {rupees(suggestion.hourly)}/h · pass {rupees(suggestion.monthly)}/month</b>
            <div className="small muted">Based on the {suggestion.basis}.</div>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => setF({ ...f, pricePerHour: suggestion.hourly, monthlyPassPrice: suggestion.monthly })}>Use this</button>
        </div>
        <div className="grid-2">
          <label>Price per hour (₹)<input type="number" min={5} value={f.pricePerHour} onChange={e => set('pricePerHour', Number(e.target.value))} /></label>
          <label>Monthly pass (₹)<input type="number" min={100} step={100} value={f.monthlyPassPrice} onChange={e => set('monthlyPassPrice', Number(e.target.value))} /></label>
        </div>
        <p className="small muted">
          You keep {100 - db.settings.commissionPct}% of every booking ({rupees((f.pricePerHour * (100 - db.settings.commissionPct)) / 100)} per hour at this price). No listing or monthly fees in the pilot.
        </p>
      </section>

      <section>
        <h3>{ownerId ? '3' : '4'} · Licence & land-use checklist</h3>
        {CHECKS.map(c => (
          <label key={c.key} className="check">
            <input type="checkbox" checked={checks[c.key]} onChange={e => setChecks({ ...checks, [c.key]: e.target.checked })} />
            {c.label} {c.required && <span className="req">required</span>}
          </label>
        ))}
        <label className="check">
          <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} />
          I agree to the owner agreement: I operate the lot; PlotPark provides bookings and payments only.
        </label>
      </section>

      <button className="btn btn-primary" disabled={!ready}>Submit for verification</button>
      {!ready && <span className="small muted"> Fill in the plot details, drop a pin and tick the required checks.</span>}
    </form>
  )
}
