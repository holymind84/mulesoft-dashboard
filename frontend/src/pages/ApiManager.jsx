import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Download, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import '../styles/ApiManager.css';

function ApiManager({ selectedEnv }) {
  const [apis, setApis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: 'asc'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSort = useCallback((key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });

    const sortedData = [...apis].sort((a, b) => {
      let aValue = a[key];
      let bValue = b[key];

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setApis(sortedData);
  }, [apis, sortConfig]);

  const exportToExcel = useCallback(() => {
    const exportData = apis.map(api => ({
      'API Name': api.name,
      'Version': api.version,
      'Status': api.status,
      'Type': api.type,
      'Created Date': new Date(api.createdDate).toLocaleDateString(),
      'Instance': api.instance || '',
      'Active Contracts': api.activeContractsCount
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    const colWidths = [
      { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 20 }, { wch: 20 }, { wch: 15 }
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "APIs");
    const fileName = `api_manager_${selectedEnv || 'unknown'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }, [apis, selectedEnv]);

  const fetchApis = useCallback(async () => {
    if (!selectedEnv) return;
    
    setLoading(true);
    setIsRefreshing(true);
    setError(null);
    
    try {
      const res = await fetch(`http://localhost:5000/api/apimanager`, {
        headers: {
          'x-anypnt-env-id': selectedEnv
        }
      });
      
      if (!res.ok) throw new Error('Error retrieving APIs');

      const data = await res.json();
      setApis(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching APIs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedEnv]);

  useEffect(() => {
    if (selectedEnv) {
      fetchApis();
      const interval = setInterval(fetchApis, 600000); // Refresh every 10 minutes
      return () => clearInterval(interval);
    } else {
      setApis([]);
      setLastUpdate(null);
    }
  }, [selectedEnv, fetchApis]);

  const filteredApis = apis.filter(api =>
    api.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate statistics for each status
  const getStatusStats = useCallback(() => {
    if (!apis.length) return {};

    return apis.reduce((acc, api) => {
      const status = api.status || 'Unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
  }, [apis]);

  const statusStats = getStatusStats();

  const renderSkeletonTable = () => (
    <div className="skeleton-table">
      <div className="skeleton-header">
        <div className="skeleton-row">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`skeleton-cell w-${i === 0 ? '40' : '20'}`}></div>
          ))}
        </div>
      </div>
      <div className="skeleton-body">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton-row">
            {[...Array(6)].map((_, j) => (
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
              <div className="total-apis">
                <span className="label">Total APIs:</span>
                <span className="total-value">{loading ? '-' : apis.length}</span>
              </div>

              {!loading && Object.keys(statusStats).length > 0 && (
                <div className="status-stats">
                  <span className="label">By Status:</span>
                  <div className="status-counts">
                    {Object.entries(statusStats).map(([status, count]) => (
                      <div key={status} className="status-count">
                        <span className={`status-indicator status-${status.toLowerCase()}`}>
                          {status.toLowerCase() === 'active' ? '●' : '○'}
                        </span>
                        <span className="status-name">{status}:</span>
                        <span className="status-value">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                  placeholder="Search API..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              <div className="header-buttons">
                <button 
                  onClick={exportToExcel}
                  className="export-button"
                  disabled={loading || apis.length === 0}
                >
                  <Download size={16} />
                  Export Excel
                </button>
                <button 
                  onClick={fetchApis}
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
          <h2>Welcome to API Manager</h2>
          <p>Select an environment to view APIs</p>
        </div>
      ) : loading ? (
        renderSkeletonTable()
      ) : filteredApis.length > 0 ? (
        <table className="apis-table">
          <thead>
            <tr>
              <th className="column-name sortable" onClick={() => handleSort('name')}>API Name</th>
              <th className="column-version sortable" onClick={() => handleSort('version')}>Version</th>
              <th className="column-status sortable" onClick={() => handleSort('status')}>Status</th>
              <th className="column-type sortable" onClick={() => handleSort('type')}>Type</th>
              <th className="column-created sortable" onClick={() => handleSort('createdDate')}>Created Date</th>
              <th className="column-instance sortable" onClick={() => handleSort('instance')}>Instance</th>
              <th className="column-contracts sortable" onClick={() => handleSort('activeContractsCount')}>Active Contracts</th>
            </tr>
          </thead>
          <tbody>
            {filteredApis.map((api) => (
              <tr key={`${api.id}-${api.name}-${api.version}-${api.instance}`} className="api-row">
                <td className="column-name">{api.name}</td>
                <td className="column-version">{api.version}</td>
                <td className="column-status">
                  {api.status && api.status.toLowerCase() === 'active' ? (
                    <div className="status">
                      <CheckCircle className="icon-active" size={18} />
                      <span className="status-active">{api.status}</span>
                    </div>
                  ) : (
                    <div className="status">
                      <XCircle className="icon-inactive" size={18} />
                      <span className="status-inactive">{api.status}</span>
                    </div>
                  )}
                </td>
                <td className="column-type">{api.type}</td>
                <td className="column-created">{new Date(api.createdDate).toLocaleDateString()}</td>
                <td className="column-instance">{api.instance || ''}</td>
                <td className="column-contracts">{api.activeContractsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="no-data">No APIs found</div>
      )}
    </div>
  );
}

export default ApiManager;