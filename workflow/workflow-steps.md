# Workflow steps
If you're building your workflow from scratch, here's a basic outline of the entire workflow:

## Start Method
From an API call

## Steps
1. Collect Data with Web Form: Collect kickoff details
2. Branching rule: readyToKickoff == true

### Branching conditional rule
If you used the same naming convention as the rest of the repo, your rule should look like this:
```json
IF Ready to kickoff automatically? (Yes!)
Is
True
```

Select the "Merge true and false branches?" checkbox to merge the branches.

### Branch: readyToKickoff == true
- Send an Email: Send Client Kickoff Email
- Send an Email: Send Internal Notification

### Branch: readyToKickoff == false
- Send an Email: Send Manual Review Email

3. Show a Confirmation Screen

## Variables
Web form variables:
- clientName, clientEmail
- agreementName, agreementId
- projectName, packageName, price, repoName
- intakeNotes
- readyToKickoff

Starting variable constants:
- developerName
- developerEmail
