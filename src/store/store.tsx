import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Booking, Channel, DB, Dispute, Pass, PaymentMethod, Payout, Plot, Settings } from '../types'
import { addHours, dayKey, normaliseVehicle, ticketCode, uid } from '../lib/format'
import { split } from '../lib/pricing'
import { buildSeed, DB_VERSION } from './seed'

const KEY = 'plotpark-db'

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const db = JSON.parse(raw) as DB
      if (db.version === DB_VERSION) return db
    }
  } catch {
    /* fall through to a fresh seed */
  }
  return buildSeed()
}

export interface NewBooking {
  plotId: string
  driverName: string
  phone: string
  vehicleNo: string
  start: string
  hours: number
  paymentMethod: PaymentMethod
  channel?: Channel
}

export interface NewPass {
  plotId: string
  holderName: string
  vehicleNo: string
  corporateClient?: string
}

export type NewPlot = Omit<Plot, 'id' | 'status' | 'walkInsNow' | 'driverRating' | 'createdAt'>

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

interface Store {
  db: DB
  now: Date
  createBooking(b: NewBooking): Result<Booking>
  cancelBooking(id: string): void
  checkIn(plotId: string, code: string): Result<Booking>
  checkOut(plotId: string, code: string): Result<Booking>
  buyPass(p: NewPass): Pass
  logWalkIn(plotId: string, hours: number): void
  walkInLeft(plotId: string): void
  submitPlot(p: NewPlot, owner?: { name: string; phone: string }): Plot
  updatePlot(id: string, patch: Partial<Plot>): void
  reviewPlot(id: string, approve: boolean, reason?: string): void
  raiseDispute(bookingId: string, raisedBy: Dispute['raisedBy'], reason: string): void
  resolveDispute(id: string, resolution: string, refund: boolean): void
  runPayouts(): Payout[]
  updateSettings(s: Partial<Settings>): void
  rateApp(ownerId: string, rating: number): void
  reset(): void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(load)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db))
    } catch {
      /* storage full or blocked: demo keeps working in memory */
    }
  }, [db])

  // "Live" slots: refresh the clock every 30 s.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const mutate = useCallback((fn: (d: DB) => void) => {
    setDb(prev => {
      const next = structuredClone(prev)
      fn(next)
      return next
    })
  }, [])

  const store = useMemo<Store>(() => {
    const plotById = (id: string) => db.plots.find(p => p.id === id)

    const findTicket = (plotId: string, code: string) => {
      const c = code.trim().toUpperCase()
      return db.bookings.find(b => b.plotId === plotId && (b.code === c || b.id === code.trim()))
    }

    return {
      db,
      now,

      createBooking(input) {
        const plot = plotById(input.plotId)
        if (!plot || plot.status !== 'live') return { ok: false, error: 'This plot is not accepting bookings.' }
        if (!isOpenAt(plot, new Date(input.start))) return { ok: false, error: `Plot is closed at that time (open ${plot.opensAt}–${plot.closesAt}).` }
        if (freeSlotsAt(db, plot, new Date(input.start), input.hours) <= 0) return { ok: false, error: 'No free slots for that time. Try another plot or time.' }
        const s = split(plot.pricePerHour * input.hours, db.settings)
        const booking: Booking = {
          id: uid('b'),
          code: ticketCode(),
          plotId: plot.id,
          driverName: input.driverName.trim(),
          phone: input.phone.trim(),
          vehicleNo: normaliseVehicle(input.vehicleNo),
          start: input.start,
          hours: input.hours,
          amount: s.amount,
          convenienceFee: s.convenienceFee,
          commission: s.commission,
          ownerPayout: s.ownerPayout,
          paymentMethod: input.paymentMethod,
          paymentRef: uid('pay'),
          channel: input.channel ?? 'app',
          status: 'booked',
          createdAt: new Date().toISOString(),
        }
        mutate(d => void d.bookings.push(booking))
        return { ok: true, value: booking }
      },

      cancelBooking(id) {
        mutate(d => {
          const b = d.bookings.find(x => x.id === id)
          if (b && b.status === 'booked') b.status = 'cancelled'
        })
      },

      checkIn(plotId, code) {
        const b = findTicket(plotId, code)
        if (!b) return { ok: false, error: 'No booking with that code at this plot.' }
        if (b.status === 'checked_in') return { ok: false, error: 'Already checked in.' }
        if (b.status !== 'booked') return { ok: false, error: `Booking is ${b.status.replace('_', ' ')}.` }
        const at = new Date().toISOString()
        mutate(d => {
          const x = d.bookings.find(y => y.id === b.id)!
          x.status = 'checked_in'
          x.checkedInAt = at
        })
        return { ok: true, value: { ...b, status: 'checked_in', checkedInAt: at } }
      },

      checkOut(plotId, code) {
        const b = findTicket(plotId, code)
        if (!b) return { ok: false, error: 'No booking with that code at this plot.' }
        if (b.status !== 'checked_in') return { ok: false, error: 'Car is not checked in.' }
        const at = new Date().toISOString()
        mutate(d => {
          const x = d.bookings.find(y => y.id === b.id)!
          x.status = 'completed'
          x.checkedOutAt = at
        })
        return { ok: true, value: { ...b, status: 'completed', checkedOutAt: at } }
      },

      buyPass(input) {
        const plot = plotById(input.plotId)!
        const s = split(plot.monthlyPassPrice, db.settings)
        const from = new Date()
        const to = new Date(from)
        to.setDate(to.getDate() + 30)
        const pass: Pass = {
          id: uid('pass'),
          code: `M${ticketCode().slice(0, 5)}`,
          plotId: plot.id,
          holderName: input.holderName.trim(),
          vehicleNo: normaliseVehicle(input.vehicleNo),
          corporateClient: input.corporateClient?.trim() || undefined,
          amount: s.amount,
          commission: s.commission,
          ownerPayout: s.ownerPayout,
          validFrom: from.toISOString(),
          validTo: to.toISOString(),
          createdAt: from.toISOString(),
        }
        mutate(d => void d.passes.push(pass))
        return pass
      },

      logWalkIn(plotId, hours) {
        mutate(d => {
          const plot = d.plots.find(p => p.id === plotId)!
          plot.walkInsNow += 1
          const key = dayKey(new Date())
          let log = d.walkIns.find(w => w.plotId === plotId && w.date === key)
          if (!log) d.walkIns.push((log = { plotId, date: key, cars: 0, hours: 0, amount: 0 }))
          log.cars += 1
          log.hours += hours
          log.amount += hours * plot.pricePerHour
        })
      },

      walkInLeft(plotId) {
        mutate(d => {
          const plot = d.plots.find(p => p.id === plotId)!
          plot.walkInsNow = Math.max(0, plot.walkInsNow - 1)
        })
      },

      submitPlot(input, newOwner) {
        const plot: Plot = {
          ...input,
          id: uid('p'),
          status: 'pending',
          walkInsNow: 0,
          driverRating: 0,
          createdAt: new Date().toISOString(),
        }
        mutate(d => {
          if (newOwner) d.owners.push({ id: plot.ownerId, name: newOwner.name, phone: newOwner.phone })
          d.plots.push(plot)
        })
        return plot
      },

      updatePlot(id, patch) {
        mutate(d => {
          const p = d.plots.find(x => x.id === id)
          if (p) Object.assign(p, patch)
        })
      },

      reviewPlot(id, approve, reason) {
        mutate(d => {
          const p = d.plots.find(x => x.id === id)
          if (!p) return
          p.status = approve ? 'live' : 'rejected'
          p.rejectionReason = approve ? undefined : reason
        })
      },

      raiseDispute(bookingId, raisedBy, reason) {
        mutate(d => void d.disputes.push({ id: uid('d'), bookingId, raisedBy, reason, status: 'open', createdAt: new Date().toISOString() }))
      },

      resolveDispute(id, resolution, refund) {
        mutate(d => {
          const x = d.disputes.find(y => y.id === id)
          if (!x) return
          x.status = 'resolved'
          x.resolution = resolution + (refund ? ' (refund issued via gateway)' : '')
          if (refund) {
            const b = d.bookings.find(y => y.id === x.bookingId)
            if (b && !b.payoutId) b.status = 'cancelled'
          }
        })
      },

      runPayouts() {
        // Settle every completed booking and pass not yet paid out: one split transfer per owner.
        const byOwner = new Map<string, { gross: number; commission: number; amount: number; ids: string[] }>()
        const add = (plotId: string, x: { id: string; amount: number; commission: number; ownerPayout: number }) => {
          const ownerId = plotById(plotId)!.ownerId
          const acc = byOwner.get(ownerId) ?? { gross: 0, commission: 0, amount: 0, ids: [] }
          acc.gross += x.amount
          acc.commission += x.commission
          acc.amount += x.ownerPayout
          acc.ids.push(x.id)
          byOwner.set(ownerId, acc)
        }
        db.bookings.filter(b => b.status === 'completed' && !b.payoutId).forEach(b => add(b.plotId, b))
        db.passes.filter(p => !p.payoutId).forEach(p => add(p.plotId, p))

        const created: Payout[] = []
        const assigned = new Map<string, string>()
        for (const [ownerId, acc] of byOwner) {
          const payout: Payout = {
            id: uid('po'),
            ownerId,
            createdAt: new Date().toISOString(),
            gross: acc.gross,
            commission: acc.commission,
            amount: acc.amount,
            items: acc.ids.length,
            utr: `UTR${Math.floor(1e7 + Math.random() * 9e7)}`,
          }
          acc.ids.forEach(id => assigned.set(id, payout.id))
          created.push(payout)
        }
        mutate(d => {
          d.payouts.push(...created)
          for (const x of [...d.bookings, ...d.passes]) x.payoutId ??= assigned.get(x.id)
        })
        return created
      },

      updateSettings(s) {
        mutate(d => void Object.assign(d.settings, s))
      },

      rateApp(ownerId, rating) {
        mutate(d => {
          const o = d.owners.find(x => x.id === ownerId)
          if (o) o.appRating = rating
        })
      },

      reset() {
        localStorage.removeItem(KEY)
        setDb(buildSeed())
      },
    }
  }, [db, now, mutate])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}

/* ---------- selectors ---------- */

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const is24x7 = (p: Plot) => p.opensAt === '00:00' && p.closesAt === '23:59'

export function isOpenAt(p: Plot, at: Date) {
  if (is24x7(p)) return true
  const m = at.getHours() * 60 + at.getMinutes()
  return m >= toMinutes(p.opensAt) && m < toMinutes(p.closesAt)
}

const bookingEnd = (b: Booking) => new Date(addHours(b.start, b.hours))

/** App bookings holding a slot at any point in [from, from + hours). Checked-in cars hold a slot until checked out. */
export function appOccupied(db: DB, plotId: string, from: Date, hours = 0) {
  const to = new Date(from.getTime() + hours * 3_600_000)
  return db.bookings.filter(b => {
    if (b.plotId !== plotId) return false
    if (b.status === 'checked_in') return true
    if (b.status !== 'booked') return false
    return new Date(b.start) <= (hours ? to : from) && bookingEnd(b) > from
  }).length
}

export function freeSlotsAt(db: DB, p: Plot, from: Date, hours = 0) {
  return Math.max(0, p.totalSlots - p.walkInsNow - appOccupied(db, p.id, from, hours))
}

export const ownerPlots = (db: DB, ownerId: string) => db.plots.filter(p => p.ownerId === ownerId)
