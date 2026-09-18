# DuePilot — Receivables Action Agent

DuePilot is an India-first, local-first MVP for turning MSME receivables into a prioritized action queue.

## Product thesis

Every unpaid invoice should have a next action:

**Monitor → Chase → Finance → Fix Evidence → Escalate → Prepare Recovery**

The engine deliberately does not replace accounting systems, TReDS platforms, ODR, lawyers, or payment rails. It acts as the decision layer across them.

## Current MVP

- CSV import with deterministic parsing
- Data-quality gate for missing/invalid/duplicate records
- Evidence completeness and dispute signals
- Potential financing-candidate detection
- Collection and recovery state
- Transparent priority scoring
- Action Queue with Start / Done workflow
- Invoice detail drill-down
- Financial totals exclude data-issue rows
- Zero paid APIs or runtime services
- Node regression tests + GitHub Actions

## Expected CSV columns

`invoice,amount,due_date,buyer,status,accepted,po,delivery_proof,invoice_proof,udyam,buyer_type,notes`

Dates accept ISO `YYYY-MM-DD` and Indian `DD-MM-YYYY`.

## Run locally

Serve the repository with any static web server, then open `index.html`. For example:

`python3 -m http.server`

Run the decision-engine tests with:

`npm test`

## Product boundaries

Financing and recovery outputs are candidates for operator review, not legal, accounting, or financing advice. No automated external action is taken.

## Next validation step

Use a representative receivables dataset and verify that the engine's recommendations match real operator decisions before adding AI extraction, accounting integrations, messaging, or payment workflows.
