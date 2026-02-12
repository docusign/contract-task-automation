# Maestro API - Trigger a workflow programatically

This repo includes a minimal Node server that:
- Authenticates with Docusign (OAuth)
- Programatically fetches the workflow instance URL and trigger requirements
- Triggers a Maestro workflow instance
- Prints the workflow instance link you can open in Maestro

This demo uses the IAM SDK for OAuth and retrieving the workflow's trigger requirements, then calls the workflow’s trigger URL directly to start an instance (to match the exact request contract: `instance_name` and `trigger_inputs`).

## Setup

### 1. Configure environment variables
- Navigate to the server directory:

`cd server`

- Create a copy of the environment file and name it `.env`:

`cp example.env .env`

### 2. Install dependencies and start the server
```bash
npm install
node server.js
```

### 3. Authenticate
Open the link and login to your Docusign Developer account: 
http://localhost:4000/login

## User flow

### 1. OAuth
Authenticate in the browser and grant consent.

### 2. Read trigger requirements
The server calls the [Workflows:getWorkflowTriggerRequirements](https://developers.docusign.com/docs/maestro-api/reference/maestro/workflows/getworkflowtriggerrequirements/) endpoint to retrieve:

- `trigger_http_config.url` (the trigger endpoint to POST to)
- `trigger_input_schema[]` (the exact fields the workflow requires)

If the workflow inputs change, the server builds the request dynamically from the schema.

Sample response:
```json
{
    "trigger_id": "c30c7afc-xxxx-xxxx-xxxx-0a6488822fca",
    "trigger_event_type": "HTTP",
    "trigger_http_config": {
        "method": "POST",
        "url": "https://api-d.docusign.com/v1/accounts/44318ffc-xxxx-xxxx-xxxx-168818bcda81/workflows/80ac81e9-xxxx-xxxx-xxxx-1fceba75a325/actions/trigger"
    },
    "trigger_input_schema": [
        {
            "field_name": "startDate",
            "field_data_type": "Date"
        },
        {
            "field_name": "workflowBuilder",
            "field_data_type": "User"
        },
        {
            "field_name": "workflowPreparer",
            "field_data_type": "User"
        },
        {
            "field_name": "developerName",
            "field_data_type": "String"
        },
        {
            "field_name": "developerEmail",
            "field_data_type": "String"
        }
    ],
    "metadata": {
        "created_at": "2026-02-11T22:40:21.854+00:00",
        "created_by": "7fd2073b-xxxx-xxxx-xxxx-3b3cfce7f448",
        "modified_at": "2026-02-12T00:30:56.876+00:00",
        "response_timestamp": "2026-02-12T22:08:47.413367Z",
        "response_duration_ms": 813
    }
}
```

### 3. Trigger the workflow
The server makes a POST request to the [Workflows:triggerWorkflow](https://developers.docusign.com/docs/maestro-api/reference/maestro/workflows/triggerworkflow/) endpoint with the trigger requirements in the request body. 

Sample request body:

```json
{
  "instance_name": "Example Workflow Test"
  "trigger_inputs": { 
      // Add properties from trigger_input_schema[].field_name and the input values into the request body
    "developerEmail":"example@email.com",
    "developerName": "Raileen Del Rosario",
    "workflowPreparer": "Preparer",
    "startDate": "10-9-2022",
    "workflowBuilder": "Builder"
  }
}
```

### 4. Open the instance link
After making the POST request, the response will look like this:

```json
{
    "instance_id": "40c5852d-xxxx-xxxx-xxxx-4e86ffc3a11e",
    "instance_url": "https://apps-d.docusign.com/api/maestro/v1/accounts/44318ffc-xxxx-xxxx-xxxx-168818bcda81/instances/40c5852d-xxxx-xxxx-xxxx-4e86ffc3a11e/execution?mtid=842ce598-xxxx-xxxx-xxxx-2bcd9ceb951c&mtsec=Tw3xHJRQQcKjEOO9H7C-MShr3N0lT-00u8LpD_ckRrs"
}
```

The server prints the instance URL. Click the link to complete the running instance.