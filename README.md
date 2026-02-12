# Post-signature admin task automation

## Introduction
This repository models a post-signature admin task automation workflow, built using the Docusign Maestro workflow builder, Web Forms, and Maestro API.

After obtaining a signed agreement, there are administrative tasks that must be completed for every agreement such as:
- Kickoff emails.
- Internal stakeholders notifications.
- Project page and repo creation.
- Onboarding.

Commonly, these tasks lists are repetitive, templated, and time-consuming. This project models a simple, scalable, and adaptable workflow as a potential solution to automate and expedite these tasks.

Detailed README files for each portion of this project can be found here:
- [Workflow import](https://github.com/docusign/contract-task-automation/blob/main/workflow/workflow-import-instructions.md)
- [Web Form import](https://github.com/docusign/contract-task-automation/blob/main/workflow/webform/form-upload-instructions.md)
- [Server](https://github.com/docusign/contract-task-automation/blob/main/server/README.md)
- [Notion integration](https://github.com/docusign/contract-task-automation/blob/main/notion-starter/notion-integration.md)


### Architecture
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
- Uses the "From an API call"**" start method 
- Defines trigger inputs (e.g. startDate, workflowBuilder, etc.)

**Note**: You can upload the `workflow-zip.zip` folder to your Docusign account to bypass this requirement.

## Installation Steps
1. Install dependencies

   ```bash
   npm install
   ```

2. Configure environment variables
   Copy `example.env` to `/server/.env.`

   ```bash
   cd server
   cp .env.example .env
   ```

   and set these values:

   - DS_CLIENT_ID=YOUR_INTEGRATION_KEY
   - DS_CLIENT_SECRET=YOUR_SECRET
   - DS_ACCOUNT_ID=YOUR_ACCOUNT_ID
   - MAESTRO_WORKFLOW_ID=YOUR_WORKFLOW_ID
   - DEVELOPER_NAME=Your Name
   - DEVELOPER_EMAIL=your@email.com
   - WORKFLOW_BUILDER_EMAIL=your@email.com
   - WORKFLOW_PREPARER_EMAIL=your@email.com

3. Start the server
   ```bash
   node server.js
   ```

4. Open a browser to http://localhost:4000
