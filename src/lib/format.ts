const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('en-IN')

export const rupees = (n: number) => inr.format(Math.round(n))
export const fmtNum = (n: number) => num.format(Math.round(n))
export const pct = (n: number) => `${Math.round(n * 100)}%`

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

export const fmtDateTime = (iso: string) => `${fmtDate(iso)}, ${fmtTime(iso)}`

/** Local YYYY-MM-DD. */
export const dayKey = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

export const addHours = (iso: string, h: number) => new Date(new Date(iso).getTime() + h * 3_600_000).toISOString()

export const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`

/** Short human-friendly code shown on tickets and typed at the gate. */
export const ticketCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return s
}

export const normaliseVehicle = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '')
