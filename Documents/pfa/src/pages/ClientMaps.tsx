import React from 'react';
import { motion } from 'motion/react';
import { MapPin, Navigation, Info, Maximize2, Search, Send, Crosshair, Loader2, Download } from 'lucide-react';
import { Project, User } from '../types';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { dbService } from '../services/db';

interface ClientMapsProps {
  user: User;
  projects: Project[];
}

export default function ClientMaps({ user, projects }: ClientMapsProps) {
  const navigate = useNavigate();
  const [selectedProject, setSelectedProject] = React.useState<Project | null>(projects[0] || null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isLocating, setIsLocating] = React.useState(false);
  const [mapType, setMapType] = React.useState<'m' | 'k'>('m'); // m = map, k = satellite

  const handleShareLocation = () => {
    const locationStr = searchQuery || selectedProject?.location || 'Ma position';
    // Deep link to Google Maps with Marker (q=) and Center (ll=)
    const googleMapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(locationStr)}&z=17&t=k`;
    
    // Navigate to messages with pre-filled state
    navigate('/messages', { 
      state: { 
        selectedRecipientId: selectedProject?.topographerId || 'topo-123',
        initialMessage: `📍 Voici la localisation précise de mon terrain pour notre visite :\n\nLieu : ${locationStr}\n\nOuvrir dans Google Maps : ${googleMapsUrl}`
      } 
    });
  };

  const handleGetCurrentLocation = () => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const coords = `${latitude},${longitude}`;
          setSearchQuery(coords);
          setIsLocating(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Impossible de récupérer la position. Assurez-vous d'avoir activé la géolocalisation.");
          setIsLocating(false);
        }
      );
    } else {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
      setIsLocating(false);
    }
  };

  const [isSaving, setIsSaving] = React.useState(false);

  const handleSaveLocation = async () => {
    if (!searchQuery) return;
    setIsSaving(true);
    try {
      await dbService.addProject({
        name: searchQuery,
        location: searchQuery,
        clientId: user.id,
        clientName: user.name,
        topographerId: 'topo-123', // Initial fallback
        status: 'PENDING',
        progress: 0,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        description: `Lieu enregistré via recherche Maps le ${new Date().toLocaleDateString()}`,
        coordinates: { lat: 33.5731, lng: -7.5898, z: 0 } // Dummy coordinates for now
      });
      alert('Lieu enregistré avec succès dans "Mes Terrains"');
      setSearchQuery('');
    } catch (e) {
      console.error(e);
      alert('Erreur lors de l\'enregistrement');
    } finally {
      setIsSaving(false);
    }
  };

  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(searchQuery || selectedProject?.location || 'Casablanca, Maroc')}&t=${mapType}&z=18&ie=UTF8&iwloc=B&output=embed`;

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mes Terrains sur Maps</h1>
          <p className="text-muted-foreground text-sm">Visualisez et recherchez l'emplacement de vos projets en temps réel.</p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-96 group">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
            <input 
              type="text"
              placeholder="Rechercher un lieu, une ville ou des coordonnées..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-card border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm outline-none text-sm"
            />
          </div>
          {searchQuery && (
            <button 
              onClick={handleSaveLocation}
              disabled={isSaving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-bold text-xs shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
              Enregistrer
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
        {/* Map Container */}
        <div className="flex-1 bg-card border rounded-3xl overflow-hidden shadow-sm relative group">
          <iframe 
            key={`${mapUrl}-${mapType}`} // Force refresh
            width="100%" 
            height="100%" 
            frameBorder="0" 
            style={{ border: 0 }}
            src={mapUrl}
            title="Google Maps"
          ></iframe>
           {/* Fallback/Overlay if no real map key */}
          <div className="absolute inset-0 pointer-events-none border-4 border-primary/10 rounded-3xl group-hover:border-primary/20 transition-all"></div>
          
          <div className="absolute top-6 left-6 right-6 flex flex-wrap justify-between gap-4 pointer-events-none">
            <div className="flex gap-2 pointer-events-auto">
              <button 
                onClick={handleGetCurrentLocation}
                disabled={isLocating}
                className="px-4 py-2 bg-background border-2 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4 text-rose-500" />}
                <span className="text-xs">Ma position</span>
              </button>

              <button 
                onClick={() => setMapType(mapType === 'm' ? 'k' : 'm')}
                className="px-4 py-2 bg-background border-2 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all text-xs"
              >
                {mapType === 'k' ? 'Vue Plan' : 'Vue Satellite'}
              </button>
            </div>
            
            {(searchQuery || selectedProject) && (
              <button 
                onClick={handleShareLocation}
                className="px-5 py-2.5 bg-blue-600 text-white border-none rounded-xl font-bold flex items-center gap-2 shadow-xl hover:scale-105 active:scale-95 transition-all pointer-events-auto ring-4 ring-blue-500/10"
              >
                <Send className="w-4 h-4 fill-current" />
                <span className="text-xs">Partager au Topographe</span>
              </button>
            )}
          </div>
          
          <button 
            onClick={() => {
              const link = document.createElement('a');
              link.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(selectedProject?.mapData || { type: 'FeatureCollection', features: [] }));
              link.download = `plan_${selectedProject?.name || 'site'}.geojson`;
              link.click();
              alert('Téléchargement du plan GeoJSON lancé.');
            }}
            className="absolute bottom-6 left-6 bg-white text-black border px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-2xl hover:scale-105 active:scale-95 transition-all pointer-events-auto"
          >
            <Download className="w-5 h-5" />
            <span>Télécharger Plan</span>
          </button>

          <button 
            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery || selectedProject?.location || '')}`, '_blank')}
            className="absolute bottom-6 right-6 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-2xl hover:scale-105 active:scale-95 transition-all pointer-events-auto"
          >
            <Maximize2 className="w-5 h-5" />
            <span>Ouvrir dans Google Maps</span>
          </button>
        </div>

        {/* Sidebar Projects */}
        <div className="w-full lg:w-80 flex flex-col gap-4 overflow-y-auto pr-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground px-2">Liste des sites</h3>
          {projects.map((project, i) => (
            <motion.button
              key={`project-map-${project.id}-${i}`}
              whileHover={{ x: 5 }}
              onClick={() => {
                setSelectedProject(project);
                setSearchQuery('');
              }}
              className={cn(
                "p-4 rounded-2xl border text-left transition-all",
                selectedProject?.id === project.id 
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" 
                  : "bg-card hover:bg-muted"
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className={cn(
                  "p-2 rounded-lg",
                  selectedProject?.id === project.id ? "bg-white/20" : "bg-primary/10"
                )}>
                  <MapPin className={cn("w-4 h-4", selectedProject?.id === project.id ? "text-white" : "text-primary")} />
                </div>
                <div className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                  selectedProject?.id === project.id ? "bg-white/20" : "bg-muted"
                )}>
                  {project.status}
                </div>
              </div>
              <p className="font-bold text-sm truncate">{project.name}</p>
              <p className={cn(
                "text-[10px] mt-1 flex items-center gap-1",
                selectedProject?.id === project.id ? "text-white/80" : "text-muted-foreground"
              )}>
                <Navigation className="w-3 h-3" />
                {project.location}
              </p>
            </motion.button>
          ))}

          {projects.length === 0 && (
            <div className="p-8 text-center bg-muted/50 rounded-2xl border-2 border-dashed">
              <Info className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-xs text-muted-foreground">Aucun projet avec localisation trouvé.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
