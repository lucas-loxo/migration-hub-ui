# Stability Checklist

Use this checklist before merging major features or pages.

## Pre-Merge Checklist

- [ ] Route error boundary present
- [ ] Zod schema coverage for new sheet tabs
- [ ] Empty-state verified (missing tabs/headers)
- [ ] Loading-state verified (skeleton loaders)
- [ ] One smoke test added for new feature
- [ ] No hard-coded column indices (always use header names)
- [ ] Graceful fallbacks for missing data
- [ ] Division by zero guards in calculations
- [ ] Console warnings for missing headers/tabs (not errors)

## Post-Merge Checklist

- [ ] Tag stable point (e.g., `git tag stable-reports-v1`)
- [ ] Verify in production (if applicable)
- [ ] Update documentation if needed

## Testing

- Run smoke tests: `pnpm smoke:reports` (if available)
- Run full test suite: `pnpm test`
- Run type check: `pnpm typecheck`

## Notes

- All sheet reads must use header names, not column letters
- Missing tabs should log warnings and render empty states
- Invalid rows should be skipped with warnings, not crash the app
- Route-level errors should not crash other routes

