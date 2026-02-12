# Post-signature admin task automation

1. Authenticates with Docusign
2. Calls `getWorkflowTriggerRequirements`
3. Reads:
   - `trigger_http_config.url`
   - `trigger_input_schema`
4. Builds `trigger_inputs`
5. Triggers the workflow instance
6. Prints the `instance_url`

## Prerequisites
- [Docusign developer account](https://www.docusign.com/developers/sandbox?postActivateUrl=https%3A%2F%2Fdevelopers.docusign.com%2F)
- [Node.js and npm](https://nodejs.org/en/download/)

Additionally, a Maestro workflow in your account that:
- Is published
- Uses the **From an API call** start method
- Defines trigger inputs (e.g. startDate, workflowBuilder, etc.)

## Installation Steps

1. Install dependencies

```bash
cd server
npm install 
```

2. Configure environment variables

Copy `example.env` to `/server/.env.`

`cp .env.example .env`

and set these values:

- DS_CLIENT_ID=YOUR_INTEGRATION_KEY
- DS_CLIENT_SECRET=YOUR_SECRET
- DS_ACCOUNT_ID=YOUR_ACCOUNT_ID
- MAESTRO_WORKFLOW_ID=YOUR_WORKFLOW_ID
- DEVELOPER_NAME=Your Name
- DEVELOPER_EMAIL=your@email.com
- WORKFLOW_BUILDER_EMAIL=your@email.com
- WORKFLOW_PREPARER_EMAIL=your@email.com

3️. Start the server
```bash
node server.js
```

4. Open a browser to http://localhost:3000
