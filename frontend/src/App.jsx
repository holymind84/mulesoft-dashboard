import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { BarChart2, Layout, Database, ChevronDown, ChevronRight, Globe } from 'lucide-react';
import EnvironmentSelector from './components/shared/EnvironmentSelector';
import General from './pages/General';
import ByApplication from './pages/ByApplication';
import Core from './pages/Core';
import ApiManager from './pages/ApiManager';
import './styles/App.css';

function App() {
  const [isObjectStoreOpen, setIsObjectStoreOpen] = useState(false);
  const [isCoreOpen, setIsCoreOpen] = useState(false);
  const [isApiManagerOpen, setIsApiManagerOpen] = useState(false);
  
  // Environment state
  const [selectedEnv, setSelectedEnv] = useState('');
  const [environments, setEnvironments] = useState([]);

  const fetchEnvironments = useCallback(async () => {
    try {
      // --- MODIFICA CHIAVE QUI ---
      // La chiamata ora usa un percorso relativo che verrà gestito dal proxy di Vite.
      const res = await fetch('/api/environments'); 
      
      if (!res.ok) {
        throw new Error('Errore nel recupero degli ambienti');
      }
      const data = await res.json();
      setEnvironments(data);
    } catch (err) {
      console.error('Error fetching environments:', err);
    }
  }, []);

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  return (
    <Router>
      <div className="App">
        <div className="sidebar">
          <div className="sidebar-header">
            <h1>MuleSoft Stats</h1>
          </div>
          <nav className="nav-menu">
            <div className="nav-link submenu-header" onClick={() => setIsCoreOpen(!isCoreOpen)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Database size={20} />
                <span>Core</span>
              </div>
              {isCoreOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>

            {isCoreOpen && (
              <div className="submenu">
                <NavLink 
                  to="/core" 
                  className={({ isActive }) => 
                    `nav-link submenu-item ${isActive ? 'active' : ''}`
                  }
                >
                  <Layout size={16} />
                  <span>General</span>
                </NavLink>
              </div>
            )}

            <div className="nav-link submenu-header" onClick={() => setIsApiManagerOpen(!isApiManagerOpen)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Globe size={20} />
                <span>API Manager</span>
              </div>
              {isApiManagerOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>

            {isApiManagerOpen && (
              <div className="submenu">
                <NavLink 
                  to="/api-manager" 
                  className={({ isActive }) => 
                    `nav-link submenu-item ${isActive ? 'active' : ''}`
                  }
                >
                  <Globe size={16} />
                  <span>APIs</span>
                </NavLink>
              </div>
            )}

            <div className="nav-link submenu-header" onClick={() => setIsObjectStoreOpen(!isObjectStoreOpen)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Layout size={20} />
                <span>Object Store</span>
              </div>
              {isObjectStoreOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>

            {isObjectStoreOpen && (
              <div className="submenu">
                <NavLink 
                  to="/" 
                  className={({ isActive }) => 
                    `nav-link submenu-item ${isActive ? 'active' : ''}`
                  }
                  end
                >
                  <Layout size={16} />
                  <span>General</span>
                </NavLink>
                <NavLink 
                  to="/by-application" 
                  className={({ isActive }) => 
                    `nav-link submenu-item ${isActive ? 'active' : ''}`
                  }
                >
                  <BarChart2 size={16} />
                  <span>By Application</span>
                </NavLink>
              </div>
            )}
          </nav>
          
          {/* Environment Selector in footer */}
          <div className="sidebar-footer">
            <EnvironmentSelector 
              selectedEnv={selectedEnv}
              environments={environments}
              onEnvironmentChange={setSelectedEnv}
            />
          </div>
        </div>

        <div className="main-content">
          <div className="container">
            <Routes>
              <Route path="/core" element={<Core selectedEnv={selectedEnv} />} />
              <Route path="/" element={<General selectedEnv={selectedEnv} />} />
              <Route path="/by-application" element={<ByApplication selectedEnv={selectedEnv} />} />
              <Route path="/api-manager" element={<ApiManager selectedEnv={selectedEnv} />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;