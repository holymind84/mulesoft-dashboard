const express = require('express');
const cors = require('cors');
const axios = require('axios');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Global token variables
let currentToken = null;
let tokenError = null;
let tokenExpirationTime = null;

let currentCoreToken = null;
let coreTokenError = null;
let coreTokenExpirationTime = null;

// Logging function with timestamp
const log = (message) => {
  const timestamp = new Date().toLocaleString('en-US', {
    dateStyle: 'short',
    timeStyle: 'medium'
  });
  console.log(`[${timestamp}] ${message}`);
};

// Error logging
const logError = (message, error) => {
  const timestamp = new Date().toLocaleString('en-US', {
    dateStyle: 'short',
    timeStyle: 'medium'
  });
  console.error(`[${timestamp}] ${message}:`, error);
};

// Get standard token
const getToken = async () => {
  try {
    if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
      throw new Error('Missing standard credentials in .env file');
    }

    log('Requesting new standard token...');
    const response = await axios.post(
      'https://anypoint.mulesoft.com/accounts/api/v2/oauth2/token',
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

// Get core token
const getCoreToken = async () => {
  try {
    if (!process.env.CORE_CLIENT_ID || !process.env.CORE_CLIENT_SECRET) {
      throw new Error('Missing core credentials in .env file');
    }

    log('Requesting new core token...');
    const response = await axios.post(
      'https://anypoint.mulesoft.com/accounts/api/v2/oauth2/token',
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

// Check and renew standard token if needed
const ensureValidToken = async () => {
  if (!currentToken || Date.now() >= tokenExpirationTime) {
    log('Token invalid or expired, requesting new token...');
    await getToken();
  }
  return currentToken;
};

// Check and renew core token if needed
const ensureValidCoreToken = async () => {
  if (!currentCoreToken || Date.now() >= coreTokenExpirationTime) {
    log('Core token invalid or expired, requesting new token...');
    await getCoreToken();
  }
  return currentCoreToken;
};

// Format date to OffsetDateTime
const formatToOffsetDateTime = (dateString) => {
  return `${dateString}T00:00:00Z`;
};

// Get standard token status endpoint
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

// Get core token status endpoint
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

// Statistics endpoint
app.post('/api/stats', async (req, res) => {
  try {
    await ensureValidToken();
    
    const { startDate, endDate, period } = req.body;
    const environmentId = req.headers['x-anypnt-env-id'];

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

    log(`Requesting statistics for org ${process.env.ORGANIZATION_ID} from ${formattedStartDate} to ${formattedEndDate}`);

    const response = await axios.get(
      `https://object-store-stats.anypoint.mulesoft.com/api/v1/organizations/${process.env.ORGANIZATION_ID}/environments/${environmentId}`,
      {
        params: {
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          period,
          isMaster: false
        },
        headers: {
          'Authorization': `Bearer ${currentToken.access_token}`
        }
      }
    );

    log('Statistics obtained successfully');
    res.json(response.data);

  } catch (error) {
    logError('Error in stats request', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      try {
        await getToken();
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

// CloudHub applications endpoint
app.get('/api/cloudhub/applications', async (req, res) => {
  try {
    await ensureValidCoreToken();
    
    const environmentId = req.headers['x-anypnt-env-id'];
    
    if (!environmentId) {
      return res.status(400).json({ error: 'Environment ID not specified' });
    }

    if (!process.env.ORGANIZATION_ID) {
      return res.status(500).json({ error: 'Organization ID not configured' });
    }
    
    log('Requesting CloudHub applications list');

    const response = await axios.get(
      'https://anypoint.mulesoft.com/cloudhub/api/applications',
      {
        headers: {
          'Authorization': `Bearer ${currentCoreToken.access_token}`,
          'x-anypnt-org-id': process.env.ORGANIZATION_ID,
          'x-anypnt-env-id': environmentId
        }
      }
    );

    log('CloudHub applications list obtained successfully');
    res.json(response.data);

  } catch (error) {
    logError('Error retrieving CloudHub applications', error.response?.data || error.message);
    
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

// Get stores list endpoint
app.get('/api/objectstore', async (req, res) => {
  try {
    log('Received /api/objectstore request');
    await ensureValidToken();
    
    const { startDate, endDate, period } = req.query;
    const environmentId = req.headers['x-anypnt-env-id'];

    if (!process.env.ORGANIZATION_ID || !process.env.REGION_ID) {
      throw new Error('Missing required environment variables');
    }

    if (!environmentId) {
      throw new Error('Environment ID not specified');
    }

    if (!startDate || !endDate || !period) {
      throw new Error('Missing parameters');
    }

    const formattedStartDate = formatToOffsetDateTime(startDate);
    const formattedEndDate = formatToOffsetDateTime(endDate);

    const response = await axios.get(
      `https://object-store-stats.anypoint.mulesoft.com/api/v1/organizations/${process.env.ORGANIZATION_ID}/environments/${environmentId}/regions/${process.env.REGION_ID}/stores`,
      {
        params: {
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          period
        },
        headers: {
          'Authorization': `Bearer ${currentToken.access_token}`
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    logError('Error retrieving stores', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
});

// Get store usage endpoint
app.get('/api/objectstore/:storeId', async (req, res) => {
  try {
    log('Received /api/objectstore/:storeId request');
    await ensureValidToken();
    
    const { storeId } = req.params;
    const { startDate, endDate, period } = req.query;
    const environmentId = req.headers['x-anypnt-env-id'];

    if (!process.env.ORGANIZATION_ID || !process.env.REGION_ID) {
      throw new Error('Missing required environment variables');
    }

    if (!environmentId) {
      throw new Error('Environment ID not specified');
    }

    if (!storeId || !startDate || !endDate || !period) {
      throw new Error('Missing parameters');
    }

    const formattedStartDate = formatToOffsetDateTime(startDate);
    const formattedEndDate = formatToOffsetDateTime(endDate);

    const response = await axios.get(
      `https://object-store-stats.anypoint.mulesoft.com/api/v1/organizations/${process.env.ORGANIZATION_ID}/environments/${environmentId}/regions/${process.env.REGION_ID}/stores/${storeId}`,
      {
        params: {
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          period
        },
        headers: {
          'Authorization': `Bearer ${currentToken.access_token}`
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    logError('Error retrieving store', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
});

// Get environments endpoint
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

    // Split environments into production and non-production
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

    // Sort each array by name
    productionEnvs.sort((a, b) => a.label.localeCompare(b.label));
    otherEnvs.sort((a, b) => a.label.localeCompare(b.label));

    // Combine arrays with production first
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

// Health check endpoint
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
  try {
    log('Getting initial tokens...');
    await Promise.all([getToken(), getCoreToken()]);
    log('Server ready');
  } catch (error) {
    logError('Error during server initialization', error);
  }
});