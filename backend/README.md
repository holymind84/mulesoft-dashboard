# Mulesoft Dashboard - Backend

Express.js backend server for the Mulesoft Dashboard.

## Configuration

Create a `.env` file with:

```env
ORGANIZATION_ID=your-org-id
REGION_ID=your-region-id
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
CORE_CLIENT_ID=your-core-client-id
CORE_CLIENT_SECRET=your-core-client-secret
PORT=5000
```

## API Endpoints

### Token Management
- `GET /api/token/status` - Get standard token status
- `GET /api/token/core/status` - Get core token status

### Applications
- `GET /api/cloudhub/applications` - Get CloudHub applications
- `GET /api/environments` - Get available environments

### Object Store
- `POST /api/stats` - Get Object Store statistics
- `GET /api/objectstore` - Get stores list
- `GET /api/objectstore/:storeId` - Get store usage

## Development

```bash
npm install
npm run dev     # Start with nodemon
npm start       # Start production server
```

## API Documentation

The API documentation is available through Swagger UI at `/api-docs` endpoint when the server is running. 

To access the documentation:
1. Start the server
2. Visit `http://localhost:5000/api-docs`

The documentation includes:
- Endpoint descriptions
- Request/response schemas
- Authentication requirements
- Example requests

## Error Handling

The server implements automatic token refresh and comprehensive error logging with timestamps.