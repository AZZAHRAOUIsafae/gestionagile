import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProjectDocument, Project, User } from '../types';

export const pdfService = {
  async generateFinancePDF(doc: ProjectDocument, project: Project, topographer: User, client: User) {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.width;

    // Header - Company Info (Topographer)
    pdf.setFontSize(20);
    pdf.setTextColor(40, 60, 150);
    pdf.text(topographer.company || topographer.name, 20, 25);
    
    pdf.setFontSize(10);
    pdf.setTextColor(100);
    pdf.text(topographer.address || 'Adresse non spécifiée', 20, 32);
    pdf.text(`Tel: ${topographer.phone || 'N/A'} | Email: ${topographer.email}`, 20, 37);

    // Document Type & Number
    pdf.setFontSize(22);
    pdf.setTextColor(0);
    const typeLabel = doc.type === 'QUOTE' ? 'DEVIS' : doc.type === 'INVOICE' ? 'FACTURE' : 'BON DE COMMANDE';
    pdf.text(typeLabel, pageWidth - 20, 25, { align: 'right' });
    
    pdf.setFontSize(10);
    pdf.text(`N°: ${doc.id.substring(0, 8).toUpperCase()}`, pageWidth - 20, 32, { align: 'right' });
    pdf.text(`Date: ${new Date(doc.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString()}`, pageWidth - 20, 37, { align: 'right' });

    // Client Info
    pdf.setFillColor(245, 245, 250);
    pdf.rect(20, 50, pageWidth - 40, 35, 'F');
    pdf.setFontSize(11);
    pdf.setTextColor(50);
    pdf.text('DESTINATAIRE:', 25, 60);
    pdf.setFontSize(12);
    pdf.setTextColor(0);
    pdf.text(client.name, 25, 67);
    pdf.setFontSize(10);
    pdf.setTextColor(100);
    pdf.text(client.address || 'Adresse client', 25, 73);
    pdf.text(`Projet: ${project.name}`, 25, 79);

    // Table
    const tableData = [
      [doc.name, '1', `${doc.amount?.ht.toLocaleString()} DH`, `${doc.amount?.ht.toLocaleString()} DH`]
    ];

    autoTable(pdf, {
      startY: 95,
      head: [['Désignation', 'Qté', 'Prix Unitaire HT', 'Total HT']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [40, 60, 150] },
      styles: { fontSize: 10, cellPadding: 5 }
    });

    // Totals
    const finalY = (pdf as any).lastAutoTable.finalY + 10;
    const totalsX = pageWidth - 80;

    pdf.setFontSize(10);
    pdf.text('Total HT:', totalsX, finalY);
    pdf.text(`${doc.amount?.ht.toLocaleString()} DH`, pageWidth - 20, finalY, { align: 'right' });

    pdf.text('TVA (20%):', totalsX, finalY + 7);
    pdf.text(`${(doc.amount!.ht * 0.2).toLocaleString()} DH`, pageWidth - 20, finalY + 7, { align: 'right' });

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TOTAL TTC:', totalsX, finalY + 16);
    pdf.text(`${doc.amount?.ttc.toLocaleString()} DH`, pageWidth - 20, finalY + 16, { align: 'right' });

    if (doc.amount?.acompte) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 150, 0);
      pdf.text('Acompte versé:', totalsX, finalY + 23);
      pdf.text(`-${doc.amount.acompte.toLocaleString()} DH`, pageWidth - 20, finalY + 23, { align: 'right' });

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(200, 0, 0);
      pdf.text('NET À PAYER:', totalsX, finalY + 32);
      pdf.text(`${doc.amount.reste?.toLocaleString()} DH`, pageWidth - 20, finalY + 32, { align: 'right' });
    }

    // Signatures
    const sigY = finalY + 50;
    pdf.setFontSize(10);
    pdf.setTextColor(100);
    pdf.text('Signature Topographe', 20, sigY);
    pdf.text('Signature Client', pageWidth - 70, sigY);

    if (doc.signatureBase64) {
      try {
        pdf.addImage(doc.signatureBase64, 'PNG', pageWidth - 75, sigY + 5, 50, 20);
        pdf.setFontSize(8);
        pdf.text(`Signé le: ${new Date(doc.signatureDate?.seconds * 1000 || Date.now()).toLocaleString()}`, pageWidth - 70, sigY + 30);
      } catch (e) {
        console.error('Pdf image error', e);
      }
    }

    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text('Document généré par TopoCloud - Plateforme de gestion topographique', pageWidth / 2, pageWidth === 210 ? 285 : 280, { align: 'center' });

    pdf.save(`${doc.type}_${doc.id.substring(0,8)}.pdf`);
  }
};
