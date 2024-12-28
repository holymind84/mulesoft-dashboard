const express = require('express');
const cors = require('cors');
const axios = require('axios');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const { getosv2_url, extractRegion,extractCloudHub2Region } = require('./utils');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

let currentToken = null;
let tokenError = null;
let tokenExpirationTime = null;

let currentCoreToken = null;
let coreTokenError = null;
let coreTokenExpirationTime = null;

const getBaseUrl = (region = 'us') => {
 const urls = {
   'us': 'https://anypoint.mulesoft.com',
   'eu1': 'https://eu1.anypoint.mulesoft.com',
   'gov': 'https://gov.anypoint.mulesoft.com'
 };
 return urls[region] || urls.us;
};



const log = (message) => {
 const timestamp = new Date().toLocaleString('en-US', {
   dateStyle: 'short',
   timeStyle: 'medium'
 });
 console.log(`[${timestamp}] ${message}`);
};





const logError = (message, error) => {
 const timestamp = new Date().toLocaleString('en-US', {
   dateStyle: 'short',
   timeStyle: 'medium'
 });
 console.error(`[${timestamp}] ${message}:`, error);
};

const getToken = async () => {
 try {
   if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
     throw new Error('Missing standard credentials in .env file');
   }

   const baseUrl = getBaseUrl(process.env.REGION);
   log('Requesting new standard token...');
   const response = await axios.post(
     `${baseUrl}/accounts/api/v2/oauth2/token`,
     {
       client_id: process.env.CLIENT_ID,
       client_secret: process.env.CLIENT_SECRET,
       grant_type: 'client_credentials'
     }
   );

   currentToken = response.data;
   tokenError = null;
   tokenExpirationTime = Date.now() + (response.data.expires_in * 1000);
   
   log('Standard token obtained successfully');
   return response.data;
 } catch (error) {
   tokenError = error.response?.data || error.message;
   logError('Error getting standard token', tokenError);
   throw error;
 }
};

const getCoreToken = async () => {
 try {
   if (!process.env.CORE_CLIENT_ID || !process.env.CORE_CLIENT_SECRET) {
     throw new Error('Missing core credentials in .env file');
   }

   const baseUrl = getBaseUrl(process.env.REGION);
   log('Requesting new core token...');
   const response = await axios.post(
     `${baseUrl}/accounts/api/v2/oauth2/token`,
     {
       client_id: process.env.CORE_CLIENT_ID,
       client_secret: process.env.CORE_CLIENT_SECRET,
       grant_type: 'client_credentials'
     }
   );

   currentCoreToken = response.data;
   coreTokenError = null;
   coreTokenExpirationTime = Date.now() + (response.data.expires_in * 1000);
   
   log('Core token obtained successfully');
   return response.data;
 } catch (error) {
   coreTokenError = error.response?.data || error.message;
   logError('Error getting core token', coreTokenError);
   throw error;
 }
};

const ensureValidToken = async () => {
 if (!currentToken || Date.now() >= tokenExpirationTime) {
   log('Token invalid or expired, requesting new token...');
   await getToken();
 }
 return currentToken;
};

const ensureValidCoreToken = async () => {
 if (!currentCoreToken || Date.now() >= coreTokenExpirationTime) {
   log('Core token invalid or expired, requesting new token...');
   await getCoreToken();
 }
 return currentCoreToken;
};

const formatToOffsetDateTime = (dateString) => {
 return `${dateString}T00:00:00Z`;
};

const handleError = async (error, res) => {
 logError('Error retrieving applications', error.response?.data || error.message);
 
 if (error.response?.status === 401) {
   try {
     await getCoreToken();
     res.status(401).json({ 
       error: 'Token expired, please retry', 
       shouldRetry: true 
     });
   } catch (tokenError) {
     res.status(401).json({ 
       error: 'Authentication error', 
       details: tokenError.message 
     });
   }
 } else {
   res.status(error.response?.status || 500).json({
     error: error.response?.data || error.message,
     timestamp: new Date().toISOString()
   });
 }
};

const fetchCloudHub1Apps = async (environmentId) => {
 try {
   const baseUrl = getBaseUrl(process.env.REGION);
   const response = await axios.get(`${baseUrl}/cloudhub/api/applications`, {
     headers: {
       'Authorization': `Bearer ${currentCoreToken.access_token}`,
       'x-anypnt-org-id': process.env.ORGANIZATION_ID,
       'x-anypnt-env-id': environmentId
     }
   });
   return response.data.map(app => ({ ...app, platform: 'CloudHub' }));
 } catch (error) {
   if (error.response?.status === 404) {
     log('No CloudHub 1.0 applications found in this environment');
     return [];
   }
   throw error;
 }
};

const fetchCloudHub2Apps = async (environmentId) => {
 try {
   const baseUrl = getBaseUrl(process.env.REGION);
   const endpoint = `${baseUrl}/amc/application-manager/api/v2/organizations/${process.env.ORGANIZATION_ID}/environments/${environmentId}/deployments`;
   
   const deploymentsResponse = await axios.get(endpoint, {
     headers: {
       'Authorization': `Bearer ${currentCoreToken.access_token}`
     }
   });

   if (!deploymentsResponse.data.items?.length) {
     return [];
   }

   const appsWithDetails = await Promise.all(
     deploymentsResponse.data.items.map(async (app) => {
       try {
         const detailsResponse = await axios.get(
           `${baseUrl}/amc/application-manager/api/v2/organizations/${process.env.ORGANIZATION_ID}/environments/${environmentId}/deployments/${app.id}`,
           {
             headers: {
               'Authorization': `Bearer ${currentCoreToken.access_token}`
             }
           }
         );

         const details = detailsResponse.data;
         return {
           domain: app.name,
           status: app.application?.status || 'UNKNOWN',
           workers: details.target?.replicas || 1,
           workerType: details.application?.vCores || 'vCore',
           muleVersion: app.currentRuntimeVersion,
           platform: 'CloudHub 2.0',
           targetId: app.target.targetId
         };
       } catch (error) {
         log(`Error fetching details for deployment ${app.id}: ${error.message}`);
         return null;
       }
     })
   );

   return appsWithDetails.filter(app => app !== null);
 } catch (error) {
   if (error.response?.status === 404) {
     log('No CloudHub 2.0 environments available');
     return [];
   }
   throw error;
 }
};

// API Endpoints
app.get('/api/token/status', (req, res) => {
 if (tokenError) {
   res.status(500).json({ error: tokenError });
 } else if (currentToken) {
   res.json({
     ...currentToken,
     expiresAt: tokenExpirationTime,
     isValid: Date.now() < tokenExpirationTime
   });
 } else {
   res.status(404).json({ message: 'Token not yet available' });
 }
});

app.get('/api/token/core/status', (req, res) => {
 if (coreTokenError) {
   res.status(500).json({ error: coreTokenError });
 } else if (currentCoreToken) {
   res.json({
     ...currentCoreToken,
     expiresAt: coreTokenExpirationTime,
     isValid: Date.now() < coreTokenExpirationTime
   });
 } else {
   res.status(404).json({ message: 'Core token not yet available' });
 }
});

app.get('/api/cloudhub/applications', async (req, res) => {
 try {
   await ensureValidCoreToken();
   const environmentId = req.headers['x-anypnt-env-id'];
   
   if (!environmentId || !process.env.ORGANIZATION_ID) {
     return res.status(400).json({ error: 'Missing required parameters' });
   }

   let ch1Apps = [], ch2Apps = [];
   let errors = [];
   
   try {
     ch1Apps = await fetchCloudHub1Apps(environmentId);
   } catch (error) {
     errors.push({ platform: 'CloudHub', error: error.message });
     log('Error fetching CloudHub 1.0 apps: ' + error.message);
   }

   try {
     ch2Apps = await fetchCloudHub2Apps(environmentId);
   } catch (error) {
     errors.push({ platform: 'CloudHub 2.0', error: error.message });
     log('Error fetching CloudHub 2.0 apps: ' + error.message);
   }

   const apps = [...ch1Apps, ...ch2Apps];
   
   if (apps.length === 0 && errors.length > 0) {
     return res.status(500).json({ 
       error: 'Failed to fetch applications', 
       details: errors 
     });
   }

   res.json(apps);

 } catch (error) {
   handleError(error, res);
 }
});

app.post('/api/stats', async (req, res) => {
  try {
    log('=== Object Store Stats Request ===');
    await ensureValidToken();
    
    const { startDate, endDate, period } = req.body;
    const environmentId = req.headers['x-anypnt-env-id'];

    const endpoint = `https://object-store-stats.anypoint.mulesoft.com/api/v1/organizations/${process.env.ORGANIZATION_ID}/environments/${environmentId}`;
    
    log(`Endpoint: POST /api/stats`);
    log(`URL: ${endpoint}`);
    log(`Body Parameters: startDate=${startDate}, endDate=${endDate}, period=${period}`);
    log(`Environment ID: ${environmentId}`);
	log(`Organization ID: ${process.env.ORGANIZATION_ID}`);
    log(`Environment ID: ${environmentId}`);
    log(`Token Type: ${currentToken.token_type}`);
    log(`Token Expires In: ${currentToken.expires_in}`);
	
	
	
    if (!process.env.ORGANIZATION_ID) {
      throw new Error('Missing ORGANIZATION_ID in environment variables');
    }

    if (!environmentId) {
      throw new Error('Environment ID not specified');
    }

    if (!startDate || !endDate || !period) {
      throw new Error('Missing parameters');
    }

    const formattedStartDate = formatToOffsetDateTime(startDate);
    const formattedEndDate = formatToOffsetDateTime(endDate);

    const response = await axios.get(endpoint, {
      params: {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        period,
        isMaster: false
      },
      headers: {
        'Authorization': `Bearer ${currentToken.access_token}`
      }
    });

    log('Statistics obtained successfully');
    res.json(response.data);

  } catch (error) {
    logError('Error in stats request', error.response?.data || error.message);
    handleError(error, res);
  }
});

app.get('/api/objectstore', async (req, res) => {
  try {
    log('=== Object Store List Request ===');
    await ensureValidToken();
    
    const { startDate, endDate, period } = req.query;
    const environmentId = req.headers['x-anypnt-env-id'];
    const baseUrl = getBaseUrl(process.env.REGION);
 
    // Get available regions first
    log('=== Region Info Request ===');
    const regionEndpoint = `${baseUrl}/armui/api/v1/applications`;
    log(`Endpoint: GET ${regionEndpoint}`);
    
    try {
        const regionResponse = await axios.get(regionEndpoint, {
            headers: {
                'Authorization': `Bearer ${currentCoreToken.access_token}`,
                'X-ANYPNT-ENV-ID': environmentId,
                'X-ANYPNT-ORG-ID': process.env.ORGANIZATION_ID
            }
        });
 
        const responseData = regionResponse.data;
        
        if (responseData?.data) {
            const regions = [];
 
            responseData.data.forEach(item => {
                const cloudInfo = item.target.type === 'MC' ? 
                    extractCloudHub2Region(item.target?.id) : 
                    getosv2_url(extractRegion(item?.details?.domain)); 
                
                log('Calculated cloudInfo: ' + cloudInfo);
                if (cloudInfo) regions.push(cloudInfo);
            });
 
            const distinctRegions = [...new Set(regions)];
            log('Regions array: ' + JSON.stringify(regions));
            log('Distinct Regions: ' + JSON.stringify(distinctRegions));
 
            if (!environmentId) {
                throw new Error('Environment ID not specified');
            }
 
            if (!startDate || !endDate || !period) {
                throw new Error('Missing parameters');
            }
 
            const formattedStartDate = formatToOffsetDateTime(startDate);
            const formattedEndDate = formatToOffsetDateTime(endDate);
 
            // Query each region for stores
            const storePromises = distinctRegions.map(async region => {
                const endpoint = `https://object-store-stats.anypoint.mulesoft.com/api/v1/organizations/${process.env.ORGANIZATION_ID}/environments/${environmentId}/regions/${region}/stores`;
                
                log(`Making request to region ${region}: ${endpoint}`);
                
                try {
                    const response = await axios.get(endpoint, {
                        params: {
                            startDate: formattedStartDate,
                            endDate: formattedEndDate,
                            period
                        },
                        headers: {
                            'Authorization': `Bearer ${currentToken.access_token}`
                        }
                    });
 
                    log(`Raw response from region ${region}: ${JSON.stringify(response.data)}`);
                    
                    const regionStores = response.data || [];
                    log(`Processed stores for region ${region}: ${JSON.stringify(regionStores)}`);
                    
                    const storesWithRegion = regionStores.map(store => ({
                        name: store,
                        region: region
                    }));
 
                    log(`Formatted stores for region ${region}: ${JSON.stringify(storesWithRegion)}`);
                    return storesWithRegion;
 
                } catch (error) {
                    log(`Error fetching stores for region ${region}: ${error.message}`);
                    return [];
                }
            });
 
            const storesResults = await Promise.all(storePromises);
            log(`Stores Results before flat: ${JSON.stringify(storesResults)}`);
            
            const allStores = storesResults.flat();
            log(`All Stores after flat: ${JSON.stringify(allStores)}`);
 
            res.json(allStores);
        }
 
    } catch (error) {
        log('Error Message:', error.message);
        if (error.response) {
            log('Error Status:', error.response.status);
            log('Error Headers:', JSON.stringify(error.response.headers, null, 2));
            log('Error Data:', JSON.stringify(error.response.data, null, 2));
        }
        handleError(error, res);
    }
 
  } catch (error) {
    logError('Error retrieving stores', error.response?.data || error.message);
    handleError(error, res);
  }
 });


app.get('/api/objectstore/:storeId', async (req, res) => {
  try {
    log('=== Object Store Store Details Request ===');
    await ensureValidToken();
    
    const { storeId } = req.params;
    const { startDate, endDate, period } = req.query;
    const environmentId = req.headers['x-anypnt-env-id'];
    const region = req.headers['x-anypnt-region'];
 
    log('Request Parameters:');
    log(`Store ID: ${storeId}`);
    log(`Environment ID: ${environmentId}`);
    log(`Region: ${region}`);
    log(`Start Date: ${startDate}`);
    log(`End Date: ${endDate}`);
    log(`Period: ${period}`);
 
    if (!environmentId) {
      throw new Error('Environment ID not specified');
    }
 
    if (!region) {
      throw new Error('Region not specified');
    }
 
    if (!storeId || !startDate || !endDate || !period) {
      throw new Error('Missing parameters');
    }
 
    const formattedStartDate = formatToOffsetDateTime(startDate);
    const formattedEndDate = formatToOffsetDateTime(endDate);
 
    const endpoint = `https://object-store-stats.anypoint.mulesoft.com/api/v1/organizations/${process.env.ORGANIZATION_ID}/environments/${environmentId}/regions/${region}/stores/${storeId}`;
    
    log(`Making request to: ${endpoint}`);
 
    const response = await axios.get(endpoint, {
      params: {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        period
      },
      headers: {
        'Authorization': `Bearer ${currentToken.access_token}`
      }
    });
 
    log('Store details obtained successfully');
    res.json(response.data);
  } catch (error) {
    logError('Error retrieving store', error.response?.data || error.message);
    handleError(error, res);
  }
 });



app.get('/api/environments', async (req, res) => {
  try {
    await ensureValidCoreToken();

    if (!process.env.ORGANIZATION_ID) {
      throw new Error('Organization ID not configured in environment variables');
    }
    
    const response = await axios.get(
      `https://anypoint.mulesoft.com/accounts/api/organizations/${process.env.ORGANIZATION_ID}/environments`,
      {
        headers: {
          'Authorization': `Bearer ${currentCoreToken.access_token}`
        }
      }
    );

    const productionEnvs = [];
    const otherEnvs = [];

    response.data.data.forEach(env => {
      const envData = {
        envId: env.id,
        label: env.name,
        type: env.type
      };

      if (env.type === 'production') {
        productionEnvs.push(envData);
      } else {
        otherEnvs.push(envData);
      }
    });

    productionEnvs.sort((a, b) => a.label.localeCompare(b.label));
    otherEnvs.sort((a, b) => a.label.localeCompare(b.label));

    const environments = [...productionEnvs, ...otherEnvs];

    res.json(environments);

  } catch (error) {
    logError('Error retrieving environments', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      try {
        await getCoreToken();
        res.status(401).json({ 
          error: 'Token expired, please retry', 
          shouldRetry: true 
        });
      } catch (tokenError) {
        res.status(401).json({ 
          error: 'Authentication error', 
          details: tokenError.message 
        });
      }
    } else {
      res.status(error.response?.status || 500).json({
        error: error.response?.data || error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

// Server startup
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  log(`Server running on port ${PORT}`);
  log(`Swagger documentation available at http://localhost:${PORT}/api-docs`);
  try {
    log('Getting initial tokens...');
    await Promise.all([getToken(), getCoreToken()]);
    log('Server ready');
  } catch (error) {
    logError('Error during server initialization', error);
  }
});