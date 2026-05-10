import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User as UserIcon, 
  MessageSquare, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  History,
  ShieldCheck,
  ChevronLeft,
  Star
} from 'lucide-react';
import { User } from '../types';
import { dbService } from '../services/db';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function PublicProfile() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<User | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (uid) {
      setLoading(true);
      dbService.getUser(uid).then(user => {
        setProfile(user);
        if (user?.role === 'TOPOGRAPHER') {
          dbService.getReviews(uid).then(revs => {
            setReviews(revs);
          });
        }
        setLoading(false);
      });
    }
  }, [uid]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center bg-card rounded-2xl border">
        <p className="text-muted-foreground">Utilisateur non trouvé.</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary font-bold">Retour</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-card rounded-xl transition-all group flex items-center gap-2"
        >
          <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center group-hover:bg-primary/10 transition-all">
            <ChevronLeft className="w-5 h-5 group-hover:text-primary transition-all" />
          </div>
          <span className="text-sm font-bold text-muted-foreground group-hover:text-foreground">Retour</span>
        </button>
        
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span className="text-xs font-black uppercase tracking-widest text-primary">Compte Professionnel</span>
        </div>
      </div>

      {/* Main Profile Card */}
      <div className="bg-card border rounded-3xl overflow-hidden shadow-sm">
        {/* Banner Placeholder */}
        <div className="h-32 bg-gradient-to-r from-primary/20 via-blue-500/10 to-transparent" />
        
        <div className="px-8 pb-8">
          <div className="relative -mt-16 flex flex-col items-center sm:items-start sm:flex-row gap-6">
            <div className="w-32 h-32 rounded-3xl overflow-hidden bg-background border-4 border-card shadow-2xl shrink-0">
              {profile.avatar ? (
                <img src={profile.avatar} className="w-full h-full object-cover" alt={profile.name} referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-primary bg-primary/5">
                  <UserIcon className="w-12 h-12" />
                </div>
              )}
            </div>
            
            <div className="flex-1 text-center sm:text-left pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-black tracking-tight">{profile.name}</h1>
                  <p className="text-muted-foreground font-medium flex items-center justify-center sm:justify-start gap-2 mt-1">
                    <Building2 className="w-4 h-4" />
                    {profile.company || 'Cabinet Indépendant'}
                  </p>
                </div>
                
                <button 
                  onClick={() => navigate('/messages', { state: { selectedRecipientId: profile.id } })}
                  className="bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                >
                  <MessageSquare className="w-5 h-5" />
                  Envoyer un message
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 pt-8 border-t">
            {/* Info Cards */}
            <div className="space-y-6 md:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-muted/50 rounded-2xl border border-border/50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Email Professionnel</p>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold">{profile.email}</span>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-2xl border border-border/50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Téléphone</p>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold">{profile.phone || 'Non renseigné'}</span>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-2xl border border-border/50 sm:col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Localisation du Cabinet</p>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold">{profile.address || profile.city || 'Maroc'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Stats */}
            <div className="space-y-4">
              <div className="bg-muted/30 p-6 rounded-2xl border flex flex-col items-center text-center">
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded-lg uppercase mb-4 tracking-wider">
                  {profile.role}
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Topographe professionnel vérifié par DataTopoGuard. Accès direct aux dossiers partagés.
                </p>
              </div>

              <div className="flex items-center gap-2 p-4 text-muted-foreground">
                <History className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">Membre depuis 2024</span>
              </div>
            </div>
          </div>

          {/* Reviews Section */}
          {profile.role === 'TOPOGRAPHER' && (
            <div className="mt-12 pt-8 border-t space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                  Avis et Évaluations
                </h2>
                <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 px-3 py-1 rounded-full text-xs font-black">
                  {profile.rating?.toFixed(1) || '0.0'} / 5.0
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {reviews.length > 0 ? (
                  reviews.map((review, i) => (
                    <motion.div 
                      key={`review-${review.id}-${i}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 bg-muted/20 rounded-2xl border border-border/50 space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                            {review.clientName?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-bold">{review.clientName}</p>
                            <div className="flex items-center gap-0.5 mt-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star 
                                  key={`star-${s}`} 
                                  className={cn("w-3 h-3", s <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} 
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {review.createdAt ? new Date(review.createdAt?.seconds * 1000 || review.createdAt).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed italic">"{review.comment}"</p>
                    </motion.div>
                  ))
                ) : (
                  <div className="p-8 text-center bg-muted/10 rounded-2xl border border-dashed">
                    <p className="text-xs text-muted-foreground italic">Aucun avis pour le moment.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
