# Importing the Maestro Workflow
If you don't want to build the workflow yourself, you can upload the configuration folder to the workflow builder by following these instructions.

You can find the individual configuration files in the /workflow directory, in case you want you want to check out what the internal components of a workflow look like.

## 1. Import
1. Open the workflow page: https://apps-d.docusign.com/send/workflows
2. Choose “Create a workflow”
3. "Import Workflow"
3. Upload `workflow-zip.zip`

## 2. Confirm start method
Set the workflow start method to "From an API call"

## 3. Set workflow starting variables
Update constants:
- developerName
- developerEmail

## 4. Verify Web Form variables
Confirm the Web Form uses these variables:
- clientName, clientEmail
- agreementName, agreementId
- projectName, packageName, price, repoName
- intakeNotes
- readyToKickoff

## 5. Verify the branch rule
Condition:
readyToKickoff == true

## 6. Publish
Save and publish the workflow.
