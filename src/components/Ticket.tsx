import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { Booking, Pass, Plot } from '../types'
import { addHours, fmtDate, fmtDateTime, fmtTime, rupees } from '../lib/format'
import { useStore } from '../store/store'
import { Badge } from './ui'

export const QR_PREFIX = 'PLOTPARK:'

/** Accepts a typed code or the raw text of a scanned ticket QR. */
export const parseTicketCode = (raw: string) => raw.trim().toUpperCase().replace(QR_PREFIX, '')

export const STATUS_TONE = { booked: 'info', checked_in: 'good', completed: 'neutral', cancelled: 'bad' } as const
export const STATUS_LABEL = { booked: 'Booked', checked_in: 'Parked', completed: 'Completed', cancelled: 'Cancelled' } as const

export function BookingTicket({ booking, plot }: { booking: Booking; plot: Plot }) {
  const { cancelBooking, raiseDispute, db } = useStore()
  const [report, setReport] = useState('')
  const [sent, setSent] = useState(false)
  const hasDispute = db.disputes.some(d => d.bookingId === booking.id)

  return (
    <div className="ticket">
      <div className="ticket-qr">
        <QRCodeSVG value={QR_PREFIX + booking.code} size={148} marginSize={1} />
        <div className="ticket-code">{booking.code}</div>
        <small className="muted">Show at the gate</small>
      </div>
      <div className="ticket-info">
        <div className="row-between">
          <h4>{plot.name}</h4>
          <Badge tone={STATUS_TONE[booking.status]}>{STATUS_LABEL[booking.status]}</Badge>
        </div>
        <p className="muted small">{plot.address}</p>
        <table className="kv">
          <tbody>
            <tr><td>Vehicle</td><td className="mono">{booking.vehicleNo}</td></tr>
            <tr><td>When</td><td>{fmtDateTime(booking.start)} – {fmtTime(addHours(booking.start, booking.hours))}</td></tr>
            <tr><td>Paid</td><td>{rupees(booking.amount + booking.convenienceFee)} via {booking.paymentMethod.toUpperCase()}</td></tr>
            {booking.checkedInAt && <tr><td>Checked in</td><td>{fmtTime(booking.checkedInAt)}</td></tr>}
            {booking.checkedOutAt && <tr><td>Checked out</td><td>{fmtTime(booking.checkedOutAt)}</td></tr>}
          </tbody>
        </table>
        <div className="row gap">
          <a className="btn btn-sm" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${plot.lat},${plot.lng}`}>Directions</a>
          {booking.status === 'booked' && <button className="btn btn-sm btn-ghost" onClick={() => cancelBooking(booking.id)}>Cancel</button>}
        </div>
        {(booking.status === 'completed' || booking.status === 'checked_in') && !hasDispute && !sent && (
          <details className="report">
            <summary>Report a problem</summary>
            <textarea rows={2} placeholder="e.g. gate was locked, charged twice…" value={report} onChange={e => setReport(e.target.value)} />
            <button className="btn btn-sm" disabled={!report.trim()} onClick={() => { raiseDispute(booking.id, 'driver', report.trim()); setSent(true) }}>Send to support</button>
          </details>
        )}
        {(hasDispute || sent) && <p className="small muted">A support ticket is open for this booking.</p>}
      </div>
    </div>
  )
}

export function PassTicket({ pass, plot }: { pass: Pass; plot: Plot }) {
  const active = new Date(pass.validTo) > new Date()
  return (
    <div className="ticket">
      <div className="ticket-qr">
        <QRCodeSVG value={QR_PREFIX + pass.code} size={148} marginSize={1} />
        <div className="ticket-code">{pass.code}</div>
        <small className="muted">Monthly pass</small>
      </div>
      <div className="ticket-info">
        <div className="row-between">
          <h4>{plot.name}</h4>
          <Badge tone={active ? 'good' : 'neutral'}>{active ? 'Active' : 'Expired'}</Badge>
        </div>
        <table className="kv">
          <tbody>
            <tr><td>Holder</td><td>{pass.holderName}</td></tr>
            <tr><td>Vehicle</td><td className="mono">{pass.vehicleNo}</td></tr>
            {pass.corporateClient && <tr><td>Company</td><td>{pass.corporateClient}</td></tr>}
            <tr><td>Valid</td><td>{fmtDate(pass.validFrom)} – {fmtDate(pass.validTo)}</td></tr>
            <tr><td>Paid</td><td>{rupees(pass.amount)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
