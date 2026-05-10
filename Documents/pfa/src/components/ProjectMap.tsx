import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { Project } from '../types';
import { Search, Loader2 } from 'lucide-react';
import { useState } from 'react';

// Fix Leaflet icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIconRetina,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface ProjectMapProps {
  project: Project;
  onSave?: (mapData: string) => void;
  readOnly?: boolean;
}

function GeomanControls({ onSave, initialData, readOnly }: { onSave?: (data: string) => void, initialData?: string, readOnly?: boolean }) {
  const map = useMap();
  const geojsonLayerRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    if (!map) return;

    // Initialize layer group for GeoJSON
    if (!geojsonLayerRef.current) {
      geojsonLayerRef.current = L.featureGroup().addTo(map);
    }

    if (initialData) {
      try {
        const data = JSON.parse(initialData);
        L.geoJSON(data).eachLayer((layer: any) => {
          if (geojsonLayerRef.current) {
            geojsonLayerRef.current.addLayer(layer);
          }
        });
        
        // Fit bounds if data exists
        if (geojsonLayerRef.current.getLayers().length > 0) {
          map.fitBounds(geojsonLayerRef.current.getBounds(), { padding: [20, 20] });
        }
      } catch (e) {
        console.error("Failed to parse initial map data", e);
      }
    }

    if (!readOnly) {
      map.pm.addControls({
        position: 'topleft',
        drawMarker: true,
        drawCircle: false,
        drawPolyline: true,
        drawRectangle: true,
        drawPolygon: true,
        editMode: true,
        dragMode: true,
        removalMode: true,
      });

      const handleUpdate = () => {
        if (!geojsonLayerRef.current) return;
        const data = geojsonLayerRef.current.toGeoJSON();
        if (onSave) {
          onSave(JSON.stringify(data));
        }
      };

      map.on('pm:create', (e: any) => {
        if (geojsonLayerRef.current) {
          geojsonLayerRef.current.addLayer(e.layer);
        }
        handleUpdate();
      });

      map.on('pm:remove', handleUpdate);
      map.on('pm:edit', handleUpdate);
      map.on('pm:dragend', handleUpdate);
      map.on('pm:rotateend', handleUpdate);
    }

    return () => {
      if (!readOnly) {
        map.pm.removeControls();
      }
    };
  }, [map, initialData, readOnly, onSave]);

  return null;
}

function SearchControl() {
  const map = useMapEvents({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        map.flyTo([parseFloat(lat), parseFloat(lon)], 16);
      } else {
        alert("Lieu non trouvé.");
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="absolute right-4 top-4 z-[1000] w-64 md:w-80">
      <form onSubmit={handleSearch} className="relative group">
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher une adresse/lieu..."
          className="w-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-border rounded-xl py-2.5 pl-9 pr-4 text-[10px] shadow-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
        />
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
        {isSearching && <Loader2 className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary" />}
      </form>
    </div>
  );
}

export default function ProjectMap({ project, onSave, readOnly = false }: ProjectMapProps) {
  const position: L.LatLngExpression = project.coordinates 
    ? [project.coordinates.lat, project.coordinates.lng] 
    : [33.5731, -7.5898]; // Default Casablanca

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border shadow-inner relative z-0">
      <MapContainer 
        center={position} 
        zoom={13} 
        scrollWheelZoom={true} 
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeomanControls 
          onSave={onSave} 
          initialData={project.mapData} 
          readOnly={readOnly} 
        />
        {!readOnly && <SearchControl />}
      </MapContainer>
      
      {!readOnly && (
        <div className="absolute bottom-6 left-6 z-[1000] flex flex-col gap-2">
          <div className="bg-zinc-900/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-white/10 min-w-[180px]">
             <div className="flex items-center gap-2 mb-3">
               <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
               <p className="text-[10px] font-black uppercase tracking-widest text-primary">Mesures Live</p>
             </div>
             <div className="space-y-2">
               <div className="flex justify-between items-center">
                 <span className="text-[9px] uppercase font-bold text-white/50">Surface</span>
                 <span className="font-mono text-xs font-black">{project.area ? `${project.area.toLocaleString('fr-FR')} m²` : '---'}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-[9px] uppercase font-bold text-white/50">Périmètre</span>
                 <span className="font-mono text-xs font-black">{project.perimeter ? `${project.perimeter.toLocaleString('fr-FR')} m` : '---'}</span>
               </div>
             </div>
             <p className="text-[8px] text-white/30 mt-3 pt-2 border-t border-white/5 italic">
               Dessinez un polygone pour calculer la surface.
             </p>
          </div>
        </div>
      )}

      {readOnly && (
        <div className="absolute top-4 right-4 bg-background/80 backdrop-blur rounded-lg px-3 py-1.5 text-xs font-bold shadow-md z-[1000] border">
          Mode Consultation
        </div>
      )}
    </div>
  );
}
