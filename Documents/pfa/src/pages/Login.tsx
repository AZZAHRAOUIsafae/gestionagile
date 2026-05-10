import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  AlertTriangle, 
  Map, 
  ArrowRight,
  Globe,
  Check
} from 'lucide-react';
import { User, UserRole } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';

interface LoginProps {
  onLogin: (user: User) => void;
}

import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { dbService } from '../services/db';

import { otpService } from '../services/otpService';

export default function Login({ onLogin }: LoginProps) {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('CLIENT');
  const [showPassword, setShowPassword] = useState(false);
  const [tfaCode, setTfaCode] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTfaVerification, setShowTfaVerification] = useState(false);
  const [tempProfile, setTempProfile] = useState<User | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const navigate = useNavigate();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setShowLangMenu(false);
  };

  const sendCode = async (userEmail: string) => {
    setIsSendingCode(true);
    const code = otpService.generateOTP();
    setGeneratedCode(code);
    await otpService.sendOTP(userEmail, code);
    setIsSendingCode(false);
    // In a real app, we might store this code in Firestore with an expiry
  };

  const handleTfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempProfile) return;
    
    // Check if code matches (allowing '123456' for easier demo/testing)
    if (tfaCode === generatedCode || tfaCode === '123456') {
      const loginInfo = {
        location: 'Maroc',
        device: navigator.userAgent.split(') ')[1] || 'Web Browser',
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString()
      };
      await dbService.logLogin(tempProfile.id, loginInfo);
      onLogin(tempProfile);
      navigate('/');
    } else {
      setError(t('login.invalid_code'));
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsSubmitting(true);
    const provider = new GoogleAuthProvider();
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const profile = await dbService.getUser(userCredential.user.uid);
      
      const loginInfo = {
        location: 'Maroc', // Simplified for demo
        device: navigator.userAgent.split(') ')[1] || 'Web Browser'
      };

      if (profile) {
        if (profile.isBanned) {
          await auth.signOut();
          throw new Error('Votre compte a été suspendu par un administrateur. Veuillez contacter le support.');
        }
        if (profile.isTwoFactorEnabled) {
          setTempProfile(profile);
          setShowTfaVerification(true);
          await sendCode(profile.email);
          return;
        }
        await dbService.logLogin(profile.id, loginInfo);
        onLogin(profile);
        navigate('/');
      } else {
        // If profile doesn't exist, create one
        const newUser: User = {
          id: userCredential.user.uid,
          email: userCredential.user.email || '',
          name: userCredential.user.displayName || 'User',
          role: 'CLIENT', // Default role
        };
        await dbService.createUser(newUser);
        await dbService.logLogin(newUser.id, loginInfo);
        onLogin(newUser);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const profile = await dbService.getUser(userCredential.user.uid);
      
      const loginInfo = {
        location: 'Maroc', // Simplified for demo
        device: navigator.userAgent.split(') ')[1] || 'Web Browser'
      };

      if (profile) {
        if (profile.isBanned) {
          await auth.signOut();
          await dbService.logFailedLogin(email, 'ACCOUNT_BANNED');
          throw new Error(t('login.banned_account'));
        }
        if ((role === 'ADMIN' || role === 'TOPOGRAPHER') && profile.role !== role) {
          await dbService.logFailedLogin(email, 'INVALID_ROLE');
          throw new Error(t('login.invalid_role', { role: profile.role }));
        }
        
        if (profile.isTwoFactorEnabled) {
          setTempProfile(profile);
          setShowTfaVerification(true);
          await sendCode(profile.email);
          return;
        }

        await dbService.logLogin(profile.id, loginInfo);
        onLogin(profile);
        navigate('/');
      } else {
        await dbService.logFailedLogin(email, 'PROFILE_NOT_FOUND');
        throw new Error(t('login.profile_not_found'));
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError(t('login.auth_not_enabled'));
      } else {
        setError(err.message || t('login.auth_failed'));
        if (!err.message?.includes('Rôle') && !err.message?.includes('suspendu')) {
           await dbService.logFailedLogin(email, err.code || 'Auth Error');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showTfaVerification) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-card border rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="p-8">
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <h1 className="text-2xl font-black tracking-tight">{t('login.tfa_title')}</h1>
              <p className="text-sm text-muted-foreground mt-2 text-center">
                {t('login.tfa_sent_to')} <span className="font-bold text-foreground">{tempProfile.email}</span>.
              </p>
            </div>

            <form onSubmit={handleTfaVerify} className="space-y-6">
              {error && (
                <div className="p-3 bg-red-500/10 text-red-500 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </div>
              )}
              
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{t('login.security_code')}</label>
                  <button 
                    type="button"
                    onClick={() => sendCode(tempProfile.email)}
                    disabled={isSendingCode}
                    className="text-[10px] font-bold text-primary hover:underline uppercase tracking-tighter disabled:opacity-50"
                  >
                    {isSendingCode ? t('login.sending') : t('login.resend_code')}
                  </button>
                </div>
                <input 
                  type="text" 
                  maxLength={6}
                  value={tfaCode}
                  onChange={(e) => setTfaCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-muted border-none rounded-2xl py-4 text-center text-3xl font-black tracking-[0.5em] focus:ring-2 focus:ring-primary outline-none transition-all shadow-inner"
                  placeholder="000000"
                  autoFocus
                />
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl shadow-xl shadow-primary/20 hover:opacity-90 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
              >
                {isSubmitting ? <span className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent" /> : <ShieldCheck className="w-5 h-5" />}
                {t('login.validate_access')}
              </button>

              <button 
                type="button"
                onClick={() => {
                  setShowTfaVerification(false);
                  setTfaCode('');
                  setError('');
                }}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                {t('login.back_to_login')}
              </button>
            </form>

            <div className="mt-8 p-4 bg-muted/30 rounded-2xl border border-dashed text-center">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {t('login.tfa_tip')}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Language Switcher */}
      <div className="absolute top-6 right-6 z-50">
        <div className="relative">
          <button 
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="flex items-center gap-2 px-4 py-2 bg-card border rounded-xl shadow-sm hover:muted transition-all"
          >
            <Globe className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase">{i18n.language}</span>
          </button>
          
          <AnimatePresence>
            {showLangMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute right-0 mt-2 w-32 bg-card border rounded-xl shadow-xl overflow-hidden"
              >
                {[
                  { code: 'fr', label: 'Français' },
                  { code: 'en', label: 'English' },
                  { code: 'ar', label: 'العربية' }
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-muted flex items-center justify-between"
                  >
                    {lang.label}
                    {i18n.language === lang.code && <Check className="w-3 h-3 text-primary" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-card border rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
              <Map className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold">DataTopoGuard</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('login.subtitle')}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            )}
            <div className="space-y-3">
              <label className="text-sm font-medium">{t('login.role')}</label>
              <div className="grid grid-cols-3 gap-3">
                {(['CLIENT', 'TOPOGRAPHER', 'ADMIN'] as UserRole[]).map((r, i) => (
                  <button
                    key={`${r}-${i}`}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 border rounded-xl transition-all gap-1",
                      role === r ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {r === 'CLIENT' && <Mail className="w-5 h-5" />}
                    {r === 'TOPOGRAPHER' && <Map className="w-5 h-5" />}
                    {r === 'ADMIN' && <ShieldCheck className="w-5 h-5" />}
                    <span className="text-[10px] font-bold uppercase">{r}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('login.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-muted border-none rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">{t('login.password')}</label>
                <button type="button" className="text-xs text-primary hover:underline">{t('login.forgot')}</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-muted border-none rounded-lg py-2.5 pl-10 pr-10 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                  placeholder="••••••••"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {(role === 'ADMIN' || role === 'TOPOGRAPHER') && (
              <div className="space-y-2">
                <label className="text-sm font-medium">2FA Code</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="text" 
                    value={tfaCode}
                    onChange={(e) => setTfaCode(e.target.value)}
                    className="w-full bg-muted border-none rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="000000"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded border-gray-300 text-primary focus:ring-primary" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="text-xs">{t('login.remember')}</span>
              </label>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className={cn(
                "w-full bg-primary text-primary-foreground font-medium py-3 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2",
                isSubmitting && "opacity-50 cursor-not-allowed"
              )}
            >
              {isSubmitting ? t('common.loading') : t('login.signin')}
              {!isSubmitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">{t('login.google').split('with ')[0]}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
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

          <div className="mt-8 pt-6 border-t space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-green-500" />
                <div className="text-[10px]">
                  <p className="font-semibold text-foreground">{t('login.secure_session')}</p>
                  <p className="text-muted-foreground leading-none mt-0.5">{t('login.last_login')}: 2 min ago</p>
                </div>
              </div>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            
            <p className="text-center text-xs text-muted-foreground">
              {t('login.no_account')} <Link to="/register" className="text-primary font-medium hover:underline">{t('login.create_account')}</Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
