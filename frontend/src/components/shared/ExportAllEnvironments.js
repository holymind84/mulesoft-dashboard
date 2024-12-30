import React, { useState, useCallback, useEffect } from 'react';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const ExportAllEnvironments = ({ mapWorkerType, calculateTotalCore }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [environments, setEnvironments] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEnvironments = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/environments');
        if (!res.ok) {
          throw new Error('Errore nel recupero degli ambienti');
        }
        const data = await res.json();
        setEnvironments(data);
      } catch (err) {
        console.error('Error fetching environments:', err);
        setError(err.message);
      }
    };

    fetchEnvironments();
  }, []);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);
    
    try {
      const wb = XLSX.utils.book_new();
      
      for (const env of environments) {
        try {
          const res = await fetch(`http://localhost:5000/api/cloudhub/applications`, {
            headers: {
              'x-anypnt-env-id': env.envId
            }
          });
          
          if (!res.ok) {
            throw new Error(`Errore nel recupero delle applicazioni per l'ambiente ${env.label}`);
          }

          const data = await res.json();
          
          const exportData = data.map(app => ({
            'App': app.domain,
            'Status': app.status.toLowerCase(),
            'Workers': app.workers,
            'Size': mapWorkerType(app.workerType),
            'Total Core': calculateTotalCore(app.workers, app.workerType, app.status).toFixed(1).replace('.', ','),
            'Static IPs': (app.ipAddresses || []).length,
            'Runtime Version': app.muleVersion
          }));

          const ws = XLSX.utils.json_to_sheet(exportData);
          
          const colWidths = [
            { wch: 60 }, // App
            { wch: 10 }, // Status
            { wch: 10 }, // Workers
            { wch: 12 }, // Worker Type
            { wch: 12 }, // Total Core
            { wch: 12 }, // Static IPs
            { wch: 15 }  // Runtime Version
          ];
          ws['!cols'] = colWidths;

          XLSX.utils.book_append_sheet(wb, ws, env.label);
          
        } catch (err) {
          console.error(`Errore durante l'export dell'ambiente ${env.label}:`, err);
          // Crea un worksheet con il messaggio di errore per questo ambiente
          const ws = XLSX.utils.aoa_to_sheet([
            ['Errore nel recupero dei dati'],
            [`Dettaglio errore: ${err.message}`]
          ]);
          XLSX.utils.book_append_sheet(wb, ws, env.label);
        }
      }

      const fileName = `cloudhub_applications_all_environments_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

    } catch (err) {
      console.error('Errore durante l\'export di tutti gli ambienti:', err);
      setError('Errore durante l\'export di tutti gli ambienti');
    } finally {
      setIsExporting(false);
    }
  }, [environments, mapWorkerType, calculateTotalCore]);

  return (
    <button 
      onClick={handleExport}
      className="export-all-button"
      disabled={isExporting || environments.length === 0}
      title={error ? `Errore: ${error}` : 'Esporta dati di tutti gli ambienti'}
    >
      {isExporting ? (
        <>Esportazione in corso...</>
      ) : (
        <>
          <Download size={16} />
          Export All Environments
        </>
      )}
    </button>
  );
};

export default ExportAllEnvironments;