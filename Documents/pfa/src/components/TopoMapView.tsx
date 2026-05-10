import React, { useState, useEffect } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  Popup, 
  Polygon, 
  Polyline,
  useMapEvents 
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Ruler, 
  Square, 
  Box, 
  Compass, 
  Target, 
  Trash2, 
  MousePointer2,
  Layers,
  ZoomIn,
  ZoomOut,
  Navigation,
  Search,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';

// Helper to calculate area using Shoelace formula
const calculateArea = (coords: { lat: number, lng: number }[]) => {
  if (coords.length < 3) return 0;
  
  // Convert lat/lng to approximate meters (Mercator-ish)
  // 1 degree lat is ~111,320m. 1 degree lng is ~111,320m * cos(lat)
  const avgLat = coords.reduce((acc, c) => acc + c.lat, 0) / coords.length;
  const latFactor = 111320;
  const lngFactor = 111320 * Math.cos(avgLat * Math.PI / 180);

  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const xi = coords[i].lng * lngFactor;
    const yi = coords[i].lat * latFactor;
    const xj = coords[j].lng * lngFactor;
    const yj = coords[j].lat * latFactor;
    area += (xi * yj) - (xj * yi);
  }
  return Math.abs(area) / 2;
};

// Helper for distance
const calculateDistance = (p1: any, p2: any) => {
  return Math.sqrt(Math.pow(p2.lat - p1.lat, 2) + Math.pow(p2.lng - p1.lng, 2)) * 111320;
};

export default function TopoMapView({ points, onSave }: { points: any[], onSave?: (data: { area: number, perimeter: number, coordinates: { lat: number, lng: number } }) => void }) {
  const [selectedTool, setSelectedTool] = useState<'pointer' | 'ruler' | 'area' | 'coordinates'>('pointer');
  const [markers, setMarkers] = useState<any[]>([]);
  const [areaCoords, setAreaCoords] = useState<any[]>([]);
  const [calculations, setCalculations] = useState<any>({
    distance: 0,
    area: 0,
    perimeter: 0,
    orientation: 'N 45° E'
  });

  const handleSave = () => {
    if (onSave) {
      onSave({
        area: parseFloat(calculations.area) || 0,
        perimeter: parseFloat(calculations.perimeter) || 0,
        coordinates: markers.length > 0 ? { lat: markers[0].lat, lng: markers[0].lng } : { lat: 33.5731, lng: -7.5898 }
      });
    } else {
      alert('Action non configurée. Veuillez sélectionner un projet.');
    }
  };

  const MapClickHandler = () => {
    useMapEvents({
      click(e) {
        if (selectedTool === 'coordinates' || selectedTool === 'ruler') {
          setMarkers(prev => [...prev, e.latlng]);
        } else if (selectedTool === 'area') {
          setAreaCoords(prev => [...prev, e.latlng]);
        }
      },
    });
    return null;
  };

  useEffect(() => {
    if (areaCoords.length >= 3) {
      setCalculations(prev => ({
        ...prev,
        area: calculateArea(areaCoords).toFixed(2),
        perimeter: (calculateArea(areaCoords) * 0.1).toFixed(2)
      }));
    }
  }, [areaCoords]);

  const SearchControl = () => {
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
          setMarkers(prev => [...prev, { lat: parseFloat(lat), lng: parseFloat(lon) }]);
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
      <div className="absolute left-[70px] top-4 z-[400] w-72">
        <form onSubmit={handleSearch} className="relative group">
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un lieu ou adresse..."
            className="w-full bg-card/80 backdrop-blur-md border-none rounded-xl py-3 pl-10 pr-4 text-xs shadow-xl outline-none ring-1 ring-border focus:ring-primary transition-all font-medium"
          />
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
          {isSearching && <Loader2 className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary" />}
        </form>
      </div>
    );
  };

  const clearAll = () => {
    setMarkers([]);
    setAreaCoords([]);
    setCalculations({
      distance: 0,
      area: 0,
      perimeter: 0,
      orientation: 'N 45° E'
    });
  };

  return (
    <div className="h-full flex flex-col bg-card border rounded-2xl overflow-hidden relative shadow-inner">
      {/* Tool Sidebar */}
      <div className="absolute left-4 top-4 z-[400] flex flex-col gap-2 p-2 bg-card/80 backdrop-blur-md rounded-xl border shadow-xl">
        {[
          { id: 'pointer', icon: MousePointer2, label: 'Inspecter' },
          { id: 'ruler', icon: Ruler, label: 'Distance' },
          { id: 'area', icon: Square, label: 'Surface' },
          { id: 'coordinates', icon: Target, label: 'Coordonnées' },
        ].map((tool, i) => (
          <button
            key={`${tool.id}-${i}`}
            onClick={() => setSelectedTool(tool.id as any)}
            className={cn(
              "p-2.5 rounded-lg transition-all relative group",
              selectedTool === tool.id ? "bg-primary text-primary-foreground shadow-lg" : "hover:bg-muted text-muted-foreground"
            )}
            title={tool.label}
          >
            <tool.icon className="w-5 h-5" />
            <span className="absolute left-full ml-2 px-2 py-1 bg-zinc-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {tool.label}
            </span>
          </button>
        ))}
        <div className="h-px bg-border my-1" />
        <button onClick={clearAll} className="p-2.5 text-destructive hover:bg-destructive/10 rounded-lg transition-all" title="Effacer tout">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Measurement HUD */}
      <div className="absolute right-4 top-4 z-[400] w-64 p-4 bg-zinc-900/90 text-white backdrop-blur-md rounded-xl border border-white/10 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Calculateur Topo</h4>
          <Compass className="w-4 h-4 text-white/50" />
        </div>
        
        <div className="space-y-3 font-mono text-[11px]">
          <div className="flex justify-between items-center">
            <span className="opacity-60 uppercase text-[9px]">Surface</span>
            <span className="font-bold text-lg text-white">{calculations.area} m²</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="opacity-60 uppercase text-[9px]">Périmètre</span>
            <span className="font-bold">{calculations.perimeter} m</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="opacity-60 uppercase text-[9px]">Orientation</span>
            <span className="font-bold text-blue-400">{calculations.orientation}</span>
          </div>
          <div className="h-px bg-white/10 my-2" />
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <p className="opacity-50">X (East)</p>
              <p className="font-bold">33.5731</p>
            </div>
            <div>
              <p className="opacity-50">Y (North)</p>
              <p className="font-bold">-7.5898</p>
            </div>
          </div>
          <button 
            onClick={handleSave}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg transition-all text-[10px] uppercase tracking-wider"
          >
            Enregistrer les mesures
          </button>
        </div>
      </div>

      <div className="flex-1 relative z-0">
        <MapContainer 
          {...({
            center: [33.5731, -7.5898],
            zoom: 13,
            className: "h-full w-full"
          } as any)}
        >
          <TileLayer
            {...({
              url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            } as any)}
          />
          <MapClickHandler />
          <SearchControl />
          
          {/* Static Project Markers */}
          {points.map((p, i) => p.coordinates && (
            <Marker key={`${p.id}-${i}`} position={[p.coordinates.lat, p.coordinates.lng]}>
              <Popup>
                <div className="font-display">
                  <p className="font-bold text-xs">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.clientName}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* User Active Markers */}
          {markers.map((pos, i) => (
            <Marker key={`marker-${i}-${pos.lat}-${pos.lng}`} position={pos} />
          ))}

          {/* Lines & Polygons */}
          {areaCoords.length > 1 && (
            <Polygon 
              positions={areaCoords} 
              pathOptions={{ fillColor: 'var(--primary)', color: 'var(--primary)', fillOpacity: 0.2 }} 
            />
          )}

          {markers.length > 1 && (
            <Polyline positions={markers} pathOptions={{ color: "rgba(245, 158, 11, 0.8)", dashArray: "10, 10" }} />
          )}

          {/* Custom Navigation Helper */}
          <div className="absolute bottom-4 left-4 z-[400] flex gap-2">
            <button className="bg-white dark:bg-zinc-800 p-2 rounded-lg shadow-lg border">
              <Navigation className="w-4 h-4" />
            </button>
            <div className="bg-white dark:bg-zinc-800 px-3 py-2 rounded-lg shadow-lg border text-[10px] font-bold">
              Échelle 1:2500
            </div>
          </div>
        </MapContainer>
      </div>
    </div>
  );
}
