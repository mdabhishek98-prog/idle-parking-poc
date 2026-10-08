import type { Plot } from '../types'

export interface MapPin {
  plot: Plot
  free: number
}

export interface PlotMapProps {
  pins: MapPin[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  onPick?: (lat: number, lng: number) => void
  picked?: { lat: number; lng: number } | null
  height?: number
}

/** Pilot area: between Indiranagar Metro and the CV Raman Nagar tech parks. */
export const MAP_CENTER = { lat: 12.9795, lng: 77.6505 }
export const MAP_ZOOM = 14

export const pinTone = (free: number, muted: boolean) => (muted ? 'muted' : free === 0 ? 'full' : free < 5 ? 'low' : 'ok')
