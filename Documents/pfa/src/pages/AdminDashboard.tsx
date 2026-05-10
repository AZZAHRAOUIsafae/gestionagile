import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  FileText, 
  Shield,
  ShieldAlert, 
  History,
  Activity, 
  UserPlus, 
  Search, 
  MoreVertical, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  FileCheck,
  Ban,
  Clock,
  ArrowUpRight,
  Trash2,
  Phone,
  Mail,
  BarChart as BarChartIcon,
  Download,
  Send,
  MessageSquare as MessageSquareIcon,
  Database,
  TrendingUp,
  Calculator,
  ChevronDown,
  Globe,
  Check
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { User, Project, ProjectDocument, Message, Notification, ConnectionRequest } from '../types';
import { db, auth } from '../lib/firebase';
import { collection, query, getDocs, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { dbService } from '../services/db';
import { exportToCSV, exportToJSON } from '../lib/exportUtils';

interface AdminDashboardProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  onBanUser: (id: string, isBanned: boolean) => void;
  notifications: Notification[];
  initialTab?: 'users' | 'documents' | 'finance' | 'registry' | 'audit' | 'messages';
}

export default function AdminDashboard({ users, setUsers, onBanUser, notifications, initialTab }: AdminDashboardProps) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'users' | 'documents' | 'finance' | 'registry' | 'audit' | 'messages'>(initialTab || 'users');
  const [showLangMenu, setShowLangMenu] = useState(false);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setShowLangMenu(false);
  };

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'CLIENT' as User['role'], company: '', phone: '' });
  const [allDocs, setAllDocs] = useState<ProjectDocument[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  
  // Messaging states
  const [activeChatUser, setActiveChatUser] = useState<User | null>(null);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Modal states for stats
  const [selectedStatList, setSelectedStatList] = useState<{ title: string; users: User[] } | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState<string | null>(null);
  const [userToContact, setUserToContact] = useState<User | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<ConnectionRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<Notification[]>([]);
  const [failedLoginLogs, setFailedLoginLogs] = useState<any[]>([]);

  const financialDocs = allDocs.filter(d => ['INVOICE', 'QUOTE', 'PAYMENT_SCREENSHOT'].includes(d.type));
  const totalRevenue = financialDocs.filter(d => d.isSigned).reduce((acc, d) => acc + (d.amount?.ttc || 0), 0);
  const pendingRevenue = financialDocs.filter(d => !d.isSigned && d.type === 'INVOICE').reduce((acc, d) => acc + (d.amount?.ttc || 0), 0);
  const paidProjectsCount = financialDocs.filter(d => d.isSigned).length;

  const totalLogins = users.reduce((acc, u) => acc + (u.loginCount || 0), 0);
  const securityAlertsCount = auditLogs.filter(l => l.type === 'ALERT').length;

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const handleExportData = (type: 'users' | 'projects' | 'finance' | 'logs', format: 'csv' | 'json') => {
    let dataToExport: any[] = [];
    let filename = `export_${type}_${new Date().toISOString().split('T')[0]}`;
    const adminEmail = auth.currentUser?.email || 'admin';

    switch (type) {
      case 'users':
        dataToExport = users.map(u => ({ 
          Nom: u.name, 
          Email: u.email, 
          Role: u.role, 
          Connexions: u.loginCount || 0, 
          Dernier_Appareil: u.lastDeviceInfo?.device || 'N/A',
          Derniere_Localisation: u.lastDeviceInfo?.location || 'N/A',
          Statut: u.isBanned ? 'BANNI' : u.status 
        }));
        break;
      case 'projects':
        dataToExport = allProjects.map(p => ({ 
          ID: p.id, 
          Nom: p.name, 
          Client: p.clientName, 
          Localisation: p.location || 'N/A',
          Statut: p.status,
          Date_Creation: p.createdAt ? (typeof p.createdAt === 'string' ? p.createdAt : new Date(p.createdAt.seconds * 1000).toLocaleString()) : 'N/A'
        }));
        break;
      case 'finance':
        dataToExport = financialDocs.map(d => ({
          Ref: d.id,
          Type: d.type,
          Projet: allProjects.find(p => p.id === d.projectId)?.name || 'N/A',
          Montant: d.amount?.ttc || 0,
          Etat: d.isSigned ? 'Payé/Signé' : 'En attente',
          Date: d.createdAt ? (typeof d.createdAt === 'string' ? d.createdAt : new Date(d.createdAt.seconds * 1000).toLocaleString()) : 'N/A'
        }));
        break;
      case 'logs':
        dataToExport = auditLogs.map(l => ({
          Evenement: l.content,
          Auteur: l.senderName,
          Type: l.type,
          Date: l.timestamp ? (typeof l.timestamp === 'string' ? l.timestamp : new Date(l.timestamp.seconds * 1000).toLocaleString()) : 'N/A'
        }));
        break;
    }

    if (format === 'json') {
      exportToJSON(dataToExport, filename, adminEmail);
    } else {
      exportToCSV(dataToExport, filename, `Export ${type.toUpperCase()}`, adminEmail);
    }
    setIsExportMenuOpen(false);
  };

  useEffect(() => {
    // Current admin profile is needed for filtering if we want to stick to per-admin data,
    // but the request implies global admin view of everything.
    
    // Live documents subscription
    const unsubscribeDocs = dbService.subscribeToDocuments(auth.currentUser?.uid || '', 'ADMIN', (docs) => {
      setAllDocs(docs);
      setLoading(false);
    });

    // Live users subscription for online status
    const unsubscribeUsers = dbService.subscribeToUsers((liveUsers) => {
      setUsers(liveUsers);
    }, auth.currentUser?.email || undefined);

    // Connection requests subscription
    let unsubscribeReqs = () => {};
    if (auth.currentUser) {
      unsubscribeReqs = dbService.subscribeToIncomingRequests(auth.currentUser.uid, setIncomingRequests);
    }

    // Audit logs subscription (all notifications for admins)
    let unsubscribeAudit = () => {};
    if (auth.currentUser) {
      unsubscribeAudit = dbService.subscribeToAllNotifications(setAuditLogs);
    }

    const unsubscribeFailedLogins = onSnapshot(query(collection(db, 'failed_logins'), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
      setFailedLoginLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Projects subscription for Registry
    let unsubscribeProjects = () => {};
    if (auth.currentUser) {
      unsubscribeProjects = dbService.subscribeToProjects('ADMIN', auth.currentUser.uid, (prjs) => {
        setAllProjects(prjs);
      }, auth.currentUser?.email || undefined);
    }

    return () => {
      unsubscribeDocs();
      unsubscribeUsers();
      unsubscribeReqs();
      unsubscribeAudit();
      unsubscribeFailedLogins();
      unsubscribeProjects();
    };
  }, [setUsers]);

  const handleRequestAction = async (requestId: string, status: 'ACCEPTED' | 'REJECTED') => {
    try {
      await dbService.handleConnectionRequest(requestId, status);
      setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (error) {
      console.error("Failed to handle request:", error);
    }
  };

  useEffect(() => {
    if (activeChatUser && auth.currentUser) {
      const unsubscribe = dbService.subscribeToMessages(
        auth.currentUser.uid,
        activeChatUser.id,
        (msgs) => {
          setActiveMessages(msgs);
          setTimeout(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }, 100);
        }
      );
      return () => unsubscribe();
    }
  }, [activeChatUser]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeChatUser || !auth.currentUser) return;

    try {
      await dbService.sendMessage({
        senderId: auth.currentUser.uid,
        receiverId: activeChatUser.id,
        text: messageText.trim(),
        timestamp: new Date().toISOString()
      });
      setMessageText('');
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  // Map real financial data for the chart
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return d.toLocaleString('fr-FR', { month: 'short' });
  }).reverse();

  const financeData = last6Months.map(month => {
    // This is still partially simulation since we might not have 6 months of data,
    // but it's based on month names.
    const monthDocs = financialDocs.filter(doc => {
      if (!doc.createdAt) return false;
      const docDate = typeof doc.createdAt === 'string' ? new Date(doc.createdAt) : new Date(doc.createdAt.seconds * 1000);
      return docDate.toLocaleString('fr-FR', { month: 'short' }) === month;
    });
    
    return {
      name: month,
      revenue: monthDocs.filter(d => d.isSigned).reduce((acc, d) => acc + (d.amount?.ttc || 0), 0),
      projects: new Set(monthDocs.map(d => d.projectId)).size
    };
  });

  const activityLog = auditLogs.slice(0, 5).map(log => ({
    id: log.id,
    action: log.content,
    user: log.senderName || 'Système',
    date: log.timestamp ? (typeof log.timestamp === 'string' ? log.timestamp : new Date(log.timestamp.seconds * 1000).toISOString()) : new Date().toISOString(),
    type: log.type === 'ALERT' ? 'warning' : 'info'
  }));

  const loginActivityData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayName = d.toLocaleDateString('fr-FR', { weekday: 'short' });
    const dateStr = d.toISOString().split('T')[0];
    
    let count = 0;
    users.forEach(u => {
      if (u.loginHistory) {
        u.loginHistory.forEach(log => {
          if (log.timestamp.startsWith(dateStr)) {
            count++;
          }
        });
      }
    });
    
    return { name: dayName, val: count };
  });

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newUserProfile: User = {
        id: Math.random().toString(36).substring(7),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        company: newUser.company,
        phone: newUser.phone,
        status: 'online',
        createdAt: new Date().toISOString(),
        adminId: auth.currentUser?.uid,
        adminEmail: auth.currentUser?.email || '',
        isBanned: false,
        loginHistory: [],
        blockedUids: [],
        isTwoFactorEnabled: false
      };
      await dbService.createUser(newUserProfile);
      setIsAddUserOpen(false);
      setNewUser({ name: '', email: '', role: 'CLIENT', company: '', phone: '' });
    } catch (error) {
      console.error("Error adding user:", error);
    }
  };

  const handleBanUser = async (uid: string, isCurrentlyBanned: boolean) => {
    const action = isCurrentlyBanned ? 'débannir' : 'bannir';
    if (window.confirm(`Êtes-vous sûr de vouloir ${action} cet utilisateur ?`)) {
      try {
        await onBanUser(uid, !isCurrentlyBanned);
      } catch (err) {
        console.error("Ban/Unban failed:", err);
        alert(`L'action a échoué.`);
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.company && u.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = [
    { 
      id: 'users_management',
      label: 'Gestion Utilisateurs', 
      value: users.length.toString(), 
      icon: Users, 
      color: 'text-blue-500',
      action: () => setActiveTab('users')
    },
    { 
      id: 'registry',
      label: 'Registre des Projets', 
      value: allProjects.length.toString(), 
      icon: History, 
      color: 'text-amber-500',
      action: () => setActiveTab('registry')
    },
    { 
      id: 'documents',
      label: 'Tous les Documents', 
      value: allDocs.length.toString(), 
      icon: FileText, 
      color: 'text-indigo-500',
      action: () => setActiveTab('documents')
    },
    { 
      id: 'finance_total',
      label: 'Finance Système', 
      value: `${totalRevenue.toLocaleString()} DH`, 
      icon: TrendingUp, 
      color: 'text-emerald-500',
      action: () => setActiveTab('finance')
    },
    { 
      id: 'audit_logs',
      label: 'Audit Logs', 
      value: auditLogs.length.toString(), 
      icon: Shield, 
      color: 'text-purple-500',
      action: () => setActiveTab('audit')
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-3xl font-bold tracking-tight">{t('nav.dashboard')}</h1>
          <p className="text-muted-foreground mt-1">{t('admin.subtitle') || 'System-wide monitoring and user management.'}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
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
                  className="absolute right-0 mt-2 w-32 bg-card border rounded-xl shadow-xl z-50 overflow-hidden text-left"
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
          
          <div className="relative">
            <button 
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="bg-muted text-foreground border px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-muted/80 transition-all shadow-sm"
            >
              <Download className="w-5 h-5 text-primary" />
              <span>{t('admin.export_data')}</span>
              <ChevronDown className={cn("w-4 h-4 transition-transform", isExportMenuOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {isExportMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-72 bg-card border rounded-2xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="p-4 bg-muted/30 border-b">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('admin.select_data')}</p>
                  </div>
                  <div className="p-2 space-y-1">
                    {[
                      { id: 'users', label: 'Utilisateurs (CSV)', icon: Users, type: 'users', format: 'csv' },
                      { id: 'projects', label: 'Registre Projets (CSV)', icon: History, type: 'projects', format: 'csv' },
                      { id: 'finance', label: 'Rapport Financier (CSV)', icon: TrendingUp, type: 'finance', format: 'csv' },
                      { id: 'logs', label: 'Audit Logs (CSV)', icon: Shield, type: 'logs', format: 'csv' },
                      { id: 'json', label: 'Sauvegarde Système (JSON)', icon: Database, type: 'logs', format: 'json' },
                    ].map((item, idx) => (
                      <button
                        key={item.id}
                        onClick={() => handleExportData(item.type as any, item.format as any)}
                        className="w-full text-left px-4 py-3 text-xs hover:bg-primary/10 rounded-xl transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3 font-bold">
                          <item.icon className="w-4 h-4 text-primary" />
                          {item.label}
                        </div>
                        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button 
            onClick={() => setIsAddUserOpen(true)}
            className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20"
          >
            <UserPlus className="w-5 h-5" />
            <span>{t('admin.add_user')}</span>
          </button>
        </motion.div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, i) => (
          <motion.div 
            key={`admin-stat-${stat.label.replace(/\s+/g, '-').toLowerCase()}-${i}`} 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={stat.action}
            className="bg-card border rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:shadow-lg transition-all hover:border-primary/50 group"
          >
            <div className="p-3 rounded-xl bg-muted group-hover:bg-primary/10 transition-colors">
              <stat.icon className={cn("w-6 h-6", stat.color)} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t(`admin.${stat.id}` as any) || stat.label}</p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold">{stat.value}</p>
                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex border-b gap-8">
        {(['users', 'documents', 'finance', 'registry', 'audit', 'messages'] as const).map((tab, i) => (
          <button
            key={`${tab}-${i}`}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "pb-4 text-sm font-semibold capitalize transition-all relative",
              activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t(`nav.${tab}`)}
            {activeTab === tab && (
              <motion.div layoutId="adminTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Main Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-sm">
        {/* Left Column: Management Tables */}
        <div className="lg:col-span-2 space-y-6 text-base">
          {activeTab === 'users' && (
            <div className="space-y-6">
              {incomingRequests.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 animate-in slide-in-from-top duration-500">
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                    <AlertCircle className="w-4 h-4 text-primary" />
                    {t('admin.requests')} ({incomingRequests.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {incomingRequests.map((req, i) => (
                      <div key={`req-list-${req.id}-${i}`} className="bg-card border p-4 rounded-xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                            {req.senderName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{req.senderName}</p>
                            <p className="text-[10px] text-muted-foreground">{req.senderEmail}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleRequestAction(req.id, 'ACCEPTED')}
                            className="p-2 bg-green-500/10 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all"
                            title="Accepter"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleRequestAction(req.id, 'REJECTED')}
                            className="p-2 bg-red-500/10 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all"
                            title="Refuser"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-card border rounded-2xl overflow-hidden">
              <div className="p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-muted/20">
                <div className="space-y-1">
                  <h2 className="font-bold flex items-center gap-2">
                    {t('admin.linked_users')}
                  </h2>
                  <div className="flex gap-3 text-[10px] font-bold uppercase tracking-wider">
                    <span className="text-primary">{t('admin.topographers_count', { count: users.filter(u => u.role === 'TOPOGRAPHER').length })}</span>
                    <span className="text-muted-foreground">{t('admin.clients_count', { count: users.filter(u => u.role === 'CLIENT').length })}</span>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder={t('common.search')} 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-muted border rounded-full py-1.5 pl-10 pr-4 text-xs outline-none focus:ring-1 focus:ring-primary w-48 transition-all focus:w-64"
                  />
                </div>
              </div>
              <div className="overflow-x-auto text-sm">
                <table className="w-full text-left">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-6 py-4 font-bold">{t('admin.user')}</th>
                      <th className="px-6 py-4 font-bold">{t('admin.role')}</th>
                      <th className="px-6 py-4 font-bold">{t('admin.company')}</th>
                      <th className="px-6 py-4 font-bold text-right">{t('admin.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y relative">
                    {filteredUsers.filter(u => u.id !== auth.currentUser?.uid).map((user, i) => (
                      <motion.tr 
                        key={`user-${user.id}-${i}`} 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                                {user.name.charAt(0)}
                              </div>
                              {user.status === 'online' && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card ring-1 ring-green-500/20 animate-pulse" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold">{user.name}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-black" title="Nombre de connexions">
                                  {user.loginCount || 0} LOGINS
                                </span>
                                {user.isBanned && (
                                  <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-black uppercase">{t('admin.banned')}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                              user.role === 'TOPOGRAPHER' ? 'bg-primary/20 text-primary' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {user.role === 'TOPOGRAPHER' ? t('admin.my_topographer') : user.role}
                            </span>
                            {user.role === 'TOPOGRAPHER' && (
                              <div className="w-1.5 h-1.5 rounded-full bg-primary" title="Personnel assigné" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-muted-foreground">
                          {user.company || t('admin.individual')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 relative">
                            <div className="relative">
                              <button 
                                onClick={() => setUserMenuOpen(userMenuOpen === user.id ? null : user.id)}
                                className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                              >
                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                              </button>
                              
                              <AnimatePresence>
                                {userMenuOpen === user.id && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                    className="absolute right-0 top-full mt-2 w-48 bg-card border rounded-xl shadow-xl z-50 overflow-hidden"
                                  >
                                    <button 
                                      onClick={() => {
                                        setUserToContact(user);
                                        setUserMenuOpen(null);
                                      }}
                                      className="w-full text-left px-4 py-3 text-xs hover:bg-muted font-bold flex items-center gap-2"
                                    >
                                      <Mail className="w-4 h-4" /> {t('admin.contact')}
                                    </button>
                                    <button 
                                      onClick={() => {
                                        handleBanUser(user.id, !!user.isBanned);
                                        setUserMenuOpen(null);
                                      }}
                                      className={cn(
                                        "w-full text-left px-4 py-3 text-xs hover:bg-muted font-bold flex items-center gap-2 border-t",
                                        user.isBanned ? "text-green-600" : "text-amber-600"
                                      )}
                                    >
                                      <Ban className="w-4 h-4" /> {user.isBanned ? t('admin.unban') : t('admin.ban')}
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div className="p-12 text-center text-muted-foreground italic">
                    {t('admin.no_user_found')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

          {activeTab === 'messages' && (
            <div className="bg-card border rounded-2xl overflow-hidden h-[600px] flex">
              {/* Contacts Sidebar */}
              <div className="w-1/3 border-r flex flex-col">
                <div className="p-4 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input 
                      type="text" 
                      placeholder={t('admin.search_contact')} 
                      className="w-full bg-muted border-none rounded-xl py-2 pl-10 pr-4 text-xs outline-none"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {users.filter(u => u.id !== auth.currentUser?.uid && u.role === 'TOPOGRAPHER').map((user, i) => (
                    <button 
                      key={`chat-contact-${user.id}-${i}`}
                      onClick={() => setActiveChatUser(user)}
                      className={cn(
                        "w-full p-4 flex items-center gap-3 transition-colors text-left",
                        activeChatUser?.id === user.id ? "bg-primary/5 border-r-2 border-primary" : "hover:bg-muted/50"
                      )}
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                        {user.avatar ? <img src={user.avatar} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" /> : user.name.charAt(0)}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="font-bold text-sm truncate">{user.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">{user.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat View */}
              <div className="flex-1 flex flex-col bg-muted/10">
                {activeChatUser ? (
                  <>
                    <div className="p-4 bg-card border-b flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                          {activeChatUser.avatar ? <img src={activeChatUser.avatar} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" /> : activeChatUser.name.charAt(0)}
                        </div>
                        <h3 className="font-bold text-sm">{activeChatUser.name}</h3>
                      </div>
                      <button 
                        onClick={() => setUserToContact(activeChatUser)}
                        className="p-2 hover:bg-muted rounded-full"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                      {activeMessages.map((msg, i) => {
                        const isMine = msg.senderId === auth.currentUser?.uid;
                        return (
                          <div key={`msg-${msg.id || i}`} className={cn("flex flex-col", isMine ? "items-end" : "items-start")}>
                            <div className={cn(
                              "max-w-[80%] p-3 rounded-2xl text-sm",
                              isMine ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border rounded-tl-none"
                            )}>
                              {msg.text}
                            </div>
                            <span className="text-[10px] text-muted-foreground mt-1 px-1">
                              {msg.timestamp ? new Date(msg.timestamp.seconds * 1000 || msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                        );
                      })}
                      {activeMessages.length === 0 && (
                        <div className="h-full flex items-center justify-center text-muted-foreground italic text-xs">
                          {t('messages.empty')}
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleSendMessage} className="p-4 bg-card border-t flex gap-2">
                      <input 
                        type="text" 
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder={t('messages.placeholder')}
                        className="flex-1 bg-muted border-none rounded-xl px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button 
                        type="submit"
                        disabled={!messageText.trim()}
                        className="p-2 bg-primary text-primary-foreground rounded-xl disabled:opacity-50 hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                      >
                        <Send className="w-4 h-4 rotate-0" />
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 opacity-40">
                    <MessageSquareIcon className="w-16 h-16" />
                    <p className="font-bold">Sélectionnez un contact pour démarrer une conversation interne sécurisée.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'finance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: t('admin.finance_total'), value: `${totalRevenue.toLocaleString()} MAD`, color: 'text-green-600', icon: TrendingUp },
                  { label: t('admin.pending_invoices'), value: `${pendingRevenue.toLocaleString()} MAD`, color: 'text-amber-600', icon: Clock },
                  { label: t('admin.completed_projects'), value: paidProjectsCount.toString(), color: 'text-primary', icon: CheckCircle2 },
                ].map((stat, i) => (
                  <div key={`fin-stat-${stat.label}-${i}`} className="bg-card border rounded-2xl p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className={cn("p-3 rounded-xl bg-opacity-10", stat.color.replace('text-', 'bg-'))}>
                        <stat.icon className={cn("w-6 h-6", stat.color)} />
                      </div>
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                    <h3 className="text-2xl font-black mt-1">{stat.value}</h3>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="bg-card border rounded-2xl p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="font-bold text-lg">Performance Financière</h3>
                      <p className="text-xs text-muted-foreground">Volume de facturation mensuel (Simulé)</p>
                    </div>
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <BarChartIcon className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={financeData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--muted)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                        <Tooltip 
                          cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: 'var(--card)' }}
                        />
                        <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                          {financeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === financeData.length - 1 ? 'var(--primary)' : 'var(--primary)'} fillOpacity={0.6 + (index * 0.08)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-card border rounded-2xl overflow-hidden">
                  <div className="p-6 border-b bg-muted/20 flex justify-between items-center">
                    <h2 className="font-bold">Factures & Transactions</h2>
                    <button className="text-[10px] bg-primary text-primary-foreground px-4 py-2 rounded-xl font-bold hover:opacity-90">
                      Export XLSX
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="px-6 py-4 font-bold">Réf.</th>
                          <th className="px-6 py-4 font-bold">Client</th>
                          <th className="px-6 py-4 font-bold">Montant</th>
                          <th className="px-6 py-4 font-bold">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-[11px]">
                        {financialDocs.length > 0 ? financialDocs.slice(0, 8).map((doc, i) => (
                          <tr key={`fin-row-${doc.id}-${i}`} className="hover:bg-muted/30">
                            <td className="px-6 py-4 font-mono font-bold text-primary">#{doc.id.slice(0, 6).toUpperCase()}</td>
                            <td className="px-6 py-4 font-medium truncate max-w-[100px]">
                              {allProjects.find(p => p.id === doc.projectId)?.clientName || 'N/A'}
                            </td>
                            <td className="px-6 py-4 font-black">{doc.amount?.ttc ? `${doc.amount.ttc} DH` : 'N/A'}</td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[9px] font-bold uppercase",
                                doc.isSigned ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                              )}>
                                {doc.isSigned ? 'Payé' : 'Attente'}
                              </span>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={4} className="py-12 text-center text-muted-foreground italic">
                              Aucune transaction détectée.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="bg-card border rounded-2xl p-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-bold text-lg text-primary">Tous les Documents du Système</h3>
                <p className="text-xs text-muted-foreground">{allDocs.length} documents archivés</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allDocs.length > 0 ? allDocs.map((doc, i) => (
                  <a 
                    key={`doc-adm-${doc.id}-${i}`} 
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-5 bg-muted rounded-2xl hover:bg-primary/5 hover:border-primary/20 border border-transparent transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="font-bold block text-sm">{doc.name}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] bg-muted px-2 py-0.5 rounded font-black uppercase text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">{doc.type}</span>
                          <span className="text-[9px] text-muted-foreground">{doc.size}</span>
                        </div>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </a>
                )) : (
                  <div className="col-span-full p-20 text-center text-muted-foreground italic border-2 border-dashed rounded-3xl">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    Aucun document trouvé dans la base de données.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'registry' && (
            <div className="bg-card border rounded-2xl overflow-hidden">
              <div className="p-6 border-b bg-muted/20 flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-lg">Registre des Projets & Interventions</h2>
                  <p className="text-xs text-muted-foreground">{allProjects.length} records in system</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-primary/10 text-primary px-3 py-1.5 rounded-full font-black uppercase tracking-widest border border-primary/20">Archive Centrale</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Réf. Projet</th>
                      <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Libellé du Projet</th>
                      <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Client Rattaché</th>
                      <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Topographe</th>
                      <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Statut</th>
                      <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Date de Création</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {allProjects.map((prj, i) => (
                      <motion.tr 
                        key={`reg-prj-${prj.id}-${i}`} 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-muted/30 transition-colors group"
                      >
                        <td className="px-6 py-4 font-mono text-[10px] text-primary font-bold">#{prj.id.slice(0, 8).toUpperCase()}</td>
                        <td className="px-6 py-4">
                          <p className="font-bold group-hover:text-primary transition-colors">{prj.name}</p>
                          <p className="text-[10px] text-muted-foreground">{prj.location || 'Localisation non définie'}</p>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium">{prj.clientName}</td>
                        <td className="px-6 py-4 text-xs font-medium text-muted-foreground">
                          {users.find(u => u.id === prj.topographerId)?.name || `ID: ${prj.topographerId.slice(0, 8)}`}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest",
                            prj.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            prj.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          )}>
                            {prj.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-xs text-muted-foreground">
                          {prj.createdAt ? new Date(prj.createdAt.seconds * 1000 || prj.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                      </motion.tr>
                    ))}
                    {allProjects.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-20 text-center text-muted-foreground italic">
                          <div className="flex flex-col items-center gap-3 opacity-30">
                            <Database className="w-12 h-12" />
                            <p>Aucun projet enregistré dans le registre central.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="bg-card border rounded-2xl overflow-hidden">
              <div className="p-6 border-b bg-muted/20 flex justify-between items-center">
                <h2 className="font-bold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  {t('admin.audit_title')}
                </h2>
                <button className="text-[10px] font-black text-primary border border-primary/20 px-3 py-1 rounded-lg hover:bg-primary/5">
                  {t('admin.export_logs')}
                </button>
              </div>
              <div className="p-4 space-y-4">
                {auditLogs.map((log, i) => (
                  <motion.div 
                    key={`audit-log-${log.id}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-all border border-transparent hover:border-muted-foreground/10"
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      log.type === 'ALERT' ? 'bg-red-500/10 text-red-600' : 
                      log.type === 'LOGIN' ? 'bg-blue-500/10 text-blue-600' :
                      log.type === 'DOCUMENT' ? 'bg-indigo-500/10 text-indigo-600' :
                      log.type === 'PROJECT' ? 'bg-green-500/10 text-green-600' : 'bg-primary/10 text-primary'
                    )}>
                      {log.type === 'LOGIN' ? <Activity className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-sm">{log.content}</p>
                        <span className="text-[10px] text-muted-foreground">
                          {log.timestamp ? (log.timestamp.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleString() : new Date(log.timestamp).toLocaleString()) : 'Fait récemment'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-black uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{t('admin.actor')}: {log.senderName}</span>
                        <span className="text-[9px] font-black uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded">{t('admin.type')}: {log.type}</span>
                        {log.link && <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded underline cursor-pointer">{t('admin.link')}: {log.link}</span>}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {auditLogs.length === 0 && (
                  <div className="text-center py-20 text-muted-foreground italic">
                    {t('admin.no_audit_logs')}
                  </div>
                )}
              </div>

              {/* NEW: Failed Logins Section */}
              <div className="p-6 border-t bg-destructive/5">
                <h3 className="font-bold text-destructive flex items-center gap-2 mb-4">
                  <ShieldAlert className="w-4 h-4" />
                  {t('admin.failed_logins')}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-muted border-b text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 uppercase font-black">{t('login.email')}</th>
                        <th className="px-4 py-2 uppercase font-black">{t('admin.logs.reason')}</th>
                        <th className="px-4 py-2 uppercase font-black">{t('admin.logs.device')}</th>
                        <th className="px-4 py-2 uppercase font-black text-right">{t('admin.logs.date')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {failedLoginLogs.map((log, i) => (
                        <tr key={`failed-log-${log.id}-${i}`} className="hover:bg-destructive/10 transition-colors">
                          <td className="px-4 py-3 font-bold">{log.email}</td>
                          <td className="px-4 py-3">
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold uppercase">{log.reason}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">{log.userAgent}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {log.timestamp ? new Date(log.timestamp.seconds * 1000 || log.timestamp).toLocaleString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                      {failedLoginLogs.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-muted-foreground italic">{t('admin.logs.no_failed_logins')}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Security & Activity Log */}
        <div className="space-y-6">
          <section className="bg-primary text-primary-foreground rounded-2xl p-6 shadow-xl shadow-primary/20 relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-bold flex items-center gap-2 mb-2">
                {t('admin.security_status')}
                <ShieldAlert className="w-4 h-4" />
              </h3>
              <p className="text-sm opacity-90 mb-6">{t('admin.security_optimal')}</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 p-3 rounded-xl">
                  <p className="text-[10px] uppercase font-bold opacity-60">Logins Globaux</p>
                  <p className="text-xl font-black">{totalLogins}</p>
                </div>
                <div className="bg-white/10 p-3 rounded-xl">
                  <p className="text-[10px] uppercase font-bold opacity-60">Alertes Sec.</p>
                  <p className="text-xl font-black text-amber-300">{securityAlertsCount}</p>
                </div>
              </div>
            </div>
            <ShieldAlert className="absolute -bottom-10 -right-10 w-40 h-40 opacity-10" />
          </section>

          <section className="bg-card border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">{t('admin.activity_log')}</h3>
              <button onClick={() => setActiveTab('audit')} className="text-[10px] font-bold text-primary hover:underline">Voir tout</button>
            </div>
            <div className="space-y-6">
              {(auditLogs || []).slice(0, 10).map((notif, i) => (
                <div key={`log-${notif.id}-${i}`} className="flex gap-4 group">
                  <div className="relative flex flex-col items-center">
                    <div className={cn(
                      "w-2.5 h-2.5 rounded-full z-10",
                      notif.type === 'ALERT' ? 'bg-red-500' :
                      notif.type === 'DOCUMENT' ? 'bg-blue-500' :
                      notif.type === 'PROJECT' ? 'bg-amber-500' : 'bg-green-500'
                    )} />
                    {i < Math.min(notifications.length, 10) - 1 && <div className="w-0.5 h-full bg-muted absolute top-2.5" />}
                  </div>
                  <div className="pb-6">
                    <p className="text-xs font-bold leading-tight group-hover:text-primary transition-colors">{notif.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Par {notif.senderName} • {notif.timestamp ? new Date(notif.timestamp.seconds * 1000 || notif.timestamp).toLocaleString() : 'Just now'}</p>
                  </div>
                </div>
              ))}
              {(!notifications || notifications.length === 0) && (
                <div className="text-center py-12 text-xs text-muted-foreground italic">
                  {t('admin.no_activity')}
                </div>
              )}
            </div>
          </section>

          <section className="bg-card border rounded-2xl p-6">
            <h3 className="font-bold mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground flex justify-between items-center">
              {t('admin.login_activity')}
              <Activity className="w-4 h-4 text-primary" />
            </h3>
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={loginActivityData}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', background: 'var(--card)', color: 'var(--foreground)' }}
                  />
                  <Area type="monotone" dataKey="val" stroke="var(--primary)" fillOpacity={1} fill="url(#colorVal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </div>

      {/* Contact Info Modal */}
      <AnimatePresence>
        {userToContact && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setUserToContact(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md" 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-card border rounded-[2rem] w-full max-w-sm p-8 shadow-2xl text-center"
            >
              <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Mail className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-black mb-1">{userToContact.name}</h3>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mb-8">{userToContact.role}</p>
              
              <div className="space-y-4 mb-8">
                <div className="bg-muted/50 p-4 rounded-2xl">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 text-left">{t('login.email')}</p>
                  <p className="font-bold text-sm text-left truncate">{userToContact.email}</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-2xl">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 text-left">{t('admin.phone')}</p>
                  <p className="font-bold text-sm text-left">{userToContact.phone || t('common.unknown')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <a 
                  href={`mailto:${userToContact.email}`}
                  className="flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:opacity-90 transition-all"
                >
                  <Mail className="w-4 h-4" /> Email
                </a>
                <a 
                  href={`tel:${userToContact.phone}`}
                  className={cn(
                    "flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all",
                    userToContact.phone ? "bg-green-600 text-white hover:bg-green-500" : "bg-muted text-muted-foreground pointer-events-none"
                  )}
                >
                  <Phone className="w-4 h-4" /> Appeler
                </a>
              </div>
              <button 
                onClick={() => setUserToContact(null)}
                className="mt-6 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                Fermer
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stat List Modal */}
      <AnimatePresence>
        {selectedStatList && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedStatList(null)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-card border rounded-3xl w-full max-w-2xl p-8 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold">{selectedStatList.title}</h2>
                  <p className="text-muted-foreground text-sm">{selectedStatList.users.length} utilisateurs trouvés.</p>
                </div>
                <button onClick={() => setSelectedStatList(null)} className="p-2 hover:bg-muted rounded-full transition-colors font-bold">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                {selectedStatList.users.map((user, i) => (
                  <div key={`stat-user-${user.id}-${i}`} className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl hover:bg-muted/60 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          user.name.charAt(0)
                        )}
                      </div>
                      <div>
                        <p className="font-bold">{user.name}</p>
                        <p className="text-xs text-muted-foreground uppercase">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary hover:text-primary-foreground transition-all">
                        Détails
                      </button>
                    </div>
                  </div>
                ))}
                {selectedStatList.users.length === 0 && (
                  <div className="text-center py-20 italic text-muted-foreground">Aucun utilisateur trouvé dans cette catégorie.</div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add User Modal */}
      <AnimatePresence>
        {isAddUserOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsAddUserOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-card border rounded-3xl w-full max-w-lg p-8 shadow-2xl"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold">{t('admin.new_account_title')}</h2>
                  <p className="text-muted-foreground text-sm">{t('admin.new_account_subtitle')}</p>
                </div>
                <button onClick={() => setIsAddUserOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors font-bold">✕</button>
              </div>

              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">{t('admin.full_name')}</label>
                  <input
                    required
                    value={newUser.name}
                    onChange={e => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition-all"
                    placeholder="e.g. Jean Dupont"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">{t('login.email')}</label>
                  <input
                    required
                    type="email"
                    value={newUser.email}
                    onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition-all"
                    placeholder="jean@example.com"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">{t('admin.role')}</label>
                    <select
                      value={newUser.role}
                      onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value as User['role'] }))}
                      className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition-all"
                    >
                      <option value="CLIENT">Client</option>
                      <option value="TOPOGRAPHER">Topographer</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">{t('admin.company')}</label>
                    <input
                      value={newUser.company}
                      onChange={e => setNewUser(prev => ({ ...prev, company: e.target.value }))}
                      className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition-all"
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">{t('admin.phone')}</label>
                  <input
                    type="tel"
                    value={newUser.phone}
                    onChange={e => setNewUser(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-muted border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary transition-all"
                    placeholder="+212 600 000 000"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold mt-4 shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
                >
                  {t('admin.create_account_btn')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
