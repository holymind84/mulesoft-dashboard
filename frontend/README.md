# Mulesoft Dashboard - Frontend

React-based frontend for the Mulesoft Dashboard.

## Features

### Core Monitor
- Application status tracking
- Worker and core utilization
- Excel export functionality
- Real-time updates
- API Manager

### Object Store Statistics
- General usage metrics
- Per-store analytics
- Custom date range filtering
- Graphical visualization

## Dependencies

```json
{
  "react": "^18.x",
  "recharts": "^2.x",
  "lucide-react": "^0.263.1",
  "xlsx": "^0.18.x"
}
```

## Development

```bash
npm install
npm start
```

## Components Structure

```
src/
├── components/
│   └── shared/
│       ├── EnvironmentSelector.js
│       └── ExportAllEnvironments.js
├── pages/
│   ├── Core.js
│   ├── General.js
│   └── ByApplication.js
└── styles/
    └── *.css
```

## Build

```bash
npm run build
```