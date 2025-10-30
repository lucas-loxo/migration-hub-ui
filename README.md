# Migration Hub UI

Vite + React SPA using Tailwind, Chart.js, and HashRouter. Deploys automatically to GitHub Pages via `gh-pages` branch.

## Configure API

Edit `src/lib/config.js` and set:

```js
export const APPS_SCRIPT_API_URL = ""; // fill later with https://script.google.com/macros/s/.../exec
```

- Leave empty to use built-in sample data.
- When set, the app will call your Apps Script web app endpoints:
  - GET `${APPS_SCRIPT_API_URL}?action=getMigrations`
  - GET `${APPS_SCRIPT_API_URL}?action=getStagePerformance`
  - POST `${APPS_SCRIPT_API_URL}?action=updateMigrationStatus` with JSON body `{ migrationId, newStageOrStatus }`

## Development

- Install deps: `npm install`
- Start dev server: `npm run dev`
  - Tailwind is loaded via CDN in dev for zero-config styling.

## Build

- `npm run build`
  - Tailwind is compiled via PostCSS (`postcss.config.js`, `tailwind.config.js`).
- Preview: `npm run preview`

## Deploy (GitHub Pages)

- On push to `main`, GitHub Actions builds and deploys `dist/` to the `gh-pages` branch.
- Vite base is set to `/migration-hub-ui/`.

## Routes

- `#/dashboard-owner`
- `#/migrations`
- `#/details/:migrationId`
- `#/remapping`
- `#/communication`

## Notes

- The UI gracefully falls back to sample data when `APPS_SCRIPT_API_URL` is empty.
- If `APPS_SCRIPT_API_URL` is set and a network error occurs, the app fails loudly (errors in console and UI).
