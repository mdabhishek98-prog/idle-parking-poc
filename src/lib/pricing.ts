import type { DemandType, Plot, Settings } from '../types'

export interface Split {
  amount: number
  convenienceFee: number
  commission: number
  ownerPayout: number
  driverPays: number
}

/** Commission is deducted from the owner's share; the convenience fee (if any) is paid by the driver. */
export function split(amount: number, s: Settings): Split {
  const commission = Math.round((amount * s.commissionPct) / 100)
  return {
    amount,
    convenienceFee: s.convenienceFee,
    commission,
    ownerPayout: amount - commission,
    driverPays: amount + s.convenienceFee,
  }
}

const BASE_RATE: Record<DemandType, number> = { metro: 30, market: 30, office: 35, hospital: 25 }

export const DEMAND_LABEL: Record<DemandType, string> = {
  metro: 'Metro station',
  market: 'Market',
  office: 'Tech park / offices',
  hospital: 'Hospital',
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

/**
 * Suggested hourly price for a new plot: median of live plots within 2 km,
 * otherwise a base rate for the demand type. Fixed pricing only in the pilot.
 */
export function suggestPrice(
  demandType: DemandType,
  where: { lat: number; lng: number } | null,
  plots: Plot[],
): { hourly: number; monthly: number; basis: string } {
  const nearby = where
    ? plots.filter(p => p.status === 'live' && distanceKm(p, where) <= 2).map(p => p.pricePerHour).sort((a, b) => a - b)
    : []
  const hourly = nearby.length ? nearby[Math.floor(nearby.length / 2)] : BASE_RATE[demandType]
  const basis = nearby.length
    ? `median of ${nearby.length} live plot${nearby.length > 1 ? 's' : ''} within 2 km`
    : `typical rate for ${DEMAND_LABEL[demandType].toLowerCase()} areas`
  // A pass is roughly 22 working days × 4 h at ~95% of the hourly rate, rounded to ₹100.
  const monthly = Math.round((hourly * 22 * 4 * 0.95) / 100) * 100
  return { hourly, monthly, basis }
}
