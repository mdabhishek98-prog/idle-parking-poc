import { useEffect } from 'react'
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Plot } from '../types'

export interface MapPin {
  plot: Plot
  free: number
}

function pinIcon(free: number, selected: boolean, muted: boolean) {
  const tone = muted ? 'muted' : free === 0 ? 'full' : free < 5 ? 'low' : 'ok'
  return L.divIcon({
    className: '',
    html: `<div class="pin pin-${tone} ${selected ? 'pin-selected' : ''}"><span>P</span><b>${muted ? '–' : free}</b></div>`,
    iconSize: [54, 30],
    iconAnchor: [27, 30],
  })
}

function FlyTo({ target }: { target: Plot | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15), { duration: 0.6 })
  }, [target, map])
  return null
}

function ClickToPick({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onPick?.(e.latlng.lat, e.latlng.lng) })
  return null
}

export default function PlotMap({
  pins,
  selectedId,
  onSelect,
  onPick,
  picked,
  height = 460,
}: {
  pins: MapPin[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  onPick?: (lat: number, lng: number) => void
  picked?: { lat: number; lng: number } | null
  height?: number
}) {
  const selected = pins.find(p => p.plot.id === selectedId)?.plot ?? null
  return (
    <div className="map-wrap" style={{ height }}>
      <MapContainer center={[12.9795, 77.6505]} zoom={14} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pins.map(({ plot, free }) => (
          <Marker
            key={plot.id}
            position={[plot.lat, plot.lng]}
            icon={pinIcon(free, plot.id === selectedId, plot.status !== 'live')}
            eventHandlers={{ click: () => onSelect?.(plot.id) }}
          >
            <Tooltip direction="top" offset={[0, -28]}>
              {plot.name} · {plot.status === 'live' ? `${free} free` : plot.status}
            </Tooltip>
          </Marker>
        ))}
        {picked && (
          <Marker position={[picked.lat, picked.lng]} icon={L.divIcon({ className: '', html: '<div class="pin pin-new"><span>+</span><b>New</b></div>', iconSize: [54, 30], iconAnchor: [27, 30] })} />
        )}
        <FlyTo target={selected} />
        <ClickToPick onPick={onPick} />
      </MapContainer>
    </div>
  )
}
