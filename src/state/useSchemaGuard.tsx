import { useEffect, useState } from 'react'
import { fetchHeader, getSettingsSchemaVersion } from '../lib/sheets'
import { SCHEMA_VERSION } from '../config/constants'

// Core schema tabs that require header validation
// Note: Status is derived from Is_Behind in MH_View_Migrations, not required as a column
const REQUIRED = {
  'MH_View_Migrations': ['MigrationID','CustomerID','CustomerName','PreviousATS','Seats','Segment','Owner','StartDate','GoLiveDate','Stage','DaysInStage','GitHubIssueURL'],
  Customers: ['CustomerID','CustomerName','Seats','Segment','SecondaryContactName','SecondaryContactEmail','CZLink'],
  Activities: ['ActivityID','MigrationID','Type','Summary','CreatedAt','ActorEmail','NewStage'],
  StageThresholds: ['Stage','BehindThresholdDays','ResponsibleParty'],
  Owners: ['OwnerEmail','OwnerName','OwnerRole'],
}

// Report tabs that exist but don't require strict header validation
// These are validated via sheetMapping.ts instead
const REPORT_TABS = ['Rpt_StageMetrics', 'Rpt_BehindMigrations']

function compareHeaders(actual: string[], expected: string[]) {
  const missing = expected.filter((h) => !actual.includes(h))
  const extra = actual.filter((h) => h && !expected.includes(h))
  const orderOk = expected.every((h, i) => actual[i] === h)
  return { missing, extra, orderOk }
}

export function useSchemaGuard() {
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [sourceTabName] = useState('MH_View_Migrations')
  const [schemaVersionFound, setSchemaVersionFound] = useState<string | undefined>(undefined)

  useEffect(() => {
    let active = true
    ;(async () => {
      const errs: string[] = []
      try {
        const version = await getSettingsSchemaVersion()
        setSchemaVersionFound(version)
        if (version && version !== SCHEMA_VERSION) {
          errs.push(`Schema version mismatch. App=${SCHEMA_VERSION}, Sheet=${version}.`)
        }
        for (const [tab, expected] of Object.entries(REQUIRED)) {
          const header = await fetchHeader(tab)
          if (!header || header.length === 0) {
            errs.push(`${tab} sheet is missing or unreadable.`)
            continue
          }
          const { missing, extra, orderOk } = compareHeaders(header, expected)
          if (missing.length || !orderOk || extra.length) {
            errs.push(`${tab} malformed. Expected: [${expected.join(', ')}]; Actual: [${header.join(', ')}]; Missing: [${missing.join(', ')}].`)
          }
        }
      } catch (e) {
        errs.push(e instanceof Error ? e.message : 'Schema validation failed')
      } finally {
        if (active) setErrors(errs)
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  const ok = !loading && errors.length === 0
  return { loading, ok, errors, sourceTabName, schemaVersionFound }
}


