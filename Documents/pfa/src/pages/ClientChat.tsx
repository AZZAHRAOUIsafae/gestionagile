import React, { useState, useEffect } from 'react';
import { 
  Send, 
  MapPin, 
  Paperclip, 
  Image as ImageIcon, 
  FileText, 
  ExternalLink,
  Loader2,
  Mail,
  Plus,
  User as UserIcon,
  ChevronLeft,
  X,
  File as FileIcon,
  Download,
  Check,
  MoreVertical,
  Trash2,
  EyeOff,
  Ban
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { dbService } from '../services/db';
import { User, Message } from '../types';
import { useLocation, useNavigate } from 'react-router-dom';

export default function ClientChat({ user, onUpdate }: { user: User, onUpdate: (u: User) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipient, setRecipient] = useState<User | null>(null);
  const [pendingFile, setPendingFile] = useState<{ name: string, data: string, type: string } | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const chatContainerRef = React.useRef<HTMLDivElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const [contacts, setContacts] = useState<User[]>([]);
  const [refreshContactsTrigger, setRefreshContactsTrigger] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [availableTopographers, setAvailableTopographers] = useState<User[]>([]);

  useEffect(() => {
    const fetchTopos = async () => {
      const topos = await dbService.getTopographers();
      // Filter out blocked topos if desired, or just show them differently
      setAvailableTopographers(topos);
    };
    fetchTopos();
  }, []);

  const isBlocked = (uid: string) => {
    return user.blockedUids?.includes(uid);
  };

  const handleToggleBlock = async (uid: string) => {
    if (!uid) return;
    const isCurrentlyBlocked = isBlocked(uid);
    const newBlocked = isCurrentlyBlocked 
      ? user.blockedUids?.filter(id => id !== uid) || []
      : [...(user.blockedUids || []), uid];
    
    await dbService.updateUser(user.id, { blockedUids: newBlocked });
    onUpdate({ ...user, blockedUids: newBlocked });
  };

  const handleStartNewChat = (topoId: string) => {
    setTargetId(topoId);
    setIsNewChatModalOpen(false);
  };
  
  // Use recipient from state or fallback to default
  const [targetId, setTargetId] = useState<string>(location.state?.selectedRecipientId || '');

  useEffect(() => {
    const fetchContacts = async () => {
      if (user.role === 'ADMIN') return;
      const chatContacts = await dbService.getChatContacts(user.id, user.role);
      setContacts(chatContacts);
      
      // If we have no targetId but have contacts, select the first one
      if (!targetId && chatContacts.length > 0) {
        setTargetId(chatContacts[0].id);
      }
    };
    fetchContacts();
  }, [user.id, user.role, targetId, refreshContactsTrigger]);

  useEffect(() => {
    if (location.state?.initialMessage) {
      setInput(location.state.initialMessage);
      // Clear state after reading to prevent re-populating on every render if we stay on the page
      navigate(location.pathname, { replace: true, state: { ...location.state, initialMessage: undefined } });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    const initTarget = async () => {
      if (!targetId) {
        // Try to find a recipient from projects
        const projects = await dbService.getProjects(user.role, user.id);
        if (projects.length > 0) {
          const firstTarget = user.role === 'CLIENT' ? projects[0].topographerId : projects[0].clientId;
          setTargetId(firstTarget || '');
        } else {
          // Absolute fallback
          setTargetId(user.role === 'CLIENT' ? 'topo-123' : 'client-123');
        }
      }
    };
    initTarget();
  }, [targetId, user.id, user.role]);

  useEffect(() => {
    const fetchRecipient = async () => {
      if (targetId && targetId !== 'topo-123' && targetId !== 'client-123') {
        const u = await dbService.getUser(targetId);
        setRecipient(u);
      } else {
        setRecipient(null);
      }
    };
    fetchRecipient();
  }, [targetId]);

  useEffect(() => {
    if (!user?.id || !targetId) return;
    const unsubscribe = dbService.subscribeToMessages(user.id, targetId, (msgs) => {
      setMessages(msgs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user.id, targetId]);

  const isUserUnderage = user.role !== 'ADMIN' && (user.age !== undefined && user.age !== null && user.age > 0 && user.age < 18);
  const isRecipientUnderage = recipient?.role === 'CLIENT' && (recipient?.age !== undefined && recipient?.age !== null && recipient?.age > 0 && recipient?.age < 18);
  const isRestrictedByAge = isUserUnderage || isRecipientUnderage;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800 * 1024) { // 800KB limit for base64 in Firestore
      alert('Le fichier est trop volumineux (max 800Ko). Pour des fichiers plus gros, utilisez la section Documents du projet.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPendingFile({
        name: file.name,
        type: file.type,
        data: event.target?.result as string
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRestrictedByAge) {
      alert('Désolé, les utilisateurs de moins de 18 ans ne peuvent pas participer aux discussions.');
      return;
    }
    if (isBlocked(targetId)) {
      alert('Vous avez bloqué cet utilisateur.');
      return;
    }
    if (!input.trim() && !pendingFile) return;

    const newMsg: Message = {
      senderId: user.id,
      receiverId: targetId,
      text: input.trim(),
      fileUrl: pendingFile?.data,
      fileName: pendingFile?.name,
      fileType: pendingFile?.type,
      timestamp: new Date().toISOString()
    };

    setInput('');
    setPendingFile(null);
    await dbService.sendMessage(newMsg);
    setRefreshContactsTrigger(prev => prev + 1);

    // Send notification to recipient
    await dbService.createNotification({
      userId: targetId,
      senderId: user.id,
      senderName: user.name,
      senderAvatar: user.avatar,
      type: 'MESSAGE',
      content: pendingFile ? `A envoyé un fichier: ${pendingFile.name}` : input,
      link: '/messages'
    });
  };

  const handleDeleteForMe = async (msgId: string) => {
    setActiveMenuId(null);
    if (!msgId) return;
    try {
      await dbService.deleteMessageForMe(msgId, user.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteForEveryone = async (msgId: string) => {
    setActiveMenuId(null);
    if (!msgId) return;
    try {
      await dbService.deleteMessageForEveryone(msgId);
    } catch (e) {
      console.error(e);
    }
  };

  if (isRestrictedByAge) {
    return (
      <div className="flex flex-col h-[calc(100vh-10rem)] items-center justify-center bg-card border rounded-2xl p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
          <UserIcon className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold">Accès Restreint</h2>
        <p className="text-muted-foreground max-w-md">
          {isUserUnderage 
            ? "Désolé, vous devez avoir au moins 18 ans pour utiliser le service de messagerie."
            : "Ce client est mineur. Les discussions avec des utilisateurs de moins de 18 ans sont restreintes."}
        </p>
        <button 
          onClick={() => navigate('/')}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-xl font-bold shadow-lg"
        >
          Retour au tableau de bord
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] bg-card border rounded-3xl animate-in fade-in duration-500 overflow-hidden shadow-sm">
      {/* Sidebar - Contacts List */}
      <div className={cn(
        "w-80 border-r bg-muted/5 flex flex-col transition-all duration-300 shrink-0",
        !isSidebarOpen && "w-0 border-none overflow-hidden"
      )}>
        <div className="p-6 border-b flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-primary">Conversations</h2>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setIsNewChatModalOpen(true)}
                className="p-1.5 hover:bg-primary/10 text-primary rounded-lg transition-all"
                title="Nouvelle discussion"
              >
                <Send className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="md:hidden p-1.5 hover:bg-muted rounded-lg"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">Historique sécurisé & archivé</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {contacts.map((contact, i) => (
            <button
              key={`contact-${contact.id}-${i}`}
              onClick={() => setTargetId(contact.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-2xl transition-all group",
                targetId === contact.id 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                  : "hover:bg-muted"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl overflow-hidden shrink-0 border-2",
                targetId === contact.id ? "border-white/20" : "border-primary/10"
              )}>
                {contact.avatar ? (
                  <img src={contact.avatar} className="w-full h-full object-cover" alt={contact.name} referrerPolicy="no-referrer" />
                ) : (
                  <div className={cn(
                    "w-full h-full flex items-center justify-center font-bold",
                    targetId === contact.id ? "bg-white/20" : "bg-primary/5 text-primary"
                  )}>
                    {contact.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-black truncate">{contact.name}</p>
                <p className={cn(
                  "text-[10px] truncate",
                  targetId === contact.id ? "text-white/70" : "text-muted-foreground"
                )}>
                  {contact.role}
                </p>
              </div>
            </button>
          ))}
          {contacts.length === 0 && (
            <div className="p-8 text-center opacity-40 grayscale">
              <Mail className="w-8 h-8 mx-auto mb-2" />
              <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                Aucune conversation active
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background/50">
        {/* Contact Bar */}
        <div className="p-4 border-b flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-muted rounded-xl transition-all"
              >
                <MoreVertical className="w-5 h-5 rotate-90" />
              </button>
            )}
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-bold overflow-hidden border border-primary/20">
              {recipient?.avatar ? (
                <img src={recipient.avatar} className="w-full h-full object-cover" alt={recipient.name} referrerPolicy="no-referrer" />
              ) : (
                <span>{recipient?.name ? recipient.name.substring(0, 2).toUpperCase() : (user.role === 'CLIENT' ? 'TA' : 'CL')}</span>
              )}
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight">{recipient?.name || (user.role === 'CLIENT' ? 'Cabinet Topo Atlas' : 'Client Al Omrane')}</h3>
              <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                En ligne
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleToggleBlock(targetId)}
              className={cn(
                "p-2 rounded-xl transition-all",
                isBlocked(targetId) 
                  ? "bg-destructive text-white shadow-lg shadow-destructive/20" 
                  : "bg-muted hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
              )}
              title={isBlocked(targetId) ? "Débloquer" : "Bloquer cet utilisateur"}
            >
              <Ban className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 relative" onClick={() => setActiveMenuId(null)}>
          {isBlocked(targetId) ? (
            <div className="absolute inset-0 z-30 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-300">
              <div className="w-20 h-20 bg-destructive/10 rounded-3xl flex items-center justify-center text-destructive mb-6 shadow-xl shadow-destructive/10 border border-destructive/20">
                <Ban className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold mb-2">Expert Bloqué</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
                Vous avez bloqué cet utilisateur. Pour reprendre la conversation, vous devez le débloquer.
              </p>
              <button 
                onClick={() => handleToggleBlock(targetId)}
                className="bg-primary text-primary-foreground px-8 py-3 rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
              >
                Débloquer l'accès
              </button>
            </div>
          ) : null}
          
          <div ref={chatContainerRef} className="space-y-4">
            {loading ? (
              <div className="h-full flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-primary opacity-20" />
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 py-20">
                <Mail className="w-12 h-12 mb-2" />
                <p>Commencez la discussion</p>
              </div>
            ) : (
              <>
                {messages.filter(m => !m.deletedBy?.includes(user.id)).map((msg, i) => (
          <motion.div 
            key={msg.id ? `msg-${msg.id}-${i}` : `msg-temp-${i}`}
            initial={{ opacity: 0, x: msg.senderId === user.id ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "flex flex-col max-w-[80%] relative group",
              msg.senderId === user.id ? "ml-auto items-end" : "items-start"
            )}
          >
            {/* Context Menu Button */}
            {!msg.deletedForEveryone && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuId(activeMenuId === msg.id ? null : msg.id || null);
                }}
                className={cn(
                  "absolute top-0 p-1 opacity-0 group-hover:opacity-100 bg-background/80 backdrop-blur rounded-full border shadow-sm transition-all z-10",
                  msg.senderId === user.id ? "right-full mr-2" : "left-full ml-2"
                )}
              >
                <MoreVertical className="w-3 h-3 text-muted-foreground" />
              </button>
            )}

            {/* Context Menu */}
            <AnimatePresence>
              {activeMenuId === msg.id && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className={cn(
                    "absolute top-8 z-20 bg-background border rounded-xl shadow-xl p-1 min-w-[160px] overflow-hidden",
                    msg.senderId === user.id ? "right-full mr-2" : "left-full ml-2"
                  )}
                >
                  <button 
                    onClick={() => handleDeleteForMe(msg.id!)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold hover:bg-muted text-foreground transition-colors rounded-lg"
                  >
                    <EyeOff className="w-3 h-3" />
                    Supprimer pour moi
                  </button>
                  {msg.senderId === user.id && (
                    <button 
                      onClick={() => handleDeleteForEveryone(msg.id!)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold hover:bg-red-50 text-red-500 transition-colors rounded-lg"
                    >
                      <Trash2 className="w-3 h-3" />
                      Supprimer pour tous
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className={cn(
              "p-4 rounded-2xl shadow-sm text-sm",
              msg.senderId === user.id 
                ? "bg-primary text-primary-foreground rounded-tr-none" 
                : "bg-muted text-foreground rounded-tl-none border",
              msg.deletedForEveryone && "opacity-50 italic"
            )}>
              {msg.deletedForEveryone ? (
                <p className="flex items-center gap-2">
                  <Trash2 className="w-3 h-3" />
                  Ce message a été supprimé
                </p>
              ) : (
                <>
                  {msg.text && <p className="mb-2 whitespace-pre-wrap">{msg.text}</p>}
                  
                  {msg.fileUrl && (
                    <div className={cn(
                      "p-3 rounded-xl flex items-center gap-3",
                      msg.senderId === user.id ? "bg-white/10" : "bg-white border"
                    )}>
                      {msg.fileType?.startsWith('image/') ? (
                        <img 
                          src={msg.fileUrl} 
                          className="w-full h-auto max-h-48 object-cover rounded-lg cursor-pointer" 
                          alt={msg.fileName}
                          referrerPolicy="no-referrer"
                          onClick={() => window.open(msg.fileUrl, '_blank')}
                        />
                      ) : (
                        <>
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <FileIcon className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold truncate text-xs">{msg.fileName}</p>
                            <p className="text-[10px] opacity-70 uppercase">{msg.fileType?.split('/')[1] || 'Fichier'}</p>
                          </div>
                          <a 
                            href={msg.fileUrl} 
                            download={msg.fileName}
                            className="p-2 hover:bg-black/10 rounded-lg transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </>
                      )}
                    </div>
                  )}

                  {msg.text.includes('https://www.google.com/maps') && (
                    <div className="space-y-2 mt-3">
                      <a 
                        href={msg.text.split(' ').find(word => word.startsWith('https://www.google.com/maps')) || 'https://maps.google.com'} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-2 p-2 bg-black/10 rounded-lg font-medium hover:bg-black/20 transition-all text-[10px]"
                      >
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">Ouvrir la position partagée</span>
                        <ExternalLink className="w-2.5 h-2.5 ml-auto opacity-50" />
                      </a>
                      
                      {user.role === 'TOPOGRAPHER' && (
                        <button 
                          onClick={() => {
                            const url = msg.text.split(' ').find(word => word.startsWith('https://www.google.com/maps'));
                            if (url) {
                              navigate('/maps', { state: { importMapUrl: url, clientId: msg.senderId } });
                            }
                          }}
                          className="w-full flex items-center justify-center gap-2 p-2 bg-primary/20 text-primary rounded-lg font-bold hover:bg-primary/30 transition-all text-[10px] border border-primary/20"
                        >
                          <Plus className="w-3 h-3" />
                          Enregistrer dans mes relevés
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground mt-1 px-1 flex items-center gap-1">
              {msg.timestamp?.toDate 
                ? msg.timestamp.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                : (msg.timestamp && typeof msg.timestamp === 'string')
                    ? new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                    : "Envoi..."}
              {msg.senderId === user.id && msg.timestamp && !msg.deletedForEveryone && (
                <Check className="w-2.5 h-2.5 text-blue-500" />
              )}
            </span>
          </motion.div>
        ))}
          </>
        )}
          </div>
        </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="p-4 border-t bg-muted/10 space-y-4">
        {pendingFile && (
          <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/10 rounded-xl animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileIcon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold truncate max-w-[200px]">{pendingFile.name}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{pendingFile.type}</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => setPendingFile(null)}
              className="p-1.5 hover:bg-muted rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
          />
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-accent rounded-xl text-muted-foreground transition-colors"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <div className="flex-1 relative">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isBlocked(targetId) ? "Discussion restreinte" : "Écrivez un message..."}
              disabled={isBlocked(targetId)}
              className={cn(
                "w-full bg-muted border-none rounded-xl py-2.5 px-4 text-sm focus:ring-1 focus:ring-primary outline-none transition-all",
                isBlocked(targetId) && "opacity-50 cursor-not-allowed"
              )}
            />
          </div>
          <button 
            type="submit"
            className="p-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all shadow-md shadow-primary/20"
            disabled={(!input.trim() && !pendingFile) || isBlocked(targetId)}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>

      {/* New Chat Modal */}
      <AnimatePresence>
        {isNewChatModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-card border rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b flex items-center justify-between">
                <h3 className="font-black text-lg">Nouvelle Discussion</h3>
                <button onClick={() => setIsNewChatModalOpen(false)} className="p-2 hover:bg-muted rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 mb-2">Choisir un topographe</p>
                {availableTopographers.length > 0 ? (
                  availableTopographers.map((topo, i) => (
                    <button
                      key={`topo-new-${topo.id}-${i}`}
                      onClick={() => handleStartNewChat(topo.id)}
                      className="w-full flex items-center gap-3 p-4 rounded-2xl hover:bg-muted transition-all text-left border border-transparent hover:border-border"
                    >
                      <div className="w-12 h-12 bg-primary/10 rounded-xl overflow-hidden flex items-center justify-center text-primary font-bold border border-primary/20 shrink-0">
                        {topo.avatar ? <img src={topo.avatar} alt={topo.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : topo.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{topo.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{topo.company || 'Cabinet Topographe'}</p>
                      </div>
                      <Send className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  ))
                ) : (
                  <div className="p-8 text-center text-muted-foreground italic">
                    Aucun topographe disponible pour le moment.
                  </div>
                )}
              </div>
              <div className="p-6 bg-muted/30 border-t">
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Sélectionnez un expert pour démarrer une conversation sécurisée. Vos échanges sont archivés et protégés par DataTopoGuard.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
