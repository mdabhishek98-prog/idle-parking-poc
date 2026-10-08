import { useEffect } from 'react'
import { AdvancedMarker, APIProvider, Map, useMap } from '@vis.gl/react-google-maps'
import type { Plot } from '../types'
import { MAP_CENTER, MAP_ZOOM, pinTone, type PlotMapProps } from './mapShared'

// Advanced markers need a Map ID; Google's DEMO_MAP_ID works for development.
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'

function PanTo({ target }: { target: Plot | null }) {
  const map = useMap()
  useEffect(() => {
    if (!map || !target) return
    map.panTo({ lat: target.lat, lng: target.lng })
    if ((map.getZoom() ?? 0) < 15) map.setZoom(15)
  }, [map, target])
  return null
}

export default function GoogleMap({ apiKey, pins, selectedId, onSelect, onPick, picked, height = 460 }: PlotMapProps & { apiKey: string }) {
  const selected = pins.find(p => p.plot.id === selectedId)?.plot ?? null
  return (
    <div className="map-wrap" style={{ height }}>
      <APIProvider apiKey={apiKey}>
        <Map
          mapId={MAP_ID}
          defaultCenter={MAP_CENTER}
          defaultZoom={MAP_ZOOM}
          gestureHandling="greedy"
          mapTypeControl={false}
          streetViewControl={false}
          clickableIcons={false}
          onClick={e => {
            const ll = e.detail.latLng
            if (ll) onPick?.(ll.lat, ll.lng)
          }}
          style={{ width: '100%', height: '100%' }}
        >
          {pins.map(({ plot, free }) => {
            const muted = plot.status !== 'live'
            return (
              <AdvancedMarker
                key={plot.id}
                position={{ lat: plot.lat, lng: plot.lng }}
                title={`${plot.name} · ${muted ? plot.status : `${free} free`}`}
                zIndex={plot.id === selectedId ? 1000 : undefined}
                onClick={() => onSelect?.(plot.id)}
              >
                <div className={`pin pin-${pinTone(free, muted)} ${plot.id === selectedId ? 'pin-selected' : ''}`}>
                  <span>P</span>
                  <b>{muted ? '–' : free}</b>
                </div>
              </AdvancedMarker>
            )
          })}
          {picked && (
            <AdvancedMarker position={picked}>
              <div className="pin pin-new"><span>+</span><b>New</b></div>
            </AdvancedMarker>
          )}
          <PanTo target={selected} />
        </Map>
      </APIProvider>
    </div>
  )
}
