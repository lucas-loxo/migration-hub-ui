// Feature flags from environment
export const FEATURE_REPORTS = (import.meta as any).env?.VITE_FEATURE_REPORTS !== 'false'
export const STRICT_SCHEMAS = (import.meta as any).env?.VITE_STRICT_SCHEMAS === 'true'

