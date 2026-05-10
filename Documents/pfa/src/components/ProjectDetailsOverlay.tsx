import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Calendar, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Circle,
  TrendingUp,
  Map as MapIcon,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Project, ProjectDocument } from '../types';
import { cn } from '../lib/utils';

import ProjectMap from './ProjectMap';
import { dbService } from '../services/db';

import { useTranslation } from 'react-i18next';

interface ProjectDetailsOverlayProps {
  project: Project | null;
  documents: ProjectDocument[];
  onClose: () => void;
  onViewDocument?: (doc: ProjectDocument) => void;
  isTopographer?: boolean;
}

export default function ProjectDetailsOverlay({ project, documents, onClose, onViewDocument, isTopographer = false }: ProjectDetailsOverlayProps) {
  const { t } = useTranslation();
  if (!project) return null;

  const STEPS = [
    t('project.steps.request_sent'),
    t('project.steps.accepted'),
    t('project.steps.levy_started'),
    t('project.steps.analysis'),
    t('project.steps.validation'),
    t('project.steps.delivery')
  ];

  const currentStep = project.currentStep ?? 0;
  const projectDocs = documents.filter(d => d.projectId === project.id);

  const handleSaveMap = async (mapData: string) => {
    try {
      const geojson = JSON.parse(mapData);
      let totalArea = 0;
      let totalPerimeter = 0;

      // Simple extraction of measurements from GeoJSON
      if (geojson.features) {
        geojson.features.forEach((feature: any) => {
          if (feature.geometry.type === 'Polygon') {
            const coords = feature.geometry.coordinates[0].map((c: any) => ({ lat: c[1], lng: c[0] }));
            totalArea += dbService.calculateArea(coords);
            totalPerimeter += dbService.calculatePerimeter(coords);
          } else if (feature.geometry.type === 'LineString') {
            const coords = feature.geometry.coordinates.map((c: any) => ({ lat: c[1], lng: c[0] }));
            totalPerimeter += dbService.calculatePerimeter(coords);
          }
        });
      }

      await dbService.updateProject(project.id, { 
        mapData,
        area: totalArea > 0 ? Math.round(totalArea * 100) / 100 : project.area,
        perimeter: totalPerimeter > 0 ? Math.round(totalPerimeter * 100) / 100 : project.perimeter
      });
    } catch (error) {
      console.error("Failed to save map data", error);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-8">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-card border w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col relative z-10"
        >
          {/* Header */}
          <div className="p-6 md:p-8 border-b bg-muted/30 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                  project.status === 'COMPLETED' ? "bg-green-500/10 text-green-600" : "bg-primary/10 text-primary"
                )}>
                  {project.status.replace('_', ' ')}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">ID: {project.id.slice(0, 8)}</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold">{project.name}</h2>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  <span>{project.location || t('project.location_not_defined')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span>{t('project.created_at', { date: project.startDate || '01/04/2026' })}</span>
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-xl transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-10">
            {/* Interactive Map Section */}
            <section className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="font-bold flex items-center gap-2">
                        <MapIcon className="w-5 h-5 text-primary" />
                        {t('project.map_title')}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isTopographer 
                          ? t('project.map_subtitle_topo')
                          : t('project.map_subtitle_client')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="h-[400px] w-full rounded-2xl border-2 border-muted overflow-hidden relative group shadow-inner">
                    <ProjectMap 
                      project={project} 
                      onSave={handleSaveMap}
                      readOnly={false} // Both can draw as requested
                    />
                  </div>
                </div>

                <div className="w-full md:w-80 space-y-4">
                  <div className="bg-zinc-900 text-white rounded-2xl p-5 shadow-xl h-full border border-white/5">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      {t('project.tech_sheet')}
                    </h3>
                    <div className="space-y-6">
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase text-white/40 font-bold tracking-widest">{t('project.total_area')}</p>
                        <p className="text-2xl font-black">{project.area ? `${project.area.toLocaleString('fr-FR')} m²` : '---'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase text-white/40 font-bold tracking-widest">{t('project.perimeter')}</p>
                        <p className="text-xl font-bold">{project.perimeter ? `${project.perimeter.toLocaleString('fr-FR')} m` : '---'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase text-white/40 font-bold tracking-widest">{t('project.altitude')}</p>
                        <p className="text-xl font-mono">{project.coordinates?.z ? `${project.coordinates.z} m` : '---'}</p>
                      </div>
                      <div className="pt-4 mt-4 border-t border-white/10">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white/40">{t('project.latitude')}</span>
                          <span className="font-mono text-[10px]">{project.coordinates?.lat.toFixed(6)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs mt-2">
                          <span className="text-white/40">{t('project.longitude')}</span>
                          <span className="font-mono text-[10px]">{project.coordinates?.lng.toFixed(6)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-muted/50 p-4 rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-1">{t('project.progress')}</p>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold">{project.progress}%</span>
                  <TrendingUp className="w-4 h-4 text-green-500 mb-1" />
                </div>
                <div className="mt-3 h-2 bg-background rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-1000" 
                    style={{ width: `${project.progress}%` }} 
                  />
                </div>
              </div>
              <div className="bg-muted/50 p-4 rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-1">{t('project.start_date')}</p>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="text-lg font-bold">{project.startDate || '01/04/2026'}</span>
                </div>
              </div>
              <div className="bg-muted/50 p-4 rounded-2xl">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-1">{t('project.est_delivery')}</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-500" />
                  <span className="text-lg font-bold">{project.estimatedDelivery || '10/05/2026'}</span>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <section>
              <h3 className="font-bold mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Timeline du Projet
              </h3>
              <div className="relative space-y-8 pl-8 md:pl-0">
                <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-border -translate-x-1/2 md:block" />
                
                {STEPS.map((step, i) => {
                  const isCompleted = i < currentStep;
                  const isCurrent = i === currentStep;
                  
                  return (
                    <div key={`overlay-step-${i}`} className={cn(
                      "relative flex flex-col md:flex-row items-start md:items-center gap-4 transition-all",
                      !isCompleted && !isCurrent && "opacity-40"
                    )}>
                      {/* Desktop Left or Mobile Right */}
                      <div className="hidden md:flex flex-1 justify-end text-right">
                        {i % 2 === 0 && (
                          <div>
                            <p className={cn("font-bold", isCurrent && "text-primary")}>{step}</p>
                            <p className="text-xs text-muted-foreground">
                              {isCompleted ? 'Validé' : isCurrent ? 'En cours' : 'À venir'}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Center Point */}
                      <div className="absolute left-0 md:relative md:left-auto z-10 flex items-center justify-center -translate-x-1/2 md:translate-x-0">
                        <div className={cn(
                          "w-6 h-6 rounded-full border-4 border-card flex items-center justify-center transition-all duration-500 shadow-sm",
                          isCompleted ? "bg-green-500" : isCurrent ? "bg-primary animate-pulse" : "bg-muted"
                        )}>
                          {isCompleted ? (
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          ) : (
                            <Circle className={cn("w-2 h-2 text-white", isCurrent ? "opacity-100" : "opacity-0")} />
                          )}
                        </div>
                      </div>

                      {/* Desktop Right or Mobile Right */}
                      <div className="flex-1 md:text-left ml-4 md:ml-0">
                        <div className="md:hidden">
                           <p className={cn("font-bold", isCurrent && "text-primary")}>{step}</p>
                           <p className="text-xs text-muted-foreground">
                             {isCompleted ? 'Validé' : isCurrent ? 'En cours' : 'À venir'}
                           </p>
                        </div>
                        {i % 2 !== 0 && (
                          <div className="hidden md:block">
                            <p className={cn("font-bold", isCurrent && "text-primary")}>{step}</p>
                            <p className="text-xs text-muted-foreground">
                              {isCompleted ? 'Validé' : isCurrent ? 'En cours' : 'À venir'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Documents & Files */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Documents & Plans
                </h3>
                <span className="text-xs text-muted-foreground">{projectDocs.length} fichiers</span>
              </div>
              
              {projectDocs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {projectDocs.map((doc, i) => (
                    <div 
                      key={`overlay-doc-${doc.id}-${i}`} 
                      onClick={() => onViewDocument?.(doc)}
                      className="flex items-center justify-between p-4 bg-muted/30 border rounded-xl hover:bg-muted transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-background rounded-lg group-hover:text-primary transition-colors">
                           <FileText className="w-5 h-5 text-muted-foreground" />
                         </div>
                         <div>
                           <p className="text-sm font-bold truncate max-w-[150px]">{doc.name}</p>
                           <p className="text-[10px] text-muted-foreground uppercase">{doc.type} • {doc.size}</p>
                         </div>
                      </div>
                      <div className="p-2 text-primary hover:bg-primary/10 rounded-lg">
                        <TrendingUp className="w-4 h-4 rotate-90" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-muted/20 border border-dashed rounded-2xl text-muted-foreground italic">
                  Aucun document n'a encore été mis en ligne pour ce projet.
                </div>
              )}
            </section>

            {/* Support Box */}
            <div className="p-6 bg-primary/5 border border-primary/10 rounded-2xl flex items-start gap-4">
              <div className="p-2 bg-primary/10 rounded-xl">
                 <AlertCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Besoin d'aide ?</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Si vous avez des questions concernant l'avancement de votre projet ou si vous constatez une erreur, contactez directement votre topographe via la messagerie.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
