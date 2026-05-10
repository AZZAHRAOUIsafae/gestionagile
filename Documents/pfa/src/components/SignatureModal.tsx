import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { motion, AnimatePresence } from 'motion/react';
import { Search as X, Save, Eraser, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signatureDataUrl: string) => void;
  title?: string;
}

export default function SignatureModal({ isOpen, onClose, onSave, title = "Signature Électronique" }: SignatureModalProps) {
  const sigPad = useRef<SignatureCanvas>(null);

  const clear = () => {
    sigPad.current?.clear();
  };

  const save = () => {
    if (sigPad.current?.isEmpty()) {
      alert("Veuillez signer avant de valider.");
      return;
    }
    const dataUrl = sigPad.current?.getTrimmedCanvas().toDataURL('image/png');
    if (dataUrl) {
      onSave(dataUrl);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-lg bg-card border rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg tracking-tight">{title}</h3>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest leading-none">Validation Officielle</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-muted rounded-xl transition-all"
              >
                <X className="w-5 h-5 rotate-45" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-white border-2 border-dashed rounded-2xl overflow-hidden shadow-inner group relative">
                <SignatureCanvas 
                  ref={sigPad}
                  penColor='black'
                  canvasProps={{
                    className: "w-full h-64 cursor-crosshair",
                    style: { width: '100%', height: '256px' }
                  }}
                />
                <div className="absolute bottom-4 left-4 pointer-events-none opacity-20 group-hover:opacity-10 transition-opacity">
                  <p className="text-xs font-bold italic">Signez ici</p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  En apposant votre signature, vous certifiez l'exactitude des informations et donnez votre accord pour le traitement de ce document via <span className="font-bold text-primary">DataTopoGuard Security</span>.
                </p>

                <div className="flex gap-3">
                  <button 
                    onClick={clear}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-4 border rounded-2xl text-sm font-bold hover:bg-muted transition-all active:scale-95"
                  >
                    <Eraser className="w-4 h-4" />
                    Effacer
                  </button>
                  <button 
                    onClick={save}
                    className="flex-[2] flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    Valider la signature
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted/50 border-t flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Chiffrement AES-256 Actif</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
