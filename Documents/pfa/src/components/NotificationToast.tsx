import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Info, AlertTriangle, CheckCircle, MessageSquare } from 'lucide-react';
import { Notification } from '../types';
import { cn } from '../lib/utils';

interface NotificationToastProps {
  notifications: Notification[];
}

export default function NotificationToast({ notifications }: NotificationToastProps) {
  const [currentNotif, setCurrentNotif] = useState<Notification | null>(null);
  const [queue, setQueue] = useState<Notification[]>([]);

  useEffect(() => {
    // Only show unread notifications that arrived in the last 10 seconds
    const now = Date.now();
    const newNotifs = notifications.filter(n => {
      const time = n.timestamp?.seconds ? n.timestamp.seconds * 1000 : new Date(n.timestamp).getTime();
      return !n.read && (now - time) < 10000;
    });

    if (newNotifs.length > 0) {
      setQueue(prev => {
        const unique = newNotifs.filter(n => !prev.find(p => p.id === n.id) && currentNotif?.id !== n.id);
        return [...prev, ...unique];
      });
    }
  }, [notifications]);

  useEffect(() => {
    if (!currentNotif && queue.length > 0) {
      const next = queue[0];
      setCurrentNotif(next);
      setQueue(prev => prev.slice(1));

      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setCurrentNotif(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [currentNotif, queue]);

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'MESSAGE': return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case 'PROJECT': return <Info className="w-5 h-5 text-purple-500" />;
      case 'DOCUMENT': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'ALERT': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      default: return <Bell className="w-5 h-5 text-primary" />;
    }
  };

  return (
    <AnimatePresence>
      {currentNotif && (
        <motion.div
          initial={{ opacity: 0, x: 100, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 100, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-[200] w-full max-w-sm bg-card border-2 border-primary/20 rounded-2xl shadow-2xl p-4 flex items-start gap-4 overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
            {getIcon(currentNotif.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                {currentNotif.type}
              </p>
              <button 
                onClick={() => setCurrentNotif(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="font-bold text-sm truncate">{currentNotif.senderName}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {currentNotif.content}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
