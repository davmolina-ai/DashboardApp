# Dashboard to Orders Demo

This repository contains a demo application for the Health Informatics "Dashboard to Orders" project. It now includes both an operational workflow for running rules against dashboard CSVs and a visual ruleset builder that stores reusable rules in SQLite instead of hardcoding them in the server.

The CSV importer supports dashboard exports that include a title row before the actual column headers and also handles quoted multiline headers, which allows it to work with real colon, cirrhosis, asthma, and ASCVD CSV exports.

## Demo workflow

1. Nurse or quality staff uploads a dashboard CSV export.
2. The app evaluates a selected active ruleset from the database against each patient row.
3. Matching patients are shown with an explanation and recommended order.
4. Draft orders are generated into a provider inbox.
5. The provider can accept, reject, or defer each draft while reviewing the FHIR payload.

## Ruleset builder workflow

1. Upload a CSV in the builder view.
2. The app detects fields, identifies a likely clinical profile, and proposes healthcare-specific starter rules.
3. Users can drag CSV fields into a nested canvas editor with `AND`, `OR`, and `NOT` logic.
4. Rulesets are saved to a local SQLite database and can be activated for the operational workflow.

## Included scenarios

- Colon cancer FIT outreach
- Lung cancer LDCT screening
- Cirrhosis HCC ultrasound surveillance
- Cirrhosis AFP monitoring
- Cirrhosis varices screening
- Asthma controller therapy review
- ASCVD statin initiation review

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

- `server.js`: Node server, API endpoints, ruleset execution, in-memory demo inbox, FHIR resource generation.
- `lib/rules-db.js`: SQLite persistence layer backed by `sql.js`.
- `lib/rule-engine.js`: CSV parsing and generic JSON rule execution.
- `lib/seed-rules.js`: Seed data and healthcare-specific suggestion templates.
- `public/index.html`: Operations view and ruleset builder view.
- `public/app.js`: Client-side state management, canvas editing, and API calls.
- `public/styles.css`: Responsive styling for both operational and builder interfaces.
- `public/sample-colon-screening.csv`: Demo dashboard input file.

## API endpoints

- `GET /api/rulesets`
- `POST /api/rulesets`
- `DELETE /api/rulesets/:id`
- `POST /api/evaluate`
- `POST /api/orders/generate`
- `GET /api/inbox`
- `POST /api/inbox/:id/decision`
- `POST /api/builder/analyze`
- `POST /api/session/reset`

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

## Persistence note

Rulesets are stored in SQLite using `sql.js` and persisted to the app content area. This is suitable for a single-instance demo deployment on Azure App Service. It should not be treated as a production multi-instance database strategy.

## What this demo intentionally simplifies

- Uses SQLite plus JSON rule definitions instead of a production-grade database and rule engine
- Shows draft FHIR `ServiceRequest` JSON instead of pushing to a live EHR
- Uses guideline-inspired curated suggestion templates instead of live external clinical knowledge retrieval
- The builder supports one draft-order action per rule in v1

## Next step for the team

The natural next increment is to externalize rule definitions and add a real FHIR write adapter so accepted drafts can be sent to a SMART on FHIR sandbox or Azure Health Data Services.
