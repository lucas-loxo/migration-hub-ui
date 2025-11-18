<!-- AUTO-GENERATED: Cursor DevOps Layer v1 -->

# Build Rules — Architectural Guardrails

1) We build for permanence — no temporary hacks or short-term patches.
2) Each UI surface must map explicitly to a Sheets tab with a stable schema.
3) Never use column indices/letters — resolve by header names only.
4) Only one source of truth per entity (Migrations, Customers, Owners, Activities, Reports).
5) Do not rewire auth, routing, or Sheets API structure without explicit instruction.
6) For every new UI feature, record a short “why it exists” rule here.

## Feature Rules (living list)
- My Migrations: Reads only `MH_View_Migrations` by header, scopes to OwnerEmail, and provides Stage filtering/sorting.
- Stage Dropdown: Stage header embeds a dropdown; filtering composes with search and status.
- Owner Scope: OwnerEmail token matching is robust (comma/semicolon, case-insensitive).


