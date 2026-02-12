# Trigger Server (Maestro API)
This server demonstrates:
- OAuth login (consent)
- Triggering a Maestro workflow instance with a JSON payload

## Setup

1. Run the following commands:
```bash
cd server
cp .env.example .env
npm install
node server.js
```

2. Authenticate
Open the link and login to your Docusign Developer account: 
http://localhost:4000/login