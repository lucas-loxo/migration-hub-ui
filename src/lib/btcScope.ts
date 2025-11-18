// [MH-AI] BTC scope resolution helper
// Resolves BTC filter value to the appropriate BTC identifier for querying report tabs

/**
 * Resolves a BTC filter value to the BTC identifier used in report tabs.
 * Centralized resolver that normalizes UI labels to backend keys.
 * 
 * @param selected - The value from the BTC filter dropdown (e.g., "all", "All BTCs", "user@example.com")
 * @returns The BTC identifier to use in queries:
 *   - "All" when filter is "all" or any variant of "all btcs"
 *   - The specific email (trimmed) otherwise
 */
export function resolveBtcScope(selected: unknown): string {
  if (selected == null) return 'All'
  
  const s = String(selected).trim()
  
  // Map UI label variants to the backend key "All"
  const normalized = s.toLowerCase()
  if (
    normalized === 'all' ||
    normalized === 'all btcs' ||
    normalized === 'all btc' ||
    normalized === 'all owners'
  ) {
    return 'All'
  }
  
  // Return the trimmed value (email)
  return s
}

/**
 * Checks if a BTC scope represents "All BTCs"
 */
export function isAllBtcScope(btcScope: string): boolean {
  return btcScope === 'All' || btcScope.toLowerCase() === 'all'
}

