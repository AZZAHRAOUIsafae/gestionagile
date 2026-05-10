import React from 'react';
import { Project } from '../types';
import { Calendar, MapPin, Clock, ArrowRight, Star } from 'lucide-react';
import { cn } from '../lib/utils';

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
  onRate?: (project: Project) => void;
}

export default function ProjectCard({ project, onClick, onRate }: ProjectCardProps) {
  const statusColors = {
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    VALIDATION: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    READY: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    MODIFICATION_REQUESTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div 
      className="bg-card border rounded-2xl p-6 hover:shadow-lg transition-all cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{project.name}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{project.description}</p>
        </div>
        <span className={cn("px-3 py-1 rounded-full text-xs font-semibold", statusColors[project.status])}>
          {project.status.replace('_', ' ')}
        </span>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>Deadline: {new Date(project.deadline).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span>{project.location || 'Localisation non définie'}</span>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex justify-between items-end mb-2">
          <span className="text-xs font-medium text-muted-foreground">Progression</span>
          <span className="text-sm font-bold">{project.progress}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500" 
            style={{ width: `${project.progress}%` }} 
          />
        </div>
      </div>

      <div className="mt-6 pt-4 border-t flex justify-between items-center text-primary font-medium">
        <div className="flex gap-2">
          {project.status === 'COMPLETED' && onRate && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onRate(project);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-200 transition-all shadow-sm"
            >
              <Star className="w-3.5 h-3.5 fill-amber-700" />
              Évaluer
            </button>
          )}
          <span className="text-sm self-center">Voir les détails</span>
        </div>
        <ArrowRight className="w-4 h-4 translate-x-0 group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  );
}
