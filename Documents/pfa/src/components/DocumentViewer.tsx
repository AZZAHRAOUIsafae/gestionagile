import React, { useState, useRef } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Share2, 
  CheckCircle2, 
  Clock,
  X,
  ShieldCheck,
  PenTool,
  Loader2,
  Trash2,
  CreditCard
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { cn } from '../lib/utils';
import { ProjectDocument, User, Project } from '../types';
import { dbService } from '../services/db';
import { pdfService } from '../services/pdfService';
import { auth } from '../lib/firebase';

interface DocumentViewerProps {
  document: ProjectDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onSign?: (docId: string, signature: string) => void;
  onPay?: (doc: ProjectDocument) => void;
}

export default function DocumentViewer({ document: doc, isOpen, onClose, onSign, onPay }: DocumentViewerProps) {
  const [isSigning, setIsSigning] = useState(false);
  const [isSubmittingSig, setIsSubmittingSig] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);

  if (!isOpen || !doc) return null;

  const type = doc.type;
  const isFinancialDoc = ['INVOICE', 'QUOTE', 'ORDER'].includes(type);

  const clearSignature = () => sigCanvas.current?.clear();

  const handleSaveSignature = async () => {
    if (sigCanvas.current?.isEmpty()) {
      alert('Veuillez signer avant de valider.');
      return;
    }

    const signature = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
    if (signature && onSign) {
      setIsSubmittingSig(true);
      try {
        await onSign(doc.id, signature);
        setIsSigning(false);
      } finally {
        setIsSubmittingSig(false);
      }
    }
  };

  const handleGeneratePDF = async () => {
    setIsGeneratingPdf(true);
    try {
      // Fetch required data for PDF
      const topographer = await dbService.getUser(doc.topographerId || '');
      const client = await dbService.getUser(doc.clientId || '');
      // In a real app we'd fetch the project too, but let's mock the project info if not available
      const projects = await dbService.getProjects('CLIENT', doc.clientId || '');
      const project = projects.find(p => p.id === doc.projectId) || { name: doc.name } as Project;

      if (topographer && client) {
        await pdfService.generateFinancePDF(doc, project, topographer, client);
      } else {
        alert('Erreur lors de la récupération des informations du document.');
      }
    } catch (error) {
      console.error('PDF error:', error);
      alert('La génération du PDF a échoué.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white text-black w-full max-w-4xl max-h-[90vh] overflow-auto rounded-xl shadow-2xl flex flex-col">
        {/* Toolbar */}
        <div className="bg-zinc-900 text-white p-4 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-400" />
            <span className="font-bold tracking-tight uppercase">
              {type} - {doc.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-white/10 rounded-lg"><Printer className="w-4 h-4" /></button>
            <button 
              onClick={handleGeneratePDF}
              disabled={isGeneratingPdf}
              className="p-2 hover:bg-white/10 rounded-lg flex items-center gap-2"
            >
              {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            </button>
            {isFinancialDoc && !doc.isSigned && onSign && auth.currentUser?.uid === doc.clientId && (
              <button 
                onClick={() => setIsSigning(true)}
                className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg font-bold text-xs hover:opacity-90 transition-all mx-2"
              >
                <PenTool className="w-3 h-3" />
                Signer ce document
              </button>
            )}
            {type === 'INVOICE' && !doc.isSigned && onPay && auth.currentUser?.uid === doc.clientId && (
              <button 
                onClick={() => onPay(doc)}
                className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-xs hover:bg-emerald-500 transition-all mx-1"
              >
                <CreditCard className="w-3 h-3" />
                Payer maintenant
              </button>
            )}
            <div className="w-px h-6 bg-white/20 mx-2" />
            <button onClick={onClose} className="p-1 hover:bg-red-500 rounded-lg transition-colors"><X className="w-6 h-6" /></button>
          </div>
        </div>

        {/* Document Body */}
        <div className="p-8 md:p-16 flex-1 bg-white relative">
          
          {/* Signature Modal */}
          {isSigning && (
            <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex items-center justify-center p-8">
              <div className="w-full max-w-md bg-white border border-muted rounded-3xl p-8 shadow-2xl space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-bold mb-1">Signature Électronique</h3>
                  <p className="text-xs text-muted-foreground">Signez à l'aide de votre souris ou écran tactile</p>
                </div>
                
                <div className="border border-muted rounded-2xl bg-zinc-50 overflow-hidden cursor-crosshair">
                  <SignatureCanvas 
                    ref={sigCanvas}
                    penColor="navy"
                    canvasProps={{width: 400, height: 200, className: 'sigCanvas w-full h-[200px]'}} 
                  />
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={clearSignature}
                    className="flex-1 px-4 py-3 border rounded-xl flex items-center justify-center gap-2 hover:bg-muted transition-all"
                  >
                    <Trash2 className="w-4 h-4" /> Effacer
                  </button>
                  <button 
                    onClick={() => setIsSigning(false)}
                    className="flex-1 px-4 py-3 border rounded-xl hover:bg-muted transition-all"
                  >
                    Annuler
                  </button>
                </div>

                <button 
                  onClick={handleSaveSignature}
                  disabled={isSubmittingSig}
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
                >
                  {isSubmittingSig ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                  Valider la signature
                </button>
              </div>
            </div>
          )}

          {!isFinancialDoc ? (
            <div className="max-w-[800px] mx-auto text-center space-y-6">
              <div className="w-32 h-32 bg-muted rounded-2xl mx-auto flex items-center justify-center">
                <FileText className="w-16 h-16 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-bold">Aperçu du document</h2>
              <p className="text-muted-foreground">Type: {type} • Taille: {doc.size}</p>
              
              {doc.isSigned && (
                <div className="p-6 bg-green-50 border border-green-100 rounded-2xl max-w-sm mx-auto flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-green-900">Signé Électroniquement</p>
                    <p className="text-[10px] text-green-700">Le {doc.signatureDate ? new Date(doc.signatureDate).toLocaleDateString('fr-FR') : 'Date inconnue'}</p>
                  </div>
                </div>
              )}

              <button className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold inline-flex items-center gap-2 shadow-lg hover:opacity-90">
                <Download className="w-5 h-5" />
                Télécharger le fichier
              </button>
            </div>
          ) : (
            <div className="max-w-[800px] mx-auto font-sans">
              
              {/* Header */}
              <div className="flex justify-between items-start mb-16">
                <div>
                  <h1 className="text-4xl font-black text-blue-600 mb-2">DATATOPOGUARD</h1>
                   <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Cabinet de Topographie Certifié</p>
                  <div className="mt-8 text-sm space-y-1">
                    <p className="font-bold">Cabinet Topo Atlas - Casablanca</p>
                    <p>123 Avenue des FAR, Sidi Maârouf</p>
                    <p>Casablanca, Maroc</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-block px-4 py-1 bg-blue-600 text-white font-bold text-xs rounded mb-4">
                    {type === 'INVOICE' ? 'FACTURE' : type === 'QUOTE' ? 'DEVIS' : 'BON DE COMMANDE'}
                  </div>
                  <h2 className="text-2xl font-bold uppercase tracking-tighter">
                    {type.substring(0, 3)}-{doc.id.substring(0, 8).toUpperCase()}
                  </h2>
                  <p className="text-sm text-zinc-500 mt-1">Date: {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('fr-FR') : 'En cours'}</p>
                </div>
              </div>

            {/* Client Info */}
            <div className="grid grid-cols-2 gap-12 mb-16 pb-8 border-b">
              <div>
                <h3 className="text-xs font-bold uppercase text-zinc-400 mb-3 tracking-widest">Destinataire</h3>
                <p className="text-lg font-bold">Client ID: {doc.clientId}</p>
                <p className="text-sm">Projet ID: {doc.projectId}</p>
              </div>
              <div className="text-right">
                <h3 className="text-xs font-bold uppercase text-zinc-400 mb-3 tracking-widest">Détails Projet</h3>
                <p className="font-bold">{doc.name}</p>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full mb-16 text-sm">
              <thead className="bg-zinc-100 uppercase text-[10px] font-black tracking-widest text-zinc-600">
                <tr>
                  <th className="px-4 py-3 text-left">Désignation</th>
                  <th className="px-4 py-3 text-right">PU (DH)</th>
                  <th className="px-4 py-3 text-right">Total (DH)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 border-b border-zinc-200">
                <tr>
                   <td className="px-4 py-4 font-bold">{doc.name}</td>
                   <td className="px-4 py-4 text-right">{(doc.amount?.ht || 0).toLocaleString('fr-FR')}</td>
                   <td className="px-4 py-4 text-right font-bold">{(doc.amount?.ht || 0).toLocaleString('fr-FR')}</td>
                </tr>
              </tbody>
            </table>

            {/* Summary */}
            <div className="flex justify-end">
              <div className="w-full max-w-[300px] space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Sous-total HT</span>
                  <span className="font-bold">{(doc.amount?.ht || 0).toLocaleString('fr-FR')} DH</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">TVA (20%)</span>
                  <span className="font-bold">{( (doc.amount?.ht || 0) * 0.2 ).toLocaleString('fr-FR')} DH</span>
                </div>
                <div className="flex justify-between items-center py-4 border-y-2 border-zinc-900">
                  <span className="font-black uppercase text-xs tracking-[0.2em]">Total TTC</span>
                  <span className="text-2xl font-black text-blue-600">{(doc.amount?.ttc || 0).toLocaleString('fr-FR')} DH</span>
                </div>
                {doc.amount?.acompte && (
                  <>
                    <div className="flex justify-between items-center text-sm pt-2">
                      <span className="text-emerald-600 font-bold uppercase text-[10px] tracking-widest">Acompte versé</span>
                      <span className="font-bold text-emerald-600">-{doc.amount.acompte.toLocaleString('fr-FR')} DH</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-amber-600 font-bold uppercase text-[10px] tracking-widest">Reste à payer</span>
                      <span className="font-black text-amber-600">{((doc.amount.reste || 0)).toLocaleString('fr-FR')} DH</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Signature Area */}
            <div className="mt-20 pt-8 border-t border-dashed">
              <div className="flex justify-between items-start">
                <div className="text-center space-y-2">
                   <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Cachet Cabinet</p>
                   <div className="w-48 h-32 bg-zinc-50 border border-zinc-100 rounded flex items-center justify-center opacity-30 grayscale">
                      <div className="border-4 border-blue-900/20 rounded-full w-24 h-24 flex items-center justify-center text-[10px] font-black text-blue-900 p-2 text-center rotate-[-15deg]">
                        CERTIFIÉ TOPOGUARD
                      </div>
                   </div>
                </div>

                <div className="text-center space-y-2">
                   <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Signature Client</p>
                   {doc.isSigned ? (
                     <div className="w-48 h-32 bg-blue-50/50 border border-blue-100 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0,transparent_100%)]" />
                        {doc.signatureBase64 ? (
                          <img src={doc.signatureBase64} alt="Signature" className="w-full h-full object-contain relative z-10 p-2" referrerPolicy="no-referrer" />
                        ) : doc.signatureUrl ? (
                          <img src={doc.signatureUrl} alt="Signature" className="w-full h-full object-contain relative z-10 p-2" referrerPolicy="no-referrer" />
                        ) : (
                          <>
                            <ShieldCheck className="w-8 h-8 text-blue-600 mb-2" />
                            <p className="text-[10px] font-bold text-blue-900">DOCUMENT SIGNÉ</p>
                          </>
                        )}
                        <p className="absolute bottom-2 left-2 text-[6px] text-blue-700/60 font-mono uppercase tracking-tighter z-20">ID: {doc.signedBy?.substring(0,8)}</p>
                        <div className="absolute bottom-1 right-1 w-8 h-8 opacity-20 rotate-[-12deg]">
                          <CheckCircle2 className="w-full h-full text-blue-600" />
                        </div>
                     </div>
                   ) : (
                     <div className="w-48 h-32 border border-dashed rounded-2xl flex items-center justify-center">
                        <p className="text-[10px] text-zinc-300 font-bold italic">En attente de signature</p>
                     </div>
                   )}
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
               <p className="text-[9px] text-zinc-400 leading-relaxed italic">
                 Ce document est généré électroniquement et possède une valeur juridique de preuve sous réserve de validation par le Cabinet Topographique Atlas.
                 <br />DataTopoGuard Security Platform © 2026
               </p>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
