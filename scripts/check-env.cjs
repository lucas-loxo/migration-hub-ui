const id = process.env.VITE_SHEETS_ID
if (!id) {
  console.error('\n[Build Error] VITE_SHEETS_ID is not set.\n- For local: create .env.local with VITE_SHEETS_ID=...\n- For GitHub Pages: add repo secret VITE_SHEETS_ID.\n')
  process.exit(1)
}


