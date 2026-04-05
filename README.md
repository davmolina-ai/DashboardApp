# Dashboard to Orders Demo

This repository contains a demo application for the Health Informatics "Dashboard to Orders" project. It shows how a health system could upload dashboard CSV files, evaluate expert-defined screening rules, and generate draft FHIR `ServiceRequest` orders for provider review.

The CSV importer now supports dashboard exports that include a title row before the actual column headers, which matches the real colon screening export you shared.

## Demo workflow

1. Nurse or quality staff uploads a dashboard CSV export.
2. The app evaluates a selected ruleset against each patient row.
3. Matching patients are shown with an explanation and recommended order.
4. Draft orders are generated into a provider inbox.
5. The provider can accept, reject, or defer each draft while reviewing the FHIR payload.

## Included scenarios

- Colon cancer FIT outreach using the example logic from the requirements.
- Lung cancer LDCT screening using the smoking-history example from the summary.
- Cirrhosis HCC ultrasound surveillance
- Cirrhosis AFP monitoring
- Cirrhosis varices screening

## Run locally in VS Code

1. Open the folder in Visual Studio Code.
2. Start the app:

```bash
npm start
```

3. Open [http://localhost:3000](http://localhost:3000).
4. Click `Load sample CSV` to try the colon cancer workflow immediately.
5. To demo the lung screening scenario, upload [`public/sample-lung-screening.csv`](./public/sample-lung-screening.csv) and switch the ruleset to `Lung Cancer LDCT Screening`.
6. To demo cirrhosis workflows, upload your cirrhosis registry CSV and choose one of the cirrhosis rulesets from the ruleset dropdown.

## Project structure

- `server.js`: Node server, API endpoints, CSV parsing, in-memory inbox, FHIR resource generation.
- `public/index.html`: Demo UI for the nurse and provider workflows.
- `public/app.js`: Client-side state management and API calls.
- `public/styles.css`: Responsive styling for the demo.
- `public/sample-colon-screening.csv`: Demo dashboard input file.

## API endpoints

- `GET /api/rulesets`
- `POST /api/evaluate`
- `POST /api/orders/generate`
- `GET /api/inbox`
- `POST /api/inbox/:id/decision`

## Azure deployment direction

This demo is structured to deploy cleanly to Azure App Service as a Node web app.

- Runtime: Node.js
- Startup command: `npm start`
- Suggested Azure services for the class demo:
  - Azure App Service for hosting
  - Azure Health Data Services or HAPI/SMART sandbox for FHIR integration later
  - Azure Storage for uploaded file artifacts and reports
  - Azure Key Vault for SMART/FHIR secrets
  - GitHub Actions for CI/CD
- Included helper files:
  - `azure.yaml` for Azure Developer CLI alignment
  - `.github/workflows/azure-app-service.yml` as a starter GitHub Actions deployment workflow

## What this demo intentionally simplifies

- Uses in-memory storage instead of a database
- Shows draft FHIR `ServiceRequest` JSON instead of pushing to a live EHR
- Uses JavaScript ruleset functions now, leaving room to translate rules to CQL later
- The cirrhosis rules are pragmatic demo rules derived from the available registry fields because no local CQL/CDL library file was present in the shared course folder

## Next step for the team

The natural next increment is to externalize rule definitions and add a real FHIR write adapter so accepted drafts can be sent to a SMART on FHIR sandbox or Azure Health Data Services.
