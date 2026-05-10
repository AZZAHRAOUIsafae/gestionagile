import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronRight, 
  ChevronLeft, 
  Globe, 
  ShieldCheck, 
  Zap, 
  Users, 
  Map as MapIcon,
  Check
} from 'lucide-react';
import { cn } from '../lib/utils';

const slides = [
  {
    id: 1,
    icon: Globe,
    titleKey: 'onboarding.slide1_title',
    descKey: 'onboarding.slide1_desc',
    color: 'bg-blue-500/10 text-blue-500',
    image: 'https://images.unsplash.com/photo-1541462608141-adbc0360ec3a?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 2,
    icon: Users,
    titleKey: 'onboarding.slide2_title',
    descKey: 'onboarding.slide2_desc',
    color: 'bg-green-500/10 text-green-500',
    image: 'https://images.unsplash.com/photo-1541888946425-d81bb19480c5?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 3,
    icon: Zap,
    titleKey: 'onboarding.slide3_title',
    descKey: 'onboarding.slide3_desc',
    color: 'bg-amber-500/10 text-amber-500',
    image: 'https://images.unsplash.com/photo-1503387762-592dea58ef23?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 4,
    icon: ShieldCheck,
    titleKey: 'onboarding.slide4_title',
    descKey: 'onboarding.slide4_desc',
    color: 'bg-primary/10 text-primary',
    image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800'
  }
];

export default function Onboarding() {
  const { t, i18n } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const navigate = useNavigate();

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    navigate('/login');
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setShowLangMenu(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Topographic Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none select-none overflow-hidden">
        <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5">
          <path d="M0 10 Q 25 5 50 10 T 100 10 M 0 20 Q 25 15 50 20 T 100 20 M 0 30 Q 25 25 50 30 T 100 30 M 0 40 Q 25 35 50 40 T 100 40 M 0 50 Q 25 45 50 50 T 100 50 M 0 60 Q 30 55 60 60 T 100 60 M 0 70 Q 30 65 60 70 T 100 70 M 0 80 Q 30 75 60 80 T 100 80 M 0 90 Q 30 85 60 90 T 100 90" />
        </svg>
      </div>

      {/* Header */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-50">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
            <MapIcon className="w-6 h-6" />
          </div>
          <span className="font-black tracking-tight text-xl hidden sm:inline-block">DataTopoGuard</span>
        </div>

        <div className="relative">
          <button 
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="flex items-center gap-2 px-4 py-2 bg-card border rounded-xl shadow-sm hover:bg-muted transition-all"
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

      {/* Main Content Area */}
      <main className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center z-10">
        {/* Visual Section */}
        <div className="hidden lg:block relative h-[500px] rounded-3xl overflow-hidden border shadow-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
            >
              <img 
                src={slides[currentSlide].image} 
                alt="Slide visual"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-8">
                <div className="text-white">
                  <h3 className="text-xl font-bold">{t(slides[currentSlide].titleKey)}</h3>
                  <p className="text-sm opacity-90 mt-2">{t(slides[currentSlide].descKey)}</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Info Section */}
        <div className="flex flex-col gap-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center", slides[currentSlide].color)}>
                {React.createElement(slides[currentSlide].icon, { className: "w-8 h-8" })}
              </div>
              
              <div className="space-y-4">
                <h2 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
                  {t(slides[currentSlide].titleKey)}
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {t(slides[currentSlide].descKey)}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Indicators & Actions */}
          <div className="space-y-8 pt-4">
            <div className="flex gap-2">
              {slides.map((_, index) => (
                <div 
                  key={index}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    currentSlide === index ? "w-8 bg-primary" : "w-1.5 bg-muted"
                  )}
                />
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePrev}
                  disabled={currentSlide === 0}
                  className="p-3 rounded-full border hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={handleNext}
                  className="px-8 py-3 bg-primary text-primary-foreground font-black rounded-2xl flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-primary/20"
                >
                  {currentSlide === slides.length - 1 ? t('onboarding.start') : t('onboarding.next')}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button 
                onClick={handleComplete}
                className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest"
              >
                {t('onboarding.skip')}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Branding */}
      <div className="absolute bottom-6 text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-medium opacity-50">
        DataTopoGuard Ecosystem • Smart Cabinet 2026
      </div>
    </div>
  );
}
