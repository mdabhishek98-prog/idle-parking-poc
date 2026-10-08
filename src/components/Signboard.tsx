import { QRCodeSVG } from 'qrcode.react'
import type { Plot } from '../types'
import { rupees } from '../lib/format'
import { is24x7 } from '../store/store'

export const plotLink = (p: Plot) => `${window.location.origin}${import.meta.env.BASE_URL}driver?plot=${p.id}`

/** Printable QR signboard from the owner setup kit. */
export default function Signboard({ plot }: { plot: Plot }) {
  return (
    <div className="signboard" id="signboard">
      <div className="sign-p">P</div>
      <div className="sign-title">PAY & PARK</div>
      <div className="sign-name">{plot.name}</div>
      <QRCodeSVG value={plotLink(plot)} size={190} marginSize={2} />
      <div className="sign-scan">Scan to book & pay by UPI</div>
      <div className="sign-rate">{rupees(plot.pricePerHour)} / hour · Monthly pass {rupees(plot.monthlyPassPrice)}</div>
      <div className="sign-hours">{is24x7(plot) ? 'Open 24 × 7' : `Open ${plot.opensAt} – ${plot.closesAt}`} · {plot.totalSlots} slots</div>
      <div className="sign-foot">Lot operated by the landowner · Bookings via PlotPark</div>
    </div>
  )
}
