# Repository Map

Last updated: 2025-11-04 00:00 UTC

## Overview

- Purpose: quick orientation for engineers and non-technical readers.
- Updates automatically on file changes and PRs.

## Folder Index

- src/ — Application source (routes, components, state, data access, config, styles).
- public/ — Static assets served as-is by Vite.
- .github/ — GitHub Actions workflow for Pages deployment.
- scripts/ — Build-time utility scripts (env checks, etc.).
- docs/ — Project documentation.
- Root files — Vite, npm, Tailwind, and repo config.

## Files

### src/

- path: src/index.css
  eng: Global stylesheet bootstrapping Tailwind layers and base theme tokens.
  plain: Base CSS file that sets the overall look and enables Tailwind classes.

- path: src/main.jsx
  eng: Vite/React bootstrap; mounts GlobalErrorBoundary, AuthProvider, HashRouter, and App.
  plain: The entry point that starts the app and sets up error handling and sign-in.

- path: src/App.jsx
  eng: Top-level application shell with title mapping and the Auth-gated render pipeline (AuthGate inside AppShell).
  plain: The main app component that shows pages only after you’re signed in and the data schema looks good.

#### src/layouts/

- path: src/layouts/AppShell.jsx
  eng: Layout wrapper with sidebar, navbar, content container, and persistent sidebar collapse state.
  plain: The page frame with the left menu and top bar that wraps every screen.

#### src/components/

- path: src/components/Sidebar.jsx
  eng: Collapsible navigation sidebar with route links; supports icon-only collapsed mode.
  plain: The left-side menu to move between app pages that can be shrunk to icons.

- path: src/components/NavBar.jsx
  eng: Top navigation bar with sidebar toggle and Google auth status/actions chip.
  plain: The top bar with a menu button and “Sign in/Sign out” Google indicator.

- path: src/components/Card.jsx
  eng: Reusable card container with consistent rounding, border, and hover shadow.
  plain: A simple white box used to group content with a light shadow.

- path: src/components/KPI.jsx
  eng: Small KPI stat block showing a value and label.
  plain: A tiny panel that shows a number and its description.

- path: src/components/KpiCard.jsx
  eng: Clickable KPI card component with optional icon and focus rings.
  plain: A big stat card you can click to jump to more details.

- path: src/components/DataTable.jsx
  eng: Lightweight table with client-side sorting, sticky header, zebra rows, optional row actions, and custom rowKey.
  plain: The table used across pages to list items that supports sorting and highlighting.

- path: src/components/Toast.jsx
  eng: Auto-dismissing toast for success/error notifications.
  plain: A small message that appears briefly to confirm actions.

- path: src/components/NewMigrationModal.jsx
  eng: Stub modal for creating a new migration (currently logs payload; not wired when Google Form is configured).
  plain: A popup form for adding a migration (placeholder for later wiring).

- path: src/components/Modal.jsx
  eng: Generic modal dialog container with header and dismiss.
  plain: A reusable popup window with a title and close button.

- path: src/components/Drawer.jsx
  eng: Right-side sliding drawer for auxiliary views like Remapping.
  plain: A slide-in panel from the right to show extra details.

- path: src/components/StageTimeline.jsx
  eng: Stage overview component rendering compact step cards with counts.
  plain: A row of boxes that shows how many items are in each migration stage.

- path: src/components/GlobalErrorBoundary.jsx
  eng: Top-level React error boundary; on error shows safe-mode CTA and logs details.
  plain: Catches unexpected errors and shows a page with a “Try Safe Mode” button.

- path: src/components/AuthGate.jsx
  eng: Auth gate that renders loader, sign-in screen, or SchemaGate + routes based on auth state.
  plain: Decides whether to show loading, a sign-in prompt, or the actual app pages.

- path: src/components/SchemaGate.jsx
  eng: Schema enforcement wrapper; runs schema guard after auth and blocks UI with issues; supports ?safe and ?debug.
  plain: Checks your spreadsheet’s structure and blocks the app with clear instructions if it’s wrong.

- path: src/components/DebugOverlay.jsx
  eng: Debug-only overlay (enabled via ?debug=1) showing auth and schema status without exposing to normal users.
  plain: A small developer panel that shows helpful state when you add ?debug=1 to the URL.

#### src/pages/

- path: src/pages/DashboardOwner.jsx
  eng: Owner dashboard showing “Next Up” list, stage overview, and a New Migration form link (prefill owner when available).
  plain: The home screen for owners with a list of what to do next and a link to the intake form.

- path: src/pages/Migrations.jsx
  eng: All migrations list with search, sort, and navigation to details; uses SSOT Migrations data only.
  plain: A searchable table of every migration that links to the detail page.

- path: src/pages/Details.jsx
  eng: Customer/migration detail view with key info, notes, linked docs, stage completion chart, and Remapping drawer.
  plain: The page that shows everything about a migration including stats and documents.

- path: src/pages/Remapping.jsx
  eng: Scaffolded table for field remapping (placeholder inside Details via drawer).
  plain: A simple example table that will later show field mapping details.

- path: src/pages/Communication.jsx
  eng: Scaffolded communication log table (placeholder page).
  plain: A basic page to list messages and calls (placeholder for now).

- path: src/pages/Reports.jsx
  eng: Reports dashboard with KPI cards, Stage bar chart, Team workload doughnut, and recent activities.
  plain: A reporting page with stats, charts, and the latest activity updates.

#### src/lib/

- path: src/lib/google.ts
  eng: Google Identity Services (GIS) popup token client; init, sign-in/out, and access token cache.
  plain: The code that handles Google sign-in to get permission to read the sheet.

- path: src/lib/sheets.ts
  eng: Centralized Sheets client: header-based parsing, blank-row dropping, Migrations SSOT helpers, schema utilities, and disallow derived tabs.
  plain: The code that reads Google Sheets and turns rows into usable objects for the app.

- path: src/lib/forms.ts
  eng: Utility to build prefilled Google Form URLs from a base and key/value params safely.
  plain: A helper that adds pre-filled answers to the Google Form link.

- path: src/lib/api.js
  eng: Optional Apps Script JSON API client (fallback/sample pattern preserved for reference).
  plain: Legacy code to call a web app backend if needed instead of Sheets.

- path: src/lib/sampleData.js
  eng: Sample dataset used only when no backend is configured (kept for development/reference).
  plain: Fake data used for demos when the real backend isn’t set.

- path: src/lib/utils/nextUp.js
  eng: Selector to compute “Next Up” items (due today else soonest actionable) from migrations.
  plain: Logic that decides which companies you should contact next.

#### src/state/

- path: src/state/AuthContext.tsx
  eng: Auth provider and hook exposing { loading, authed, token, userEmail, signIn, signOut } with GIS initialization and timeout fallback.
  plain: The sign-in state manager that tells the app if you’re logged in and who you are.

- path: src/state/useSchemaGuard.tsx
  eng: Schema validation hook returning { ok, errors, sourceTabName, schemaVersionFound } after verifying required tabs/headers and version.
  plain: Checks the spreadsheet shape and version to make sure the app can safely read it.

#### src/config/

- path: src/config/env.ts
  eng: Env helpers to read VITE_SHEETS_ID with a single source of truth and dev logging.
  plain: Reads the Google Sheet ID from your environment settings.

- path: src/config/constants.ts
  eng: App constants including FORM_NEW_MIGRATION_URL and SCHEMA_VERSION; barrel for shared constants.
  plain: Handy values like the intake form link and the expected schema version.

- path: src/config.ts
  eng: OAuth/client scopes for GIS (public client id and read-only scopes).
  plain: The Google sign-in configuration used by the app.

#### src/types.ts

- path: src/types.ts
  eng: Type definitions for Customers, Migrations, Activities, Owners, StageThresholds.
  plain: A list of shapes for the data the app works with.

### public/

- path: public/vite.svg
  eng: Vite logo asset used by the default template.
  plain: An image used by the site template.

### .github/

- path: .github/workflows/deploy.yml
  eng: GitHub Pages workflow; caches Node, injects VITE_SHEETS_ID env, builds, and deploys to Pages.
  plain: The automation that builds the site and publishes it to GitHub Pages.

### scripts/

- path: scripts/check-env.cjs
  eng: Pre-build guard that fails the build when VITE_SHEETS_ID is missing.
  plain: A safety check that stops the build if the sheet ID isn’t set.

### docs/

- path: docs/REPO_MAP.md
  eng: Repository inventory and quick-start map (this file), to be regenerated on changes.
  plain: A guide that explains what every file does for both engineers and non-engineers.

### Root files

- path: index.html
  eng: HTML shell for the SPA; loads main.jsx; dev-only Tailwind CDN shim.
  plain: The base web page that loads the React app.

- path: package.json
  eng: Project manifest with scripts (dev/build/preview), dependencies, and the pre-build env check.
  plain: The file that defines project commands and libraries.

- path: tsconfig.json
  eng: TypeScript compiler options for JSX, bundler resolution, and strictness (JS allowed).
  plain: Settings that help the editor and build understand TypeScript.

- path: postcss.config.js
  eng: PostCSS pipeline enabling Tailwind and Autoprefixer.
  plain: Config that processes CSS for modern browser support.

- path: tailwind.config.js
  eng: Tailwind content paths and theme extension scaffold.
  plain: Settings for Tailwind classes the app can use.

- path: vite.config.js
  eng: Vite config with React plugin and GitHub Pages base path.
  plain: Build tool settings, including the subpath used on GitHub Pages.

- path: README.md
  eng: Project readme including configuration, deploy, routes, and troubleshooting.
  plain: Instructions for running, configuring, and deploying the app.

- path: .gitignore
  eng: Ignore patterns including env files, keeping .env.example.
  plain: Tells Git which files and folders not to track.

- path: .env.example
  eng: Example env file showing required variables for local dev (VITE_SHEETS_ID).
  plain: A template you copy to set your local environment variables.

## Notable entry points & runtime flow

1. App bootstrap: index.html → src/main.jsx → GlobalErrorBoundary → AuthProvider → HashRouter → src/App.jsx → AuthGate → SchemaGate → routes (pages/*).
2. Data access (Sheets/API): src/lib/google.ts (auth token) → src/lib/sheets.ts (fetch + mapping) → pages/components.
3. Auth flow: src/state/AuthContext.tsx (GIS init, sign-in) → AuthGate (loader/sign-in/app) → SchemaGate (post-auth schema checks).

## CONTINUOUS UPDATE INSTRUCTIONS

- Re-run this mapping task on save, commit, or PR merge.
- On regeneration: keep the same format, overwrite REPO_MAP.md content, update the timestamp.
