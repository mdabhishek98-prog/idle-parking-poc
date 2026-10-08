import { useEffect, useRef, useState } from 'react'

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector
  }
}

export const canScan = () => typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices

/** Camera QR scanner for the owner's gate screen (uses the browser's BarcodeDetector). */
export default function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    const detector = new window.BarcodeDetector!({ formats: ['qr_code'] })

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(async s => {
        stream = s
        if (!video.current || stopped) return
        video.current.srcObject = s
        await video.current.play()
        const tick = async () => {
          if (stopped || !video.current) return
          try {
            const codes = await detector.detect(video.current)
            if (codes[0]) {
              onResult(codes[0].rawValue)
              return
            }
          } catch {
            /* frame not ready */
          }
          raf = requestAnimationFrame(tick)
        }
        tick()
      })
      .catch(() => setError('Camera not available. Type the code instead.'))

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [onResult])

  return (
    <div className="scanner">
      {error ? <p className="error">{error}</p> : <video ref={video} muted playsInline />}
      <button className="btn btn-sm" onClick={onClose}>Close camera</button>
    </div>
  )
}
