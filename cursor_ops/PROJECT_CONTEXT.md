<!-- AUTO-GENERATED: Cursor DevOps Layer v1 -->

# Migration Hub — Project Context (SSoT)

## Purpose
Migration Hub UI is a Vite + React + Tailwind single-page app for tracking customer migrations. It authenticates with Google (GIS) and reads operational data from Google Sheets.

## Stack Overview
- Frontend: Vite, React, HashRouter, TailwindCSS, Chart.js
- Auth: Google Identity Services (popup token)
- Data: Google Sheets API (read by header names), Spreadsheet ID (env): `VITE_SHEETS_ID`

## Google Sheets
- Spreadsheet ID (current): `1aSy-ypUF95hLmQkIsKmqnD0RMJ4AQ-rCHdeg7OXSj4k`
- Key tabs (naming conventions):
  - Primary view (UI read): `MH_View_Migrations` — headers in row 1; rows 2..N are data.
  - Canonical tabs (SSOT by entity): `Migrations`, `Customers`, `Owners`, `Activities`, `StageThresholds` (read as needed by features; never infer by column index).

## Header Mapping Rules (global)
- Never hardcode column indices or letters. Always build a header→index map from row 1.
- Required headers for the current feature: `MigrationID`, `CustomerID`, `CustomerName`, `Stage`, `DaysInStage`, `Status`, `OwnerEmail`.

## Cursor Defaults
- Always pin and reference:
  1) `/cursor_ops/PROJECT_CONTEXT.md` (this file)
  2) `/cursor_ops/BUILD_RULES.md`
  3) `src/lib/sheets.ts` (for header-mapped access patterns)
  4) Page under development (e.g., `src/pages/MyMigrationsPage.tsx`)


