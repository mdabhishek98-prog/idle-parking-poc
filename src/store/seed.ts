import type { Booking, DB, Dispute, Owner, Pass, Payout, Plot, WalkInLog } from '../types'
import { addHours, dayKey } from '../lib/format'
import { split } from '../lib/pricing'

export const DB_VERSION = 1

/** Small deterministic RNG so the demo data looks the same on every reset. */
function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const allClear = { tradeLicence: true, landUseAllowsParking: true, notAgricultural: true, insurance: true }

export function buildSeed(now = new Date()): DB {
  const r = rng(42)
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const settings = { commissionPct: 15, convenienceFee: 0 }
  const created = addHours(now.toISOString(), -24 * 45)

  const owners: Owner[] = [
    { id: 'o1', name: 'Suresh Gowda', phone: '98450 01101', appRating: 4.5 },
    { id: 'o2', name: 'Lakshmi Narayan', phone: '98450 01102', appRating: 4 },
    { id: 'o3', name: 'Imran Pasha', phone: '98450 01103', appRating: 3.5 },
    { id: 'o4', name: 'Kavitha Reddy', phone: '98450 01104', appRating: 5 },
    { id: 'o5', name: "Joseph D'Souza", phone: '98450 01105', appRating: 4 },
    { id: 'o6', name: 'Manjunath Rao', phone: '98450 01106' },
  ]

  const plots: Plot[] = [
    {
      id: 'p1', ownerId: 'o1', name: 'Gowda Plot – 100 Ft Road', address: 'Off 100 Feet Rd, near Indiranagar Metro',
      zone: 'Indiranagar Metro', demandType: 'metro', lat: 12.97905, lng: 77.6392, totalSlots: 30, pricePerHour: 30,
      monthlyPassPrice: 2500, opensAt: '06:00', closesAt: '23:59', status: 'live', checklist: allClear, walkInsNow: 6,
      driverRating: 4.3, createdAt: created,
    },
    {
      id: 'p2', ownerId: 'o2', name: 'Lakshmi Parking – CMH Rd', address: 'CMH Road, 300 m from Indiranagar Metro',
      zone: 'Indiranagar Metro', demandType: 'metro', lat: 12.97735, lng: 77.6428, totalSlots: 25, pricePerHour: 30,
      monthlyPassPrice: 2500, opensAt: '00:00', closesAt: '23:59', status: 'live', checklist: allClear, walkInsNow: 4,
      driverRating: 4.6, createdAt: created,
    },
    {
      id: 'p3', ownerId: 'o3', name: 'Pasha Open Lot – 12th Main', address: '12th Main, HAL 2nd Stage',
      zone: 'Indiranagar Metro', demandType: 'metro', lat: 12.9808, lng: 77.6412, totalSlots: 35, pricePerHour: 25,
      monthlyPassPrice: 2100, opensAt: '07:00', closesAt: '23:00', status: 'live',
      checklist: { ...allClear, insurance: false }, walkInsNow: 9, driverRating: 3.9, createdAt: created,
    },
    {
      id: 'p4', ownerId: 'o4', name: 'Reddy Grounds – Tech Park Gate', address: 'Old Madras Rd service lane, CV Raman Nagar',
      zone: 'CV Raman Nagar Tech Park', demandType: 'office', lat: 12.9818, lng: 77.6625, totalSlots: 30, pricePerHour: 35,
      monthlyPassPrice: 2900, opensAt: '00:00', closesAt: '23:59', status: 'live', checklist: allClear, walkInsNow: 5,
      driverRating: 4.5, createdAt: created,
    },
    {
      id: 'p5', ownerId: 'o5', name: "D'Souza Lot – Kaggadasapura Rd", address: 'Kaggadasapura Main Rd, CV Raman Nagar',
      zone: 'CV Raman Nagar Tech Park', demandType: 'office', lat: 12.9786, lng: 77.6668, totalSlots: 30, pricePerHour: 35,
      monthlyPassPrice: 2900, opensAt: '07:00', closesAt: '22:00', status: 'live', checklist: allClear, walkInsNow: 3,
      driverRating: 4.1, createdAt: created,
    },
    {
      id: 'p6', ownerId: 'o6', name: 'Rao Vacant Site – Hospital Rd', address: 'Near CMH Hospital, Indiranagar',
      zone: 'Indiranagar Metro', demandType: 'hospital', lat: 12.9742, lng: 77.6455, totalSlots: 20, pricePerHour: 25,
      monthlyPassPrice: 2100, opensAt: '00:00', closesAt: '23:59', status: 'pending',
      checklist: { tradeLicence: true, landUseAllowsParking: true, notAgricultural: true, insurance: false },
      walkInsNow: 0, driverRating: 0, createdAt: addHours(now.toISOString(), -20),
    },
  ]
  const live = plots.filter(p => p.status === 'live')

  // A pool of regular drivers so some vehicles book repeatedly.
  const firstNames = ['Arjun', 'Priya', 'Rahul', 'Sneha', 'Vikram', 'Ananya', 'Karthik', 'Divya', 'Nikhil', 'Meera', 'Rohan', 'Pooja', 'Aditya', 'Shreya', 'Sanjay', 'Kavya']
  const drivers = Array.from({ length: 1580 }, (_, i) => ({
    name: `${pick(firstNames)} ${String.fromCharCode(65 + (i % 26))}.`,
    phone: `9${int(100000000, 999999999)}`,
    vehicleNo: `KA${String(int(1, 53)).padStart(2, '0')}${String.fromCharCode(65 + int(0, 25))}${String.fromCharCode(65 + int(0, 25))}${int(1000, 9999)}`,
  }))
  // 80 regulars take ~45% of bookings; the rest are mostly one-off visitors.
  const pickDriver = () => (r() < 0.45 ? drivers[int(0, 79)] : drivers[int(80, 1579)])

  const bookings: Booking[] = []
  const walkIns: WalkInLog[] = []
  let seq = 0
  const mk = (plot: Plot, start: Date, hours: number, status: Booking['status'], channel: Booking['channel'] = 'app'): Booking => {
    const d = pickDriver()
    const s = split(plot.pricePerHour * hours, settings)
    const startIso = start.toISOString()
    seq++
    return {
      id: `b_seed_${seq}`, code: `S${String(seq).padStart(5, '0')}`, plotId: plot.id,
      driverName: d.name, phone: d.phone, vehicleNo: d.vehicleNo, start: startIso, hours,
      amount: s.amount, convenienceFee: s.convenienceFee, commission: s.commission, ownerPayout: s.ownerPayout,
      paymentMethod: r() < 0.82 ? 'upi' : 'card', paymentRef: `pay_${seq}${int(1000, 9999)}`, channel, status,
      checkedInAt: status === 'checked_in' || status === 'completed' ? addHours(startIso, 0.05) : undefined,
      checkedOutAt: status === 'completed' ? addHours(startIso, hours - 0.1) : undefined,
      createdAt: addHours(startIso, -0.5),
    }
  }

  // Past 29 days of history.
  for (let daysAgo = 29; daysAgo >= 1; daysAgo--) {
    const day = new Date(now)
    day.setDate(day.getDate() - daysAgo)
    for (const plot of live) {
      // Ramp-up: fewer bookings early in the pilot.
      const ramp = 0.6 + 0.4 * ((29 - daysAgo) / 28)
      const n = Math.round(int(7, 12) * ramp)
      for (let i = 0; i < n; i++) {
        const start = new Date(day)
        start.setHours(int(8, 19), pick([0, 15, 30, 45]), 0, 0)
        const hours = int(1, 5)
        bookings.push(mk(plot, start, hours, r() < 0.03 ? 'cancelled' : 'completed', r() < 0.08 ? 'whatsapp' : 'app'))
      }
      const cars = Math.round(n * (0.9 + r() * 0.8))
      const hours = Math.round(cars * (2.2 + r()))
      walkIns.push({ plotId: plot.id, date: dayKey(day), cars, hours, amount: hours * plot.pricePerHour })
    }
  }

  // Today: some finished, some parked right now, some upcoming.
  for (const plot of live) {
    for (let i = 0; i < int(2, 4); i++) bookings.push(mk(plot, new Date(now.getTime() - int(5, 8) * 3_600_000), int(1, 3), 'completed'))
    for (let i = 0; i < int(3, 7); i++) bookings.push(mk(plot, new Date(now.getTime() - int(10, 110) * 60_000), int(2, 4), 'checked_in'))
    for (let i = 0; i < int(1, 3); i++) bookings.push(mk(plot, new Date(now.getTime() + int(20, 180) * 60_000), int(1, 3), 'booked'))
    walkIns.push({ plotId: plot.id, date: dayKey(now), cars: plot.walkInsNow + int(1, 4), hours: (plot.walkInsNow + 2) * 3, amount: (plot.walkInsNow + 2) * 3 * plot.pricePerHour })
  }

  // Corporate and individual monthly passes.
  const passes: Pass[] = []
  const addPass = (plot: Plot, corporateClient?: string) => {
    const d = pickDriver()
    const s = split(plot.monthlyPassPrice, settings)
    const from = new Date(now)
    from.setDate(from.getDate() - int(0, 20))
    from.setHours(0, 0, 0, 0)
    const to = new Date(from)
    to.setDate(to.getDate() + 30)
    passes.push({
      id: `pass_seed_${passes.length + 1}`, code: `M${String(passes.length + 1).padStart(4, '0')}`, plotId: plot.id,
      holderName: d.name, vehicleNo: d.vehicleNo, corporateClient, amount: s.amount, commission: s.commission,
      ownerPayout: s.ownerPayout, validFrom: from.toISOString(), validTo: to.toISOString(), createdAt: from.toISOString(),
    })
  }
  for (let i = 0; i < 4; i++) addPass(i % 2 ? plots[3] : plots[4], 'Northwind Software Pvt Ltd')
  for (let i = 0; i < 2; i++) addPass(plots[0], 'Lakeview Apartments RWA')
  addPass(plots[1]); addPass(plots[1]); addPass(plots[2]); addPass(plots[0]); addPass(plots[3])

  // Nightly payouts for everything older than yesterday; yesterday + today await the next run.
  const payouts: Payout[] = []
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - 1)
  cutoff.setHours(0, 0, 0, 0)
  for (let daysAgo = 29; daysAgo >= 2; daysAgo--) {
    const day = new Date(now)
    day.setDate(day.getDate() - daysAgo)
    const key = dayKey(day)
    for (const o of owners) {
      const items = bookings.filter(b => b.status === 'completed' && dayKey(b.start) === key && plots.find(p => p.id === b.plotId)?.ownerId === o.id)
      if (!items.length) continue
      const run = new Date(day)
      run.setDate(run.getDate() + 1)
      run.setHours(2, 0, 0, 0)
      const id = `po_seed_${payouts.length + 1}`
      items.forEach(b => (b.payoutId = id))
      payouts.push({
        id, ownerId: o.id, createdAt: run.toISOString(), items: items.length,
        gross: items.reduce((a, b) => a + b.amount, 0), commission: items.reduce((a, b) => a + b.commission, 0),
        amount: items.reduce((a, b) => a + b.ownerPayout, 0), utr: `UTR${int(10000000, 99999999)}`,
      })
    }
  }
  passes.filter(p => new Date(p.createdAt) < cutoff).forEach(p => (p.payoutId = 'po_pass_seed'))

  const completed = bookings.filter(b => b.status === 'completed')
  const disputes: Dispute[] = [
    { id: 'd1', bookingId: completed[completed.length - 3].id, raisedBy: 'driver', reason: 'Gate was locked when I arrived; parked on the street instead. Requesting refund.', status: 'open', createdAt: addHours(now.toISOString(), -5) },
    { id: 'd2', bookingId: completed[completed.length - 40].id, raisedBy: 'owner', reason: 'Driver overstayed by 2 hours and refused to pay the difference.', status: 'open', createdAt: addHours(now.toISOString(), -30) },
    { id: 'd3', bookingId: completed[200].id, raisedBy: 'driver', reason: 'Charged twice on UPI.', status: 'resolved', resolution: 'Duplicate charge auto-refunded by gateway.', createdAt: addHours(now.toISOString(), -24 * 12) },
  ]

  return { version: DB_VERSION, settings, owners, plots, bookings, passes, walkIns, disputes, payouts }
}
