import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Download, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import ExportAllEnvironments from '../components/shared/ExportAllEnvironments';
import '../styles/Core.css';

function Core({ selectedEnv }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: 'asc'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const mapWorkerType = useCallback((type) => {
    const mappings = {
      'MICRO': '0.1',
      'SMALL': '0.2',
      'MEDIUM': '1'
    };
    return mappings[type.toUpperCase()] || type;
  }, []);

  const calculateTotalCore = useCallback((workers, workerType, status) => {
    if (status !== 'STARTED') {
      return 0;
    }
    const mappedType = parseFloat(mapWorkerType(workerType));
    return workers * mappedType;
  }, [mapWorkerType]);

  const calculateTotalUtilization = useCallback(() => {
    return applications.reduce((total, app) => {
      return total + calculateTotalCore(app.workers, app.workerType, app.status);
    }, 0).toFixed(1);
  }, [applications, calculateTotalCore]);

  const handleSort = useCallback((key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });

    const sortedData = [...applications].sort((a, b) => {
      let aValue;
      let bValue;

      switch(key) {
        case 'domain':
        case 'status':
        case 'muleVersion':
          aValue = a[key];
          bValue = b[key];
          break;
        case 'workers':
          aValue = Number(a.workers);
          bValue = Number(b.workers);
          break;
        case 'workerType':
          aValue = parseFloat(mapWorkerType(a.workerType));
          bValue = parseFloat(mapWorkerType(b.workerType));
          break;
        case 'totalCore':
          aValue = calculateTotalCore(a.workers, a.workerType, a.status);
          bValue = calculateTotalCore(b.workers, b.workerType, b.status);
          break;
        case 'staticIps':
          aValue = (a.ipAddresses || []).length;
          bValue = (b.ipAddresses || []).length;
          break;
        default:
          aValue = a[key];
          bValue = b[key];
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setApplications(sortedData);
  }, [applications, sortConfig, mapWorkerType, calculateTotalCore]);

  const exportToExcel = useCallback(() => {
    const exportData = applications.map(app => ({
      'App': app.domain,
      'Status': app.status.toLowerCase(),
      'Workers': app.workers,
      'Worker Type': mapWorkerType(app.workerType),
      'Total Core': calculateTotalCore(app.workers, app.workerType, app.status).toFixed(1),
      'Static IPs': (app.ipAddresses || []).length,
      'Runtime Version': app.muleVersion
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    const colWidths = [
      { wch: 60 }, { wch: 10 }, { wch: 10 },
      { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 15 }
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Applications");
    const fileName = `cloudhub_applications_${selectedEnv || 'unknown'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }, [applications, mapWorkerType, calculateTotalCore, selectedEnv]);

  const fetchApplications = useCallback(async () => {
    if (!selectedEnv) return;
    
    setIsRefreshing(true);
    setError(null);
    
    try {
      const res = await fetch(`http://localhost:5000/api/cloudhub/applications`, {
        headers: {
          'x-anypnt-env-id': selectedEnv
        }
      });
      
      if (!res.ok) {
        throw new Error('Error retrieving applications');
      }

      const data = await res.json();
      setApplications(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching applications:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedEnv]);

  useEffect(() => {
    if (selectedEnv) {
      fetchApplications();
      const interval = setInterval(fetchApplications, 600000);
      return () => clearInterval(interval);
    } else {
      setApplications([]);
      setLastUpdate(null);
    }
  }, [selectedEnv, fetchApplications]);

  const filteredApplications = applications.filter(app =>
    app.domain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderSkeletonTable = () => (
    <div className="skeleton-table">
      <div className="skeleton-header">
        <div className="skeleton-row">
          {[...Array(7)].map((_, i) => (
            <div key={i} className={`skeleton-cell w-${i === 0 ? '40' : '20'}`}></div>
          ))}
        </div>
      </div>
      <div className="skeleton-body">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton-row">
            {[...Array(7)].map((_, j) => (
              <div key={j} className={`skeleton-cell w-${j === 0 ? '40' : '20'}`}></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="header-info">
          {selectedEnv && (
            <>
              <div className="total-utilization">
                <span className="label">Total Core Utilization:</span>
                <span className="total-value">{loading ? '-' : calculateTotalUtilization()}</span>
              </div>
              {lastUpdate && (
                <div className="last-update">
                  Last update: {lastUpdate.toLocaleString('en-US')}
                </div>
              )}
            </>
          )}
        </div>

        <div className="actions-section">
          {selectedEnv && (
            <>
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search application..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              <div className="header-buttons">
                <button 
                  onClick={exportToExcel}
                  className="export-button"
                  disabled={loading || applications.length === 0}
                >
                  <Download size={16} />
                  Export Excel
                </button>
                <ExportAllEnvironments 
                  mapWorkerType={mapWorkerType}
                  calculateTotalCore={calculateTotalCore}
                />
                <button 
                  onClick={fetchApplications}
                  className="refresh-button"
                  disabled={isRefreshing}
                >
                  {isRefreshing ? (
                    <RefreshCw size={16} className="icon-spin" />
                  ) : (
                    <>
                      <RefreshCw size={16} />
                      Refresh
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!selectedEnv ? (
        <div className="welcome-message">
          <h2>Welcome to Core Monitor</h2>
          <p>Select an environment to view applications</p>
        </div>
      ) : loading ? (
        renderSkeletonTable()
      ) : filteredApplications.length > 0 ? (
        <table className="applications-table">
          <thead>
            <tr>
              <th className="column-app sortable" onClick={() => handleSort('domain')}>
                App
              </th>
              <th className="column-status sortable" onClick={() => handleSort('status')}>
                Status
              </th>
              <th className="column-workers sortable" onClick={() => handleSort('workers')}>
                Workers
              </th>
              <th className="column-workertype sortable" onClick={() => handleSort('workerType')}>
                Worker Type
              </th>
              <th className="column-total sortable" onClick={() => handleSort('totalCore')}>
                Total Core
              </th>
              <th className="column-staticips sortable" onClick={() => handleSort('staticIps')}>
                Static IPs
              </th>
              <th className="column-runtime sortable" onClick={() => handleSort('muleVersion')}>
                Runtime Version
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredApplications.map((app) => (
              <tr key={app.domain} className="application-row">
                <td className="column-app">{app.domain}</td>
                <td className="column-status">
                  {app.status === 'STARTED' ? (
                    <div className="status">
                      <CheckCircle className="icon-started" size={18} />
                      <span className="status-started">Started</span>
                    </div>
                  ) : (
                    <div className="status">
                      <XCircle className="icon-stopped" size={18} />
                      <span className="status-stopped">
                        {app.status === 'UNDEPLOYED' ? 'Undeployed' : 'Stopped'}
                      </span>
                    </div>
                  )}
                </td>
                <td className="column-workers">{app.workers}</td>
                <td className="column-workertype">{mapWorkerType(app.workerType)}</td>
                <td className={app.status === 'STARTED' ? 'total-active' : 'total-inactive'}>
                  {calculateTotalCore(app.workers, app.workerType, app.status).toFixed(1)}
                </td>
                <td className="column-staticips">{(app.ipAddresses || []).length}</td>
                <td className="column-runtime">{app.muleVersion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="no-data">No applications found</div>
      )}
    </div>
  );
}

export default Core;