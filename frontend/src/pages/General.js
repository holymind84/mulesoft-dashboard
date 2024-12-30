import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../styles/General.css';

function General({ selectedEnv }) {
  const getDefaultDates = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 5);
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  };

  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenError,setTokenError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [statsForm, setStatsForm] = useState({
    startDate: getDefaultDates().startDate,
    endDate: getDefaultDates().endDate,
    period: '1month'
  });
  
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);

  const fetchTokenStatus = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/token/status');
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Error retrieving token');
      }

      setIsAuthenticated(true);
      setTokenError(null);
    } catch (err) {
      setTokenError(err.message);
      setIsAuthenticated(false);
    } finally {
      setTokenLoading(false);
    }
  };

  const formatChartData = (data) => {
    if (!data || !Array.isArray(data)) return [];
    
    return data.map(item => ({
      time: new Date(item.timeStamp).toLocaleString('en-US', { 
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
      }),
      timeStamp: item.timeStamp,
      requests: item.objectStoreRequestCount
    }));
  };

  const formatNumber = (number) => {
    return new Intl.NumberFormat('en-US').format(number);
  };

  const handleStatsInputChange = (e) => {
    const { name, value } = e.target;
    setStatsForm(prevForm => ({
      ...prevForm,
      [name]: value
    }));
  };

  const handleStatsSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEnv) {
      setStatsError('Select an environment to view statistics');
      return;
    }

    setStatsLoading(true);
    setStatsError(null);

    try {
      const res = await fetch('http://localhost:5000/api/stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-anypnt-env-id': selectedEnv
        },
        body: JSON.stringify(statsForm)
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error?.message || 'Error retrieving statistics');
      }

      setStatsData(data);
    } catch (err) {
      setStatsError(err.message);
    } finally {
      setStatsLoading(false);
    }
  };

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    const today = new Date().toISOString().split('T')[0];
    const dotDate = new Date(payload.timeStamp).toISOString().split('T')[0];
    
    if (dotDate === today) {
      return <circle cx={cx} cy={cy} r={4} fill="red" />;
    }
    return <circle cx={cx} cy={cy} r={4} fill="#8884d8" />;
  };

  useEffect(() => {
    fetchTokenStatus();
    const interval = setInterval(fetchTokenStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Reset stats when environment changes
    setStatsData(null);
    setStatsError(null);
  }, [selectedEnv]);

  if (tokenLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page-content">
      {!selectedEnv ? (
        <div className="welcome-message">
          <h2>Welcome to Object Store Statistics</h2>
          <p>Select an environment to view statistics</p>
        </div>
      ) : (
        <>
          <h2>General Statistics</h2>
          <form onSubmit={handleStatsSubmit}>
            <div className="form-group">
              <label>Start Date:</label>
              <input
                type="date"
                name="startDate"
                value={statsForm.startDate}
                onChange={handleStatsInputChange}
                required
                max={statsForm.endDate || undefined}
              />
            </div>

            <div className="form-group">
              <label>End Date:</label>
              <input
                type="date"
                name="endDate"
                value={statsForm.endDate}
                onChange={handleStatsInputChange}
                required
                min={statsForm.startDate || undefined}
              />
            </div>

            <div className="form-group">
              <label>Period:</label>
              <select
                name="period"
                value={statsForm.period}
                onChange={handleStatsInputChange}
                required
              >
                <option value="1hour">1 Hour</option>
                <option value="1day">1 Day</option>
                <option value="1month">1 Month</option>
              </select>
            </div>

            <button 
              type="submit" 
              disabled={statsLoading || !isAuthenticated}
              className="submit-button"
            >
              {statsLoading ? 'Loading...' : 'View Statistics'}
            </button>
          </form>

          {statsError && (
            <div className="error">
              <strong>Error:</strong> {statsError}
            </div>
          )}

          {statsData && (
            <div className="stats-result">
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart
                    data={formatChartData(statsData)}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 50
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time"
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      tickFormatter={formatNumber}
                      label={{ 
                        value: 'Number of Requests', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle' }
                      }}
                    />
                    <Tooltip 
                      formatter={(value) => formatNumber(value)}
                      labelFormatter={(label) => `Time: ${label}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="requests"
                      name="Requests"
                      stroke="#8884d8"
                      strokeWidth={2}
                      dot={<CustomDot />}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default General;