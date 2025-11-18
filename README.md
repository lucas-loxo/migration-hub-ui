# Migration Hub UI

Vite + React SPA using Tailwind, Chart.js, and HashRouter. Deploys automatically to GitHub Pages via `gh-pages` branch.

## Configuration

Environment-based Sheets ID:

- Copy `.env.example` to `.env.local` and set:

```
VITE_SHEETS_ID=YOUR_SHEET_ID
```

- Start dev: `npm run dev`. If the variable is missing in dev, a small banner will remind you.

- GitHub Pages: add a repository secret named `VITE_SHEETS_ID`. The Pages workflow writes it into `.env.production` before building.
 - GitHub Pages: add a repository secret named `VITE_SHEETS_ID`. The Pages workflow injects it into the build environment.

## Development

- Install deps: `npm install`
- Start dev server: `npm run dev`
  - Tailwind is loaded via CDN in dev for zero-config styling.

## Build

- `npm run build`
  - Tailwind is compiled via PostCSS (`postcss.config.js`, `tailwind.config.js`).
- Preview: `npm run preview`

## Deploy (GitHub Pages)

- On push to `main`, GitHub Actions builds and deploys `dist/` to the `gh-pages` branch, creating `.env.production` from the `VITE_SHEETS_ID` secret.
 - On push to `main`, GitHub Actions builds and deploys `dist/` to the `gh-pages` branch, injecting `VITE_SHEETS_ID` into the build.
 
### Troubleshooting
 - Dev banner says missing ID: create `.env.local` with `VITE_SHEETS_ID=...` and restart `npm run dev`.
 - Blank page in Pages: check Actions logs to confirm `VITE_SHEETS_ID` secret is present.
- Vite base is set to `/migration-hub-ui/`.

## Routes

- `#/dashboard-owner`
- `#/migrations`
- `#/details/:migrationId`
- `#/remapping`
- `#/communication`
 - `#/reports`

## Notes

- The UI gracefully falls back to sample data when `APPS_SCRIPT_API_URL` is empty.
- If `APPS_SCRIPT_API_URL` is set and a network error occurs, the app fails loudly (errors in console and UI).
