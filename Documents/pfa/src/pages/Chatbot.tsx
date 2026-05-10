import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  User as UserIcon, 
  Map, 
  Loader2, 
  Paperclip, 
  Mic, 
  Maximize2,
  Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function Chatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Bonjour ! Je suis l'assistant intelligent de DataTopoGuard. Comment puis-je vous aider aujourd'hui avec vos projets topographiques ?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Mock AI response
    setTimeout(() => {
      const responses = [
        "Le projet 'Bouskoura' est actuellement à 65% de progression. Le prochain levé est prévu pour demain.",
        "Bien sûr ! Vous trouverez le devis DV-2026-015 dans la section 'Documents'. Voulez-vous que je l'ouvre ?",
        "Pour exporter vos coordonnées vers AutoCAD, utilisez le bouton 'Encrypt & Upload' dans votre espace topographe.",
        "Vérifiez l'alerte de sécurité : 14 tentatives de connexion échouées détectées au cours des dernières 24 heures."
      ];
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: responses[Math.floor(Math.random() * responses.length)] 
      }]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto bg-card border rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-500">
      {/* Header */}
      <div className="bg-primary p-4 text-primary-foreground flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold leading-tight">TopoAssistant AI</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-medium opacity-80 uppercase tracking-wider">Expert Système Disponible</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMessages([messages[0]])} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Clear Chat">
            <Trash2 className="w-4 h-4" />
          </button>
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 p-6 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-muted"
      >
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div 
              key={`${i}-${msg.role}-${msg.content.substring(0, 20)}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex items-start gap-4",
                msg.role === 'user' ? "flex-row-reverse" : ""
              )}
            >
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md",
                msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-card border text-foreground"
              )}>
                {msg.role === 'user' ? <UserIcon className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div className={cn(
                "max-w-[80%] p-4 rounded-2xl shadow-sm border",
                msg.role === 'user' 
                  ? "bg-primary text-primary-foreground rounded-tr-none" 
                  : "bg-muted/30 text-foreground rounded-tl-none border-border/50"
              )}>
                <div className="markdown-body prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isTyping && (
          <div className="flex items-start gap-4">
            <div className="w-9 h-9 bg-card border rounded-xl flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="bg-muted/30 px-4 py-3 rounded-2xl rounded-tl-none border border-border/50 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-muted/20">
        <div className="relative group">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Posez votre question sur les rapports ou projets..."
            className="w-full bg-card border rounded-2xl py-3 pl-4 pr-32 text-sm focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm resize-none"
            rows={1}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button className="p-2 text-muted-foreground hover:text-primary transition-colors">
              <Paperclip className="w-4 h-4" />
            </button>
            <button className="p-2 text-muted-foreground hover:text-primary transition-colors">
              <Mic className="w-4 h-4" />
            </button>
            <button 
              onClick={handleSend}
              disabled={!input.trim()}
              className="bg-primary text-primary-foreground p-2 rounded-xl hover:opacity-90 disabled:opacity-50 transition-all shadow-md shadow-primary/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-center text-muted-foreground mt-2 font-medium opacity-60">
          TopoAssistant peut faire des erreurs. Vérifiez les informations importantes.
        </p>
      </div>
    </div>
  );
}
