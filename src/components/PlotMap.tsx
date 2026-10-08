import GoogleMap from './GoogleMap'
import LeafletMap from './LeafletMap'
import type { PlotMapProps } from './mapShared'

export type { MapPin } from './mapShared'

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

/** Google Maps when VITE_GOOGLE_MAPS_API_KEY is set at build time, otherwise OpenStreetMap. */
export default function PlotMap(props: PlotMapProps) {
  return GOOGLE_KEY ? <GoogleMap apiKey={GOOGLE_KEY} {...props} /> : <LeafletMap {...props} />
}
