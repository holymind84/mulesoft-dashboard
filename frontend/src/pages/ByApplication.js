import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../styles/ByApplication.css';

function ByApplication({ selectedEnv }) {
 const [tokenLoading, setTokenLoading] = useState(true);
 const [tokenError,setTokenError] = useState(null);
 const [isAuthenticated, setIsAuthenticated] = useState(false);
 const [availableStores, setAvailableStores] = useState([]);
 const [selectedStore, setSelectedStore] = useState('');
 const [selectedRegion, setSelectedRegion] = useState('');
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [storeData, setStoreData] = useState(null);
 const [allStoresData, setAllStoresData] = useState({});
 const [sortConfig, setSortConfig] = useState({ key: '', direction: '' });

 const getDefaultDates = () => {
   const endDate = new Date();
   const startDate = new Date();
   startDate.setMonth(startDate.getMonth() - 1);
   return {
     startDate: startDate.toISOString().split('T')[0],
     endDate: endDate.toISOString().split('T')[0]
   };
 };

 const [statsForm, setStatsForm] = useState({
   startDate: getDefaultDates().startDate,
   endDate: getDefaultDates().endDate,
   period: '1month'
 });

 const fetchTokenStatus = async () => {
   try {
     const res = await fetch('http://localhost:5000/api/token/status');
     const data = await res.json();
     if (!res.ok) throw new Error(data.error || 'Error retrieving token');
     setIsAuthenticated(true);
     setTokenError(null);
   } catch (err) {
     setTokenError(err.message);
     setIsAuthenticated(false);
   } finally {
     setTokenLoading(false);
   }
 };

 const fetchAllStoresData = async () => {
   if (!availableStores.length || !selectedEnv) return;
   setLoading(true);
   const newStoresData = {};
   
   try {
     const promises = availableStores.map(store => 
       fetch(
         `http://localhost:5000/api/objectstore/${store.name}?startDate=${statsForm.startDate}&endDate=${statsForm.endDate}&period=${statsForm.period}`,
         {
           headers: {
             'x-anypnt-env-id': selectedEnv,
             'x-anypnt-region': store.region
           }
         }
       )
         .then(res => res.json())
         .then(data => ({ store: store.name, data }))
     );
     
     const results = await Promise.all(promises);
     results.forEach(({ store, data }) => {
       newStoresData[store] = data;
     });
     
     setAllStoresData(newStoresData);
   } catch (err) {
     setError(err.message);
   } finally {
     setLoading(false);
   }
 };

 useEffect(() => {
   const initializeData = async () => {
     if (!selectedEnv) {
       setAvailableStores([]);
       return;
     }

     try {
       const { startDate, endDate } = getDefaultDates();
       const response = await fetch(
         `http://localhost:5000/api/objectstore?startDate=${startDate}&endDate=${endDate}&period=1month`,
         {
           headers: {
             'x-anypnt-env-id': selectedEnv
           }
         }
       );
       if (!response.ok) throw new Error('Error retrieving stores');
       const data = await response.json();
       setAvailableStores(data || []);
       setLoading(false);
     } catch (err) {
       setError(err.message);
       setLoading(false);
     }
   };

   initializeData();
   fetchTokenStatus();
   const interval = setInterval(fetchTokenStatus, 600000);
   return () => clearInterval(interval);
 }, [selectedEnv]);

 useEffect(() => {
   setSelectedStore('');
   setSelectedRegion('');
   setStoreData(null);
   setAllStoresData({});
 }, [selectedEnv]);

 const handleStatsInputChange = (e) => {
   const { name, value } = e.target;
   setStatsForm(prevForm => ({
     ...prevForm,
     [name]: value
   }));
 };

 const handleStoreSelect = (e) => {
   const [store, region] = e.target.value.split('|');
   setSelectedStore(store);
   setSelectedRegion(region);
 };

 const handleSubmit = async (e) => {
   e.preventDefault();
   if (!selectedStore || !selectedEnv || !selectedRegion) return;

   setLoading(true);
   setError(null);

   try {
     const response = await fetch(
       `http://localhost:5000/api/objectstore/${selectedStore}?startDate=${statsForm.startDate}&endDate=${statsForm.endDate}&period=${statsForm.period}`,
       {
         headers: {
           'x-anypnt-env-id': selectedEnv,
           'x-anypnt-region': selectedRegion
         }
       }
     );
     if (!response.ok) throw new Error('Error retrieving store data');
     const data = await response.json();
     setStoreData(data);
   } catch (err) {
     setError(err.message);
   } finally {
     setLoading(false);
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

 const CustomDot = (props) => {
   const { cx, cy, payload } = props;
   const today = new Date().toISOString().split('T')[0];
   const dotDate = new Date(payload.timeStamp).toISOString().split('T')[0];
   
   if (dotDate === today) {
     return <circle cx={cx} cy={cy} r={4} fill="red" />;
   }
   return <circle cx={cx} cy={cy} r={2} fill="#8884d8" />;
 };

 const handleSort = (key) => {
   let direction = 'ascending';
   if (sortConfig.key === key && sortConfig.direction === 'ascending') {
     direction = 'descending';
   }
   setSortConfig({ key, direction });
 };

 const getSortedStores = () => {
   const storesArray = Object.entries(allStoresData).map(([store, data]) => {
     if (!Array.isArray(data)) return null;
     const totalRequests = data.reduce((sum, item) => sum + item.objectStoreRequestCount, 0);
     const avgRequests = Math.round(totalRequests / data.length);
     const lastRequest = data[data.length - 1]?.timeStamp;

     return {
       store,
       lastRequest: new Date(lastRequest),
       totalRequests,
       avgRequests
     };
   }).filter(Boolean);

   if (sortConfig.key) {
     storesArray.sort((a, b) => {
       if (a[sortConfig.key] < b[sortConfig.key]) {
         return sortConfig.direction === 'ascending' ? -1 : 1;
       }
       if (a[sortConfig.key] > b[sortConfig.key]) {
         return sortConfig.direction === 'ascending' ? 1 : -1;
       }
       return 0;
     });
   }

   return storesArray;
 };

 if (tokenLoading) return <div>Loading...</div>;

 return (
   <div className="page-content">
     {!selectedEnv ? (
       <div className="welcome-message">
         <h2>Welcome to Object Store Statistics</h2>
         <p>Select an environment to view statistics</p>
       </div>
     ) : (
       <>
         <h2>Object Store Statistics</h2>
         <form onSubmit={handleSubmit} className="stats-form">
           <div className="form-group">
             <label>Store:</label>
             <select
               value={`${selectedStore}|${selectedRegion}`}
               onChange={handleStoreSelect}
               required
               className="store-select"
               disabled={loading}
             >
               <option value="">Select a store</option>
               {availableStores.map((store, index) => (
                 <option key={store.name || index} value={`${store.name}|${store.region}`}>
                   {store.name}
                 </option>
               ))}
             </select>
           </div>

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

           <div className="button-group">
             <button 
               type="submit" 
               disabled={loading || !isAuthenticated || !selectedStore}
               className="submit-button"
             >
               {loading ? 'Loading...' : 'View Statistics'}
             </button>
             
             <button 
               type="button"
               onClick={fetchAllStoresData}
               disabled={loading || !isAuthenticated || !availableStores.length}
               className="refresh-button"
             >
               Refresh All Stores
             </button>
           </div>
         </form>

         {error && (
           <div className="error">
             <strong>Error:</strong> {error}
           </div>
         )}

         {Object.keys(allStoresData).length > 0 && (
           <div className="stores-table">
             <h3>Stores Summary</h3>
             <table>
               <thead>
                 <tr>
                   <th onClick={() => handleSort('store')} className="sortable">
                     Store ID {sortConfig.key === 'store' && (
                       <span>{sortConfig.direction === 'ascending' ? '↑' : '↓'}</span>
                     )}
                   </th>
                   <th onClick={() => handleSort('lastRequest')} className="sortable">
                     Last Request {sortConfig.key === 'lastRequest' && (
                       <span>{sortConfig.direction === 'ascending' ? '↑' : '↓'}</span>
                     )}
                   </th>
                   <th onClick={() => handleSort('totalRequests')} className="sortable">
                     Total Requests {sortConfig.key === 'totalRequests' && (
                       <span>{sortConfig.direction === 'ascending' ? '↑' : '↓'}</span>
                     )}
                   </th>
                   <th onClick={() => handleSort('avgRequests')} className="sortable">
                     Average Requests {sortConfig.key === 'avgRequests' && (
                       <span>{sortConfig.direction === 'ascending' ? '↑' : '↓'}</span>
                     )}
                   </th>
                 </tr>
               </thead>
               <tbody>
                 {getSortedStores().map((storeData) => (
                   <tr key={storeData.store}>
                     <td>{storeData.store}</td>
                     <td>{storeData.lastRequest.toLocaleString('en-US')}</td>
                     <td>{formatNumber(storeData.totalRequests)}</td>
                     <td>{formatNumber(storeData.avgRequests)}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         )}

         {storeData && (
           <div className="stats-result">
             <div className="chart-container">
               <ResponsiveContainer width="100%" height={400}>
                 <LineChart
                   data={formatChartData(storeData)}
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
                     activeDot={{ r: 6 }}
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

export default ByApplication;