import React, { useState } from 'react';
import { 
  User as UserIcon, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  Camera, 
  Save, 
  ShieldCheck,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { User } from '../types';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';

interface ProfileProps {
  user: User;
  onUpdate: (user: User) => void;
}

export default function Profile({ user, onUpdate }: ProfileProps) {
  const [formData, setFormData] = useState<User>({ ...user });
  const [isSaved, setIsSaved] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(formData);
    localStorage.setItem('user', JSON.stringify(formData));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handlePhotoUpload = () => {
    // Simulating photo upload
    const mockAvatar = "https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=200";
    setFormData({ ...formData, avatar: mockAvatar });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('settings.menu.profile')}</h1>
          <p className="text-muted-foreground mt-1">{t('settings.subtitle')}</p>
        </div>
        {isSaved && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 bg-green-500/10 text-green-600 px-4 py-2 rounded-full text-sm font-bold border border-green-500/20"
          >
            <CheckCircle2 className="w-4 h-4" />
            {t('settings.profile.saved')}
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Photo & Role */}
        <div className="space-y-6">
          <div className="bg-card border rounded-2xl p-8 flex flex-col items-center text-center">
            <div className="relative group">
              <div className="w-32 h-32 rounded-3xl overflow-hidden bg-primary/10 flex items-center justify-center border-4 border-background shadow-xl">
                {formData.avatar ? (
                  <img src={formData.avatar} className="w-full h-full object-cover" alt={formData.name} referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon className="w-12 h-12 text-primary" />
                )}
              </div>
              <button 
                onClick={handlePhotoUpload}
                className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground p-3 rounded-2xl shadow-lg hover:scale-110 transition-all"
                title={t('common.updating')}
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mt-6">
              <h2 className="text-xl font-bold">{formData.name}</h2>
              <span className="inline-block mt-2 px-3 py-1 bg-muted rounded-full text-[10px] font-black uppercase tracking-widest text-muted-foreground border">
                {formData.role}
              </span>
            </div>

            <div className="w-full mt-8 pt-8 border-t space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">ID {t('common.client')}</span>
                <span className="font-mono text-xs font-bold">{formData.id.toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('common.signed')}</span>
                <ShieldCheck className="w-4 h-4 text-primary" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-card border rounded-2xl p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('settings.profile.full_name')}</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-muted/50 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('login.email')}</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input 
                      type="email" 
                      value={formData.email}
                      disabled
                      className="w-full bg-muted border-none rounded-xl py-2.5 pl-10 pr-4 text-sm opacity-60 cursor-not-allowed"
                    />
                  </div>
                </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('settings.profile.age')}</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="number" 
                    value={formData.age || ''}
                    onChange={(e) => setFormData({...formData, age: parseInt(e.target.value)})}
                    className="w-full bg-muted/50 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="25"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('settings.profile.phone')}</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="tel" 
                    placeholder="+212 600 000 000"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full bg-muted/50 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('settings.profile.company')}</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder={t('common.unknown_date')}
                    value={formData.company || ''}
                    onChange={(e) => setFormData({...formData, company: e.target.value})}
                    className="w-full bg-muted/50 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('common.location')}</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-4 w-4 h-4 text-muted-foreground" />
                <textarea 
                  value={formData.address || ''}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full bg-muted/50 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all h-20 resize-none"
                  placeholder="..."
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                type="submit"
                className="bg-primary text-primary-foreground font-bold px-8 py-3 rounded-xl hover:opacity-90 transition-all flex items-center gap-2 shadow-xl shadow-primary/20"
              >
                <Save className="w-5 h-5" />
                {t('common.save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
