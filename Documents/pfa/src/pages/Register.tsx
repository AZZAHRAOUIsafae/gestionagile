import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User as UserIcon, 
  Mail, 
  Lock, 
  Check, 
  X, 
  Map, 
  ArrowRight,
  Shield
} from 'lucide-react';
import { User, UserRole } from '../types';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Country, City } from 'country-state-city';
import { 
  Phone, 
  MapPin, 
  Globe,
  Calendar
} from 'lucide-react';

interface RegisterProps {
  onRegister: (user: User) => void;
}

import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { dbService } from '../services/db';
import { AlertTriangle } from 'lucide-react';

export default function Register({ onRegister }: RegisterProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'CLIENT' as UserRole,
    password: '',
    confirmPassword: '',
    phone: '',
    country: 'MA',
    city: '',
    age: '',
    adminId: '' as string | undefined,
    adminEmail: ''
  });
  const [strength, setStrength] = useState(0);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const [admins, setAdmins] = useState<User[]>([]);

  useEffect(() => {
    const fetchAdmins = async () => {
      const list = await dbService.getAdmins();
      setAdmins(list);
    };
    fetchAdmins();
  }, []);

  const handleGoogleRegister = async () => {
    setError('');
    setIsSubmitting(true);
    const provider = new GoogleAuthProvider();
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const profile = await dbService.getUser(userCredential.user.uid);
      
      const loginInfo = {
        location: 'Maroc',
        device: navigator.userAgent.split(') ')[1] || 'Web Browser'
      };

      if (profile) {
        await dbService.logLogin(profile.id, loginInfo);
        onRegister(profile);
        navigate('/');
      } else {
        const newUser: User = {
          id: userCredential.user.uid,
          email: userCredential.user.email || '',
          name: userCredential.user.displayName || 'User',
          role: formData.role, // Use the selected role
          blockedUids: [],
          loginHistory: []
        };
        await dbService.createUser(newUser);
        await dbService.logLogin(newUser.id, loginInfo);
        onRegister(newUser);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to register with Google.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    let score = 0;
    if (formData.password.length >= 8) score++;
    if (/[A-Z]/.test(formData.password)) score++;
    if (/[0-9]/.test(formData.password)) score++;
    if (/[^A-Za-z0-9]/.test(formData.password)) score++;
    setStrength(score);
  }, [formData.password]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword || !formData.phone || !formData.city || !formData.age) {
      setError('Une case est manquante. Veuillez remplir tous les champs obligatoires.');
      return;
    }

    const nameRegex = /^[A-Z][a-z]+(\s[A-Z][a-z]+)+$/;
    if (!nameRegex.test(formData.name)) {
      setError('Veuillez entrer un nom réel (Ex: Ahmed Mansouri). Chaque mot doit commencer par une majuscule.');
      return;
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(formData.phone)) {
      setError('Le numéro de téléphone doit comporter exactement 10 chiffres.');
      return;
    }

    const ageNum = parseInt(formData.age);
    if (isNaN(ageNum) || ageNum < 18) {
      setError('Désolé, vous devez avoir au moins 18 ans pour vous inscrire.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    
    if (formData.role === 'TOPOGRAPHER' && !formData.adminEmail) {
      setError("Veuillez saisir l'email de votre cabinet ou administrateur référent.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      
      const newUser: User = {
        id: userCredential.user.uid,
        email: formData.email,
        name: formData.name,
        role: formData.role,
        phone: formData.phone,
        age: ageNum,
        country: Country.getCountryByCode(formData.country)?.name || formData.country,
        city: formData.city,
        adminEmail: formData.adminEmail, // Link by admin email
        blockedUids: [],
        loginHistory: []
      };

      const loginInfo = {
        location: 'Maroc',
        device: navigator.userAgent.split(') ')[1] || 'Web Browser'
      };

      await dbService.createUser(newUser);
      await dbService.logLogin(newUser.id, loginInfo);
      onRegister(newUser);
      navigate('/');
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('L\'authentification par e-mail/mot de passe n\'est pas activée dans votre projet Firebase.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Cet e-mail est déjà utilisé. Vous avez probablement déjà un compte. Essayez de vous connecter.');
      } else if (err.code === 'auth/weak-password') {
        setError('Le mot de passe est trop faible. Veuillez utiliser au moins 6 caractères.');
      } else {
        setError(err.message || 'Échec de la création du compte.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const strengthColor = strength === 0 ? 'bg-muted' : strength === 1 ? 'bg-red-500' : strength === 2 ? 'bg-amber-500' : strength === 3 ? 'bg-blue-500' : 'bg-green-500';
  const strengthText = strength === 0 ? 'None' : strength === 1 ? 'Weak' : strength === 2 ? 'Fair' : strength === 3 ? 'Good' : 'Strong';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 py-12">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-card border rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="p-8">
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
              <Shield className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold">Join DataTopoGuard</h1>
            <p className="text-sm text-muted-foreground mt-1">Start managing your topographic projects with precision</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive text-[11px] rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nom Complet</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-muted border-none rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="Ahmed Mansouri"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="email" 
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-muted border-none rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="ahmed@example.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Téléphone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="tel" 
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                    className="w-full bg-muted border-none rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="0612345678"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pays</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <select
                    required
                    value={formData.country}
                    onChange={(e) => setFormData({...formData, country: e.target.value, city: ''})}
                    className="w-full bg-muted border-none rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none appearance-none"
                  >
                    {Country.getAllCountries().map((c, i) => (
                      <option key={`reg-country-${c.isoCode}-${i}`} value={c.isoCode}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ville</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <select
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    className="w-full bg-muted border-none rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none appearance-none disabled:opacity-50"
                  >
                    <option value="">Sélectionner une ville</option>
                    {City.getCitiesOfCountry(formData.country)?.map((c, idx) => (
                      <option key={`reg-city-${c.name}-${idx}`} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Âge (Min. 18)</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="number" 
                    required
                    min="18"
                    value={formData.age}
                    onChange={(e) => setFormData({...formData, age: e.target.value})}
                    className="w-full bg-muted border-none rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="25"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Account Type</label>
              <div className="grid grid-cols-3 gap-3">
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, role: 'CLIENT'})}
                  className={cn(
                    "p-3 border rounded-xl flex flex-col items-center gap-1 transition-all",
                    formData.role === 'CLIENT' ? "bg-primary border-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <UserIcon className="w-5 h-5" />
                  <span className="text-[10px] font-semibold">Client</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, role: 'TOPOGRAPHER'})}
                  className={cn(
                    "p-3 border rounded-xl flex flex-col items-center gap-1 transition-all",
                    formData.role === 'TOPOGRAPHER' ? "bg-primary border-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Map className="w-5 h-5" />
                  <span className="text-[10px] font-semibold">Topo</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, role: 'ADMIN'})}
                  className={cn(
                    "p-3 border rounded-xl flex flex-col items-center gap-1 transition-all",
                    formData.role === 'ADMIN' ? "bg-primary border-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Shield className="w-5 h-5" />
                  <span className="text-[10px] font-semibold">Admin</span>
                </button>
              </div>
            </div>

            {formData.role === 'TOPOGRAPHER' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email de votre Cabinet / Admin</label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    placeholder="cabinet@exemple.com"
                    value={formData.adminEmail}
                    onChange={(e) => setFormData({...formData, adminEmail: e.target.value})}
                    className="w-full bg-muted border-none rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Saisissez l'email de l'administrateur qui gérera votre compte.</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="password" 
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full bg-muted border-none rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
                {/* Strength Meter */}
                <div className="space-y-1.5">
                  <div className="flex gap-1.5 h-1.5">
                    {[1, 2, 3, 4].map((step, i) => (
                      <div 
                        key={`password-step-${i}`} 
                        className={cn(
                          "flex-1 rounded-full transition-colors",
                          strength >= step ? strengthColor : "bg-muted"
                        )} 
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground flex justify-between">
                    <span>Password strength: <span className="font-semibold">{strengthText}</span></span>
                    <span>Min. 8 characters</span>
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="password" 
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    className="w-full bg-muted border-none rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="••••••••"
                  />
                  {formData.confirmPassword && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {formData.password === formData.confirmPassword ? 
                        <Check className="w-4 h-4 text-green-500" /> : 
                        <X className="w-4 h-4 text-red-500" />
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className={cn(
                "w-full bg-primary text-primary-foreground font-medium py-3 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 mt-4",
                isSubmitting && "opacity-50 cursor-not-allowed"
              )}
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
              {!isSubmitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleRegister}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 border rounded-xl hover:bg-muted/50 transition-all font-medium"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google
            </button>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Already have an account? <Link to="/login" className="text-primary font-medium hover:underline">Sign In</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
