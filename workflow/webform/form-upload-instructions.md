# Importing the Web Form
If you don't want to build the Web Form yourself, you can upload the configuration file to the webform builder by following these instructions.

## 1. Import
1. Open the templates page: https://apps-d.docusign.com/send/templates
2. Select "Start" on the left navigation bar and "Web Forms"
3. "Upload Web Form"
3. Upload `wf-config.json`

## 2. Verify Web Form variables
Confirm the Web Form defines and maps the following variables:
- clientName, clientEmail
- agreementName, agreementId
- projectName, packageName, price, repoName
- intakeNotes
- readyToKickoff

Ensure the variables:
- Have the correct data type
- Use the exact variable name (case-sensitive)
- Be marked required if needed for branching

## 3. Activate the form
Save and activate the Web Form