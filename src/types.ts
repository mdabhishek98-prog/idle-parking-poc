export type DemandType = 'metro' | 'market' | 'office' | 'hospital'

export type PlotStatus = 'pending' | 'live' | 'paused' | 'rejected'

export interface Owner {
  id: string
  name: string
  phone: string
  /** Owner's rating of the app, 1–5 (a pilot success metric). */
  appRating?: number
}

export interface Checklist {
  tradeLicence: boolean
  landUseAllowsParking: boolean
  notAgricultural: boolean
  insurance: boolean
}

export interface Plot {
  id: string
  ownerId: string
  name: string
  address: string
  zone: string
  demandType: DemandType
  lat: number
  lng: number
  totalSlots: number
  pricePerHour: number
  monthlyPassPrice: number
  opensAt: string // "HH:MM"
  closesAt: string
  status: PlotStatus
  checklist: Checklist
  /** Cars currently parked that paid the owner offline (cash walk-ins). */
  walkInsNow: number
  driverRating: number
  createdAt: string
  rejectionReason?: string
}

export type BookingStatus = 'booked' | 'checked_in' | 'completed' | 'cancelled'
export type PaymentMethod = 'upi' | 'card'
export type Channel = 'app' | 'whatsapp'

export interface Booking {
  id: string
  code: string
  plotId: string
  driverName: string
  phone: string
  vehicleNo: string
  start: string // ISO
  hours: number
  amount: number // parking charge
  convenienceFee: number
  commission: number
  ownerPayout: number
  paymentMethod: PaymentMethod
  paymentRef: string
  channel: Channel
  status: BookingStatus
  checkedInAt?: string
  checkedOutAt?: string
  payoutId?: string
  createdAt: string
}

export interface Pass {
  id: string
  code: string
  plotId: string
  holderName: string
  vehicleNo: string
  corporateClient?: string
  amount: number
  commission: number
  ownerPayout: number
  validFrom: string
  validTo: string
  payoutId?: string
  createdAt: string
}

/** Daily aggregate of cash walk-ins an owner logs, used for the "share booked through app" metric. */
export interface WalkInLog {
  plotId: string
  date: string // YYYY-MM-DD
  cars: number
  hours: number
  amount: number
}

export type DisputeStatus = 'open' | 'resolved'

export interface Dispute {
  id: string
  bookingId: string
  raisedBy: 'driver' | 'owner'
  reason: string
  status: DisputeStatus
  resolution?: string
  createdAt: string
}

export interface Payout {
  id: string
  ownerId: string
  createdAt: string
  gross: number
  commission: number
  amount: number
  items: number
  utr: string
}

export interface Settings {
  commissionPct: number
  convenienceFee: number
}

export interface DB {
  version: number
  settings: Settings
  owners: Owner[]
  plots: Plot[]
  bookings: Booking[]
  passes: Pass[]
  walkIns: WalkInLog[]
  disputes: Dispute[]
  payouts: Payout[]
}
