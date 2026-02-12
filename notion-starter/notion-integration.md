# Notion Integrations - Next Steps

## Inputs
Use this field map to generate a the client's Notion project page:
- projectName to Notion page title
- clientName to Client field
- clientEmail to Email field
- packageName to Select field
- price to Number field
- repoName to Repo field
- intakeNotes to Notes field
- agreementName and agreementId to Agreement reference fields

## Notion Page Template
- Title: "{clientName} — {projectName}"
- Properties:
  - Client Name
  - Client Email
  - Package
  - Price
  - Repo Name
  - Agreement Name
  - Agreement ID
- Body blocks:
  - Kickoff checklist
  - Asset request list
  - Milestones (placeholder)

## Example function
See:
- /examples/notion-create-project.js
