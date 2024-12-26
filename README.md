# Mulesoft Dashboard

A comprehensive monitoring solution for Mulesoft applications and Object Store metrics.

## Features

- Real-time CloudHub application monitoring
- Object Store usage statistics
- Multi-environment support
- Core utilization tracking
- Exportable reports

## Project Structure

```
/
├── frontend/    # React application
├── backend/     # Express server
└── README.md
```

## System Requirements

### Software Requirements
- Node.js >= 16.x
- npm >= 8.x
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Mulesoft Requirements
- Anypoint Platform account with:
  - Access to CloudHub applications
  - Object Store v2 license
  - API Manager access
  - Environment management permissions

## Quick Start

1. Clone the repository
```bash
git clone https://github.com/holymind84/mulesoft-dashboard.git
cd mulesoft-dashboard
```

2. Start the backend server
```bash
cd backend
npm install
npm start
```

3. Start the frontend application
```bash
cd frontend
npm install
npm start
```

4. Access the application at `http://localhost:3000`

## Environment Variables

See individual README files in `/backend` and `/frontend` directories for detailed configuration.

## Contributing

Contributions welcome! Please read our contributing guidelines before submitting pull requests.

## Donations

If you find this project helpful and want to support its continued development:

[![PayPal](https://img.shields.io/badge/PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/SBernardini84)

Your support helps:
- 🚀 Maintain and improve the project
- 💡 Develop new features
- 🐛 Provide faster bug fixes
- 📚 Improve documentation

## License

MIT License - see [LICENSE](LICENSE) file for details
