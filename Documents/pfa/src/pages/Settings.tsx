import React, { useState, useEffect } from 'react';
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
  Calendar,
  Lock,
  LogOut,
  Globe,
  Ban,
  Users,
  ChevronRight,
  Shield,
  Smartphone,
  Eye,
  EyeOff,
  AlertCircle,
  Search,
  MessageSquare
} from 'lucide-react';
import { User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { dbService } from '../services/db';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { Country, City } from 'country-state-city';

import { useTranslation } from 'react-i18next';

interface SettingsProps {
  user: User;
  onUpdate: (user: User) => void;
  onLogout: () => void;
}

type TabType = 'profile' | 'security' | 'privacy' | 'network' | 'history' | 'blacklist';

export default function Settings({ user, onUpdate, onLogout }: SettingsProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  // ... rest of state
  const [bannedUsers, setBannedUsers] = useState<User[]>([]);

  useEffect(() => {
    if (user.role === 'ADMIN' && activeTab === 'blacklist') {
      const fetchBanned = async () => {
        const allUsers = await dbService.getAllUsers();
        setBannedUsers(allUsers.filter(u => u.isBanned));
      };
      fetchBanned();
    }
  }, [user.role, activeTab]);

  const handleUnban = async (uid: string) => {
    await dbService.banUser(uid, false);
    setBannedUsers(prev => prev.filter(u => u.id !== uid));
  };
  // Use explicit dependencies to avoid stale closures
  const [formData, setFormData] = useState<User>(() => ({
    ...user,
    country: user.country || 'Morocco',
    city: user.city || '',
    age: user.age || 18,
    phone: user.phone || '',
    address: user.address || '',
    company: user.company || '',
    bio: user.bio || ''
  }));

  // Sync formData with user prop if it changes from outside
  useEffect(() => {
    if (user) {
      setFormData(prev => {
        // Only update fields that are actually different to prevent unnecessary re-renders or losing focus
        const updated = { ...prev };
        let hasChanges = false;

        const fieldsToSync: (keyof User)[] = ['name', 'avatar', 'phone', 'age', 'country', 'city', 'address', 'company', 'bio', 'isTwoFactorEnabled', 'blockedUids', 'loginHistory'];
        
        fieldsToSync.forEach(field => {
          if (user[field] !== undefined && user[field] !== prev[field]) {
            (updated as any)[field] = user[field];
            hasChanges = true;
          }
        });

        return hasChanges ? updated : prev;
      });
    }
  }, [user]);

  const [isSaved, setIsSaved] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', new: '' });
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [isPwdChanging, setIsPwdChanging] = useState(false);
  const [showTfaSetup, setShowTfaSetup] = useState(false);
  const [tfaStep, setTfaStep] = useState(1);
  const [setupCode, setSetupCode] = useState('');

  const finishTfaSetup = async () => {
    if (setupCode === '123456') {
      const newState = true;
      setFormData({ ...formData, isTwoFactorEnabled: newState });
      await dbService.updateUser(user.id, { isTwoFactorEnabled: newState });
      onUpdate({ ...user, isTwoFactorEnabled: newState });
      setShowTfaSetup(false);
      setTfaStep(1);
      setSetupCode('');
    } else {
      alert('Code invalide. Utilisez 123456 pour cette démo.');
    }
  };

  // Real data state
  const [topographers, setTopographers] = useState<User[]>([]);
  const [blockedProfiles, setBlockedProfiles] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtering
  const filteredTopographers = topographers.filter(topo => 
    topo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (topo.company && topo.company.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  useEffect(() => {
    const fetchData = async () => {
      // Fetch all topographers
      const topos = await dbService.getTopographers();
      setTopographers(topos);

      // Fetch blocked profiles individually
      if (user.blockedUids && user.blockedUids.length > 0) {
        const profiles = await Promise.all(
          user.blockedUids.map(uid => dbService.getUser(uid))
        );
        setBlockedProfiles(profiles.filter((u): u is User => u !== null));
      }
    };
    fetchData();
  }, [user.blockedUids]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name?.trim()) {
      alert('Le nom est obligatoire.');
      return;
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (formData.phone && !phoneRegex.test(formData.phone)) {
      alert('Le numéro de téléphone doit comporter exactement 10 chiffres.');
      return;
    }

    const nameRegex = /^[A-Z][a-z]+(\s[A-Z][a-z]+)+$/;
    if (formData.name && !nameRegex.test(formData.name)) {
      alert('Veuillez entrer un nom réel (Ex: Ahmed Mansouri). Chaque mot doit commencer par une majuscule.');
      return;
    }

    const ageNum = parseInt(String(formData.age)) || 0;
    if (ageNum < 18) {
      alert('Désolé, vous devez avoir au moins 18 ans.');
      return;
    }

    if (!formData.country || !formData.city) {
      alert('Le pays et la ville sont obligatoires.');
      return;
    }

    // Filter out immutable or internal fields to avoid security rule rejection
    const { id, email, role, createdAt, uid, loginHistory, blockedUids, ...updateData } = formData;
    
    // Ensure numeric types and clean data
    const ageValue = parseInt(String(formData.age));
    const finalUpdateData = {
      ...updateData,
      age: isNaN(ageValue) ? 18 : ageValue,
      phone: formData.phone || '',
      country: formData.country || 'Morocco',
      city: formData.city || '',
      address: formData.address || '',
      company: formData.company || '',
    };
    
    try {
      await dbService.updateUser(user.id, finalUpdateData);
      
      // Update parent state with merged data
      const updatedUser = { 
        ...user, 
        ...formData, 
        age: isNaN(ageValue) ? 18 : ageValue 
      };
      
      onUpdate(updatedUser);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      console.error('Update failed:', error);
      alert('Erreur lors de la mise à jour du profil.');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.current || !passwords.new) return;
    setPwdError('');
    setPwdSuccess(false);
    setIsPwdChanging(true);

    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) return;

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, passwords.current);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, passwords.new);
      setPwdSuccess(true);
      setPasswords({ current: '', new: '' });
    } catch (err: any) {
      setPwdError(err.message || 'Erreur lors du changement de mot de passe. Vérifiez votre mot de passe actuel.');
    } finally {
      setIsPwdChanging(false);
    }
  };

  const handleUnblock = async (uid: string) => {
    const newBlocked = user.blockedUids?.filter(id => id !== uid) || [];
    const updatedUser = { ...user, blockedUids: newBlocked };
    await dbService.updateUser(user.id, { blockedUids: newBlocked });
    onUpdate(updatedUser);
  };

  const handleBlock = async (uid: string) => {
    const newBlocked = [...(user.blockedUids || []), uid];
    const updatedUser = { ...user, blockedUids: newBlocked };
    await dbService.updateUser(user.id, { blockedUids: newBlocked });
    onUpdate(updatedUser);
  };

  const { t } = useTranslation();

  const menuItems = [
    { id: 'profile', label: t('settings.menu.profile'), icon: UserIcon },
    { id: 'security', label: t('settings.menu.security'), icon: Shield },
    { id: 'history', label: t('settings.menu.history'), icon: Globe },
    { id: 'privacy', label: t('settings.menu.privacy'), icon: Ban },
    ...(user.role === 'ADMIN' ? [{ id: 'blacklist', label: t('settings.menu.blacklist'), icon: Shield }] : []),
    { id: 'network', label: t('settings.menu.network'), icon: Users },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('settings.subtitle')}</p>
        </div>
        <button 
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 text-destructive border border-destructive/20 bg-destructive/5 rounded-xl hover:bg-destructive hover:text-destructive-foreground transition-all font-bold"
        >
          <LogOut className="w-4 h-4" />
          {t('common.logout')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Menu */}
        <div className="space-y-2">
          {menuItems.map((item, i) => (
            <button
              key={`menu-${item.id}-${i}`}
              onClick={() => setActiveTab(item.id as TabType)}
              className={cn(
                "w-full flex items-center justify-between p-3 rounded-xl transition-all group",
                activeTab === item.id 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                  : "hover:bg-muted"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-white" : "text-muted-foreground group-hover:text-primary")} />
                <span className="font-medium">{item.label}</span>
              </div>
              <ChevronRight className={cn("w-4 h-4 opacity-0 transition-all", activeTab === item.id ? "opacity-100 translate-x-1" : "")} />
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="bg-card border rounded-2xl p-6 md:p-8"
            >
              {activeTab === 'profile' && (
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="flex items-center gap-6">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-2xl overflow-hidden bg-muted border-2 border-background shadow-lg">
                        {formData.avatar ? (
                          <img src={formData.avatar} className="w-full h-full object-cover" alt="Avatar" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <UserIcon className="w-10 h-10 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <input 
                        type="file"
                        id="avatar-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              const base64 = reader.result as string;
                              const updatedUser = { ...formData, avatar: base64 };
                              setFormData(updatedUser);
                              // Immediate save for avatar
                              await dbService.updateUser(user.id, { avatar: base64 });
                              onUpdate(updatedUser);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <button 
                        type="button" 
                        onClick={() => document.getElementById('avatar-upload')?.click()}
                        className="absolute -bottom-2 -right-2 p-2 bg-primary text-white rounded-lg shadow-lg hover:scale-110 transition-all"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{formData.name}</h3>
                      <p className="text-sm text-muted-foreground">{formData.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('settings.profile.full_name')}</label>
                      <input 
                        type="text" 
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-muted/50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('settings.profile.phone')}</label>
                      <input 
                        type="tel" 
                        value={formData.phone || ''}
                        onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        placeholder="0612345678"
                        className="w-full bg-muted/50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('settings.profile.country')}</label>
                      <select
                        value={Country.getAllCountries().find(c => c.name === formData.country || c.isoCode === formData.country)?.isoCode || 'MA'}
                        onChange={e => {
                          const c = Country.getCountryByCode(e.target.value);
                          setFormData({ ...formData, country: c?.name || '', city: '' });
                        }}
                        className="w-full bg-muted/50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary outline-none appearance-none"
                      >
                        {Country.getAllCountries().map((c, i) => (
                          <option key={`set-country-${c.isoCode}-${i}`} value={c.isoCode}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('settings.profile.city')}</label>
                      <select
                        value={formData.city}
                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                        className="w-full bg-muted/50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary outline-none appearance-none"
                      >
                        <option value="">{t('common.select_city')}</option>
                        {City.getCitiesOfCountry(Country.getAllCountries().find(c => c.name === formData.country || c.isoCode === formData.country)?.isoCode || 'MA')?.map((c, idx) => (
                          <option key={`set-city-${c.name}-${idx}`} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    {user.role !== 'CLIENT' && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('settings.profile.company')}</label>
                        <input 
                          type="text" 
                          value={formData.company || ''}
                          onChange={e => setFormData({ ...formData, company: e.target.value })}
                          className="w-full bg-muted/50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('settings.profile.age')}</label>
                      <input 
                        type="number" 
                        value={formData.age || ''}
                        onChange={e => setFormData({ ...formData, age: parseInt(e.target.value) })}
                        className="w-full bg-muted/50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {user.role === 'CLIENT' ? t('settings.profile.address_personal') : t('settings.profile.address_professional')}
                    </label>
                    <textarea 
                      value={formData.address || ''}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      className="w-full bg-muted/50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary outline-none h-24 resize-none"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-6 border-t">
                    <div className="flex items-center gap-2 text-green-500 text-sm font-medium">
                      {isSaved && (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          {t('settings.profile.saved')}
                        </>
                      )}
                    </div>
                    <button type="submit" className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:opacity-90 transition-all">
                      <Save className="w-4 h-4" /> {t('common.save')}
                    </button>
                  </div>
                </form>
              )}

              {activeTab === 'security' && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-bold mb-4">{t('settings.security.change_password')}</h3>
                    <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                      {pwdError && (
                        <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-xl flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          {pwdError}
                        </div>
                      )}
                      {pwdSuccess && (
                        <div className="p-3 bg-green-500/10 text-green-600 text-xs rounded-xl flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          {t('settings.security.password_success')}
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className="text-xs font-bold tracking-widest uppercase text-muted-foreground">{t('settings.security.current_password')}</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input 
                            required
                            type="password" 
                            value={passwords.current}
                            onChange={e => setPasswords({ ...passwords, current: e.target.value })}
                            className="w-full bg-muted/50 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none" 
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold tracking-widest uppercase text-muted-foreground">{t('settings.security.new_password')}</label>
                          {passwords.new && (
                            <span className={cn(
                              "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                              passwords.new.length < 6 ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"
                            )}>
                              {passwords.new.length < 6 ? t('settings.security.strength_weak') : t('settings.security.strength_strong')}
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input 
                            required
                            type={showPassword ? "text" : "password"} 
                            value={passwords.new}
                            onChange={e => setPasswords({ ...passwords, new: e.target.value })}
                            className="w-full bg-muted/50 border-none rounded-xl py-2.5 pl-10 pr-12 text-sm focus:ring-2 focus:ring-primary outline-none" 
                          />
                          <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-primary"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <button 
                        disabled={isPwdChanging}
                        className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-bold text-sm w-full mt-4 disabled:opacity-50 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                      >
                        {isPwdChanging ? t('common.updating') : t('settings.security.update_password_button')}
                      </button>
                    </form>
                  </div>

                  <div className="pt-8 border-t relative">
                    <h3 className="text-lg font-bold mb-4">{t('settings.security.2fa.title')}</h3>
                    <div className="flex items-center justify-between p-6 bg-muted/30 rounded-2xl border">
                      <div className="flex items-center gap-4">
                        <div className={cn("p-3 rounded-xl", formData.isTwoFactorEnabled ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground")}>
                          <Smartphone className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold">{t('settings.security.2fa.method')}</p>
                          <p className="text-xs text-muted-foreground">{t('settings.security.2fa.description')}</p>
                        </div>
                      </div>
                      <button 
                        onClick={async () => {
                          if (formData.isTwoFactorEnabled) {
                            const newState = false;
                            setFormData({ ...formData, isTwoFactorEnabled: newState });
                            await dbService.updateUser(user.id, { isTwoFactorEnabled: newState });
                            onUpdate({ ...user, isTwoFactorEnabled: newState });
                          } else {
                            setShowTfaSetup(true);
                          }
                        }}
                        className={cn(
                          "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                          formData.isTwoFactorEnabled 
                            ? "bg-primary text-white" 
                            : "bg-muted hover:bg-muted/80 text-foreground"
                        )}
                      >
                        {formData.isTwoFactorEnabled ? t('common.deactivate') : t('common.activate')}
                      </button>
                    </div>

                    <AnimatePresence>
                      {showTfaSetup && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="w-full max-w-md bg-card border rounded-3xl shadow-2xl overflow-hidden"
                          >
                            <div className="p-6 border-b flex items-center justify-between">
                              <h3 className="font-black text-lg">{t('settings.security.2fa.setup_title')}</h3>
                              <button onClick={() => setShowTfaSetup(false)} className="p-2 hover:bg-muted rounded-xl transition-all">
                                <Search className="w-5 h-5 rotate-45" />
                              </button>
                            </div>
                            <div className="p-8">
                              {tfaStep === 1 ? (
                                <div className="space-y-6 text-center">
                                  <div className="w-48 h-48 bg-white mx-auto p-4 rounded-2xl border-4 border-primary/10 shadow-inner flex items-center justify-center">
                                    {/* Simulated QR Code */}
                                    <div className="grid grid-cols-4 gap-1 w-full h-full opacity-80">
                                      {Array.from({ length: 16 }).map((_, i) => (
                                        <div key={`qr-bit-${i}`} className={cn("rounded-sm", (i + (i % 3)) % 2 === 0 ? "bg-black" : "bg-white")} />
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="font-bold text-sm">{t('settings.security.2fa.step_1')}</p>
                                    <p className="text-xs text-muted-foreground mt-2">{t('settings.security.2fa.step_1_desc')}</p>
                                    <code className="block mt-4 p-2 bg-muted rounded-lg text-primary font-mono text-sm tracking-widest">DTG-SECURE-KEY-2026</code>
                                  </div>
                                  <button 
                                    onClick={() => setTfaStep(2)}
                                    className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20"
                                  >
                                    {t('settings.security.2fa.scanned')}
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-6 text-center">
                                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto">
                                    <ShieldCheck className="w-10 h-10" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-sm">{t('settings.security.2fa.step_2')}</p>
                                    <p className="text-xs text-muted-foreground mt-2">{t('settings.security.2fa.step_2_desc')}</p>
                                  </div>
                                  <input 
                                    type="text" 
                                    maxLength={6}
                                    value={setupCode}
                                    onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ''))}
                                    placeholder="000000"
                                    className="w-full bg-muted border-none rounded-xl py-4 text-center text-2xl font-black tracking-widest focus:ring-2 focus:ring-primary outline-none"
                                  />
                                  <div className="flex gap-3">
                                    <button 
                                      onClick={() => setTfaStep(1)}
                                      className="flex-1 px-4 py-3 border rounded-xl text-sm font-bold hover:bg-muted"
                                    >
                                      {t('common.cancel')}
                                    </button>
                                    <button 
                                      onClick={finishTfaSetup}
                                      className="flex-[2] bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20"
                                    >
                                      {t('settings.security.2fa.verify_btn')}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="p-6 bg-muted/30 border-t">
                              <p className="text-[10px] text-muted-foreground leading-relaxed text-center italic">
                                {t('settings.security.2fa.demo_note')}
                              </p>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold">{t('settings.history.title')}</h3>
                  <div className="space-y-3">
                    {user.loginHistory && user.loginHistory.length > 0 ? user.loginHistory.map((item, idx) => (
                      <div key={`login-${item.id}-${idx}`} className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border">
                        <div className="flex items-center gap-4">
                          <div className={cn("p-3 rounded-xl", idx === 0 ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground")}>
                            {item.device.toLowerCase().includes('phone') || item.device.toLowerCase().includes('mobile') || item.device.toLowerCase().includes('iphone') || item.device.toLowerCase().includes('android') ? (
                              <Smartphone className="w-6 h-6" />
                            ) : item.device.toLowerCase().includes('windows') || item.device.toLowerCase().includes('mac') || item.device.toLowerCase().includes('desktop') ? (
                              <Globe className="w-6 h-6" />
                            ) : (
                              <Shield className="w-6 h-6" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold">{item.location}</p>
                              {idx === 0 && <span className="bg-green-500/20 text-green-600 text-[10px] px-2 py-0.5 rounded-full font-black uppercase">{t('settings.history.current')}</span>}
                            </div>
                            <p className="text-xs text-muted-foreground">{item.device} • {new Date(item.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                        {idx !== 0 && (
                          <button className="text-destructive text-sm font-bold hover:underline">{t('settings.history.disconnect')}</button>
                        )}
                      </div>
                    )) : (
                      <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-2xl border-2 border-dashed">
                        <Globe className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>{t('settings.history.no_history')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'privacy' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="text-lg font-bold">{t('settings.privacy.title')}</h3>
                      <p className="text-sm text-muted-foreground">{t('settings.privacy.desc')}</p>
                    </div>
                    <div className="relative w-full md:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input 
                        type="text" 
                        placeholder={t('settings.privacy.block_placeholder')}
                        className="w-full bg-muted/50 border-none rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none"
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value;
                            const found = topographers.find(t => t.name.toLowerCase() === val.toLowerCase());
                            if (found && !user.blockedUids?.includes(found.id)) {
                              await handleBlock(found.id);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {blockedProfiles.length > 0 ? blockedProfiles.map((item, i) => (
                      <div key={`blocked-${item.id}-${i}`} className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border">
                        <div className="flex items-center gap-4">
                          {item.avatar ? (
                            <img src={item.avatar} className="w-10 h-10 rounded-full object-cover" alt={item.name} referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                              <UserIcon className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.role}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleUnblock(item.id)}
                          className="px-4 py-2 text-xs font-bold border border-destructive/20 text-destructive rounded-lg hover:bg-destructive hover:text-white transition-all"
                        >
                          {t('settings.privacy.unblock')}
                        </button>
                      </div>
                    )) : (
                      <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-2xl border-2 border-dashed">
                        <Ban className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>{t('settings.privacy.no_blocked')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'blacklist' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="text-lg font-bold">{t('settings.blacklist.title')}</h3>
                      <p className="text-sm text-muted-foreground">{t('settings.blacklist.desc')}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {bannedUsers.length > 0 ? bannedUsers.map((item, i) => (
                      <div key={`banned-global-${item.id}-${i}`} className="flex items-center justify-between p-4 bg-red-500/5 rounded-2xl border border-red-500/10">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center font-black">
                            {item.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold flex items-center gap-2">
                              {item.name} 
                              <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full uppercase">{t('settings.blacklist.banned')}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">{item.email} • {item.role}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleUnban(item.id)}
                          className="px-4 py-2 text-xs font-bold bg-white border border-red-500/20 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"
                        >
                          {t('settings.blacklist.reactivate')}
                        </button>
                      </div>
                    )) : (
                      <div className="text-center py-20 text-muted-foreground bg-muted/5 rounded-3xl border-2 border-dashed">
                        <ShieldCheck className="w-16 h-16 mx-auto mb-4 opacity-10" />
                        <p className="text-lg font-bold">{t('settings.blacklist.no_banned')}</p>
                        <p className="text-sm opacity-60">{t('settings.blacklist.healthy')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'network' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="text-lg font-bold">{t('settings.network.title')}</h3>
                      <p className="text-sm text-muted-foreground">{t('settings.network.desc')}</p>
                    </div>
                    <div className="relative w-full md:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Rechercher un expert..." 
                        className="w-full bg-muted/50 border-none rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredTopographers.length > 0 ? filteredTopographers.map((topo, i) => (
                      <div key={`topo-card-${topo.id}-${i}`} className="p-4 bg-card border rounded-2xl flex items-center justify-between hover:shadow-md transition-all group">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-inner bg-muted">
                            {topo.avatar ? (
                              <img src={topo.avatar} className="w-full h-full object-cover" alt={topo.name} referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <UserIcon className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-bold group-hover:text-primary transition-colors">{topo.name}</p>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{topo.company || 'Indépendant'}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {user.role === 'CLIENT' && (
                            <button 
                              onClick={() => navigate('/messages', { state: { selectedRecipientId: topo.id } })}
                              className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition-all shadow-sm"
                              title="Envoyer un message"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          )}
                          {user.blockedUids?.includes(topo.id) ? (
                            <button 
                              onClick={() => handleUnblock(topo.id)}
                              className="p-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive hover:text-white transition-all shadow-sm"
                              title="Débloquer"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleBlock(topo.id)}
                              className="p-2 bg-muted hover:bg-destructive/10 hover:text-destructive rounded-lg transition-all"
                              title="Bloquer"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )) : (
                      <div className="col-span-full text-center py-12 text-muted-foreground italic">
                        Aucun expert trouvé pour "{searchQuery}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
