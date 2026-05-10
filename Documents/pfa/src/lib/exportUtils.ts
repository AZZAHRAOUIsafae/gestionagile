import { User, Project, Notification, ProjectDocument } from '../types';

export const exportToCSV = (data: any[], filename: string, metadataTitle: string, adminEmail: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(obj => 
    Object.values(obj).map(val => {
      const stringVal = String(val);
      if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
        return `"${stringVal.replace(/"/g, '""')}"`;
      }
      return stringVal;
    }).join(',')
  ).join('\n');
  
  const metadata = `Export Système Smart Cabinet - ${metadataTitle}\nEffectué le : ${new Date().toLocaleString()} par ${adminEmail}\nTotal des enregistrements : ${data.length}\n\n`;
  const csvContent = "\uFEFF" + metadata + headers + '\n' + rows;
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportToJSON = (data: any[], filename: string, adminEmail: string) => {
  const blob = new Blob([JSON.stringify({ 
    metadata: { 
      exportedAt: new Date().toISOString(), 
      exportedBy: adminEmail, 
      total: data.length 
    },
    data: data 
  }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
