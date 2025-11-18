/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHEETS_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}


