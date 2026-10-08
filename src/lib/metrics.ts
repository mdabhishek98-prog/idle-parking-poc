import type { DB } from '../types'
import { dayKey } from './format'

export interface Metric {
  label: string
  value: number
  display: string
  target: string
  pass: boolean
  hint: string
}

const withinDays = (iso: string, now: Date, days: number) => now.getTime() - new Date(iso).getTime() <= days * 86_400_000

/** Pilot success metrics from the POC plan, computed over the last 30 days. */
export function pilotMetrics(db: DB, now: Date): Metric[] {
  const pilotPlots = db.plots.filter(p => p.status !== 'pending')
  const listed = db.plots.filter(p => p.status === 'live').length

  const recent = db.bookings.filter(b => b.status !== 'cancelled' && withinDays(b.start, now, 30))
  const appHours = recent.reduce((a, b) => a + b.hours, 0)
  const since = dayKey(new Date(now.getTime() - 30 * 86_400_000))
  const walkHours = db.walkIns.filter(w => w.date >= since).reduce((a, w) => a + w.hours, 0)
  const share = appHours + walkHours ? appHours / (appHours + walkHours) : 0

  const perDriver = new Map<string, number>()
  recent.forEach(b => perDriver.set(b.vehicleNo, (perDriver.get(b.vehicleNo) ?? 0) + 1))
  const repeat = perDriver.size ? [...perDriver.values()].filter(n => n >= 2).length / perDriver.size : 0

  const passes = db.passes.length

  const ratings = db.owners.map(o => o.appRating).filter((r): r is number => r != null)
  const rating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0

  return [
    { label: 'Owners still listed', value: listed, display: `${listed} of ${Math.max(5, pilotPlots.length)}`, target: '4 of 5 or more', pass: listed >= 4, hint: 'Live plots right now' },
    { label: 'Share booked through the app', value: share, display: `${Math.round(share * 100)}%`, target: '40% or more', pass: share >= 0.4, hint: 'App hours ÷ (app + cash walk-in hours), last 30 days' },
    { label: 'Repeat drivers (2+ bookings/month)', value: repeat, display: `${Math.round(repeat * 100)}%`, target: '30% or more', pass: repeat >= 0.3, hint: `${perDriver.size} distinct vehicles, last 30 days` },
    { label: 'Monthly passes sold', value: passes, display: String(passes), target: '15 or more', pass: passes >= 15, hint: 'Individual + corporate passes' },
    { label: 'Owner rating of the app', value: rating, display: `${rating.toFixed(1)} / 5`, target: '4 out of 5 or more', pass: rating >= 4, hint: `${ratings.length} owners rated` },
  ]
}

export interface Economics {
  plots: number
  slots: number
  rate: number
  paidHours: number
  appShare: number // 0–1
  commissionPct: number
  hosting: number
  marketing: number
  fieldHelp: number
}

export const DOC_ASSUMPTIONS: Economics = {
  plots: 5, slots: 30, rate: 30, paidHours: 5, appShare: 0.5, commissionPct: 15, hosting: 8000, marketing: 15000, fieldHelp: 15000,
}

export function economics(e: Economics) {
  const totalValue = e.plots * e.slots * e.paidHours * e.rate * 30
  const viaApp = totalValue * e.appShare
  const commission = (viaApp * e.commissionPct) / 100
  const costs = e.hosting + e.marketing + e.fieldHelp
  const perExtraPlot = e.plots ? commission / e.plots : 0
  return { totalValue, viaApp, commission, costs, result: commission - costs, perExtraPlot }
}

/** Actual last-30-day numbers from the pilot data, for comparison with the model. */
export function actuals(db: DB, now: Date) {
  const recent = db.bookings.filter(b => b.status !== 'cancelled' && withinDays(b.start, now, 30))
  const recentPasses = db.passes.filter(p => withinDays(p.createdAt, now, 30))
  const gmv = recent.reduce((a, b) => a + b.amount, 0) + recentPasses.reduce((a, p) => a + p.amount, 0)
  const commission = recent.reduce((a, b) => a + b.commission, 0) + recentPasses.reduce((a, p) => a + p.commission, 0)
  return { gmv, commission, bookings: recent.length, passes: recentPasses.length }
}
