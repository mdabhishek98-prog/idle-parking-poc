import { useState } from 'react'
import type { PaymentMethod } from '../types'
import { rupees } from '../lib/format'
import type { Split } from '../lib/pricing'
import { Modal } from './ui'

/**
 * Simulated payment gateway with split settlement. In the real pilot this is a
 * regulated gateway (e.g. Razorpay Route / Cashfree split payouts): the owner's share
 * is routed to the owner's account and we never hold owners' money.
 */
export default function PaymentDialog({
  title,
  s,
  ownerName,
  onPaid,
  onClose,
}: {
  title: string
  s: Split
  ownerName: string
  onPaid: (method: PaymentMethod) => void
  onClose: () => void
}) {
  const [method, setMethod] = useState<PaymentMethod>('upi')
  const [state, setState] = useState<'idle' | 'processing'>('idle')

  const pay = () => {
    setState('processing')
    setTimeout(() => onPaid(method), 1200)
  }

  return (
    <Modal title="Checkout" onClose={state === 'idle' ? onClose : () => {}}>
      <div className="gateway">
        <div className="gateway-banner">Sandbox payment gateway · no real money moves</div>
        <div className="row-between">
          <span className="muted">{title}</span>
          <strong className="big">{rupees(s.driverPays)}</strong>
        </div>

        <fieldset className="pay-methods" disabled={state !== 'idle'}>
          <legend className="sr-only">Payment method</legend>
          <label className={method === 'upi' ? 'on' : ''}>
            <input type="radio" name="m" checked={method === 'upi'} onChange={() => setMethod('upi')} />
            <span><b>UPI</b><small>Any UPI app · instant</small></span>
          </label>
          <label className={method === 'card' ? 'on' : ''}>
            <input type="radio" name="m" checked={method === 'card'} onChange={() => setMethod('card')} />
            <span><b>Card</b><small>Debit / credit</small></span>
          </label>
        </fieldset>

        <details className="split-details">
          <summary>How this payment is split</summary>
          <table className="kv">
            <tbody>
              <tr><td>Parking charge</td><td>{rupees(s.amount)}</td></tr>
              {s.convenienceFee > 0 && <tr><td>Convenience fee (to platform)</td><td>{rupees(s.convenienceFee)}</td></tr>}
              <tr><td>Platform commission (deducted from owner)</td><td>− {rupees(s.commission)}</td></tr>
              <tr className="strong"><td>Auto-payout to {ownerName}</td><td>{rupees(s.ownerPayout)}</td></tr>
            </tbody>
          </table>
        </details>

        <button className="btn btn-primary btn-block" onClick={pay} disabled={state !== 'idle'}>
          {state === 'processing' ? <span className="spinner" aria-label="Processing" /> : `Pay ${rupees(s.driverPays)}`}
        </button>
      </div>
    </Modal>
  )
}
