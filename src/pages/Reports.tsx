import React, { useEffect, useMemo, useState, Suspense } from 'react'
import { useAuth } from '../state/AuthContext'
import { safeGetRows, getDistinct, getCell } from '../lib/sheets'
import { ZMigrationRow, ZStagePerfRow, ZReportsSummaryRow, ZStagePerformanceRow, ZEngVCustTimeRow, type MigrationRow, type StagePerfRow, type ReportsSummaryRow, type StagePerformanceRow, type EngVCustTimeRow } from '../lib/schema'
import { getSLA } from '../lib/stageThresholds'
import { isValidOwner, isActive, isBehind, mean } from '../lib/reportsMath'
import { resolveBtcScope } from '../lib/btcScope'
import { getComponentConfig } from '../config/index'
import KpiCard from '../components/reports/KpiCard'
import BtcFilter from '../components/reports/BtcFilter'
import WorkloadByBtcMatrix from '../components/reports/WorkloadByBtcMatrix'
import StagePerformanceSidebar from '../components/reports/StagePerformanceSidebar'
import { RouteErrorBoundary } from '../components/common/RouteErrorBoundary'
import Card from '../components/Card.jsx'

// Helper to safely extract a number from various formats (number, string, percent string)
function getNumber(val: unknown): number | null {
  if (val == null) return null
  if (typeof val === 'number' && Number.isFinite(val)) return val
  if (typeof val === 'string') {
    // Accept numeric strings or percent-like strings, e.g. "0.45", "45%", " 0.45098 "
    const s = val.trim()
    if (s.endsWith('%')) {
      const n = Number(s.slice(0, -1))
      return Number.isFinite(n) ? n / 100 : null // convert "45%" -> 0.45
    }
    const n = Number(s)
    return Number.isFinite(n) ? n : null // "0.45" -> 0.45
  }
  return null
}

function ReportsPageContent() {
  const { authed } = useAuth()
  const [migrationRows, setMigrationRows] = useState<MigrationRow[]>([])
  const [reportsSummary, setReportsSummary] = useState<ReportsSummaryRow[]>([])
  const [stagePerformance, setStagePerformance] = useState<StagePerformanceRow[]>([])
  const [engVCustTime, setEngVCustTime] = useState<EngVCustTimeRow[]>([])
  const [slaOverrides, setSlaOverrides] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [btcFilter, setBtcFilter] = useState<string>('all')
  
  // Resolve BTC scope for queries - normalize "All BTCs" variants to "All"
  const scope = useMemo(() => {
    const resolved = resolveBtcScope(btcFilter)
    console.log('[Reports] BTC filter changed:', { btcFilter, resolvedScope: resolved })
    return resolved
  }, [btcFilter])

  // Get distinct BTCs from reports summary (includes "All" row)
  const btcs = useMemo(() => {
    const btcSet = new Set<string>()
    for (const row of reportsSummary) {
      if (row.BTC && row.BTC.trim()) {
        const btc = row.BTC.trim()
        // Skip "All" from the dropdown options (it's handled separately)
        if (btc.toLowerCase() !== 'all') {
          btcSet.add(btc)
        }
      }
    }
    return Array.from(btcSet).sort((a, b) => a.localeCompare(b))
  }, [reportsSummary])

  // Build SLA function with overrides
  const getSLAWithOverrides = useMemo(() => {
    return (stage: string) => getSLA(stage, slaOverrides)
  }, [slaOverrides])

  // Get current KPI row from Rpt_ReportsSummary based on normalized BTC scope
  // This same row is used for ALL three KPIs (Active, Behind%, Avg Days per Migration)
  const currentKpiRow = useMemo(() => {
    return reportsSummary.find((r) => r?.BTC === scope) ?? null
  }, [reportsSummary, scope])

  // Debug logging: log the resolved row object in development (once per currentKpiRow change)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((import.meta as any).env?.MODE !== 'production') {
      // Log scope and row keys for debugging
      console.log('[Rpt_ReportsSummary row] scope=', scope, currentKpiRow ? Object.keys(currentKpiRow) : null, currentKpiRow)
      if (currentKpiRow) {
        console.log('[Rpt_ReportsSummary] BehindPercent value:', currentKpiRow.BehindPercent, 'type:', typeof currentKpiRow.BehindPercent)
        console.log('[Rpt_ReportsSummary] All rows:', reportsSummary.map(r => ({ BTC: r.BTC, BehindPercent: r.BehindPercent })))
      } else {
        console.warn('[Rpt_ReportsSummary] No row found for scope:', scope, 'Available BTCs:', reportsSummary.map(r => r.BTC))
      }
    }
  }, [currentKpiRow, scope, reportsSummary])

  // Compute ALL KPIs from the SAME currentKpiRow object
  const kpis = useMemo(() => {
    if (!currentKpiRow) {
      return {
        Active: 0,
        BehindPct: 0,
        AvgDaysPerMigration: '--' as number | string,
      }
    }

    // Active - use the same row
    const active = Number(currentKpiRow?.ActiveCount ?? 0) || 0

    // BehindPercent MUST come from the sheet's BehindPercent (0..1)
    // Accept number or numeric string. If missing, as a last resort compute BehindCount/ActiveCount.
    const rawBP = currentKpiRow?.BehindPercent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((import.meta as any).env?.MODE !== 'production') {
      console.log('[KPI calc] rawBP:', rawBP, 'type:', typeof rawBP, 'isFinite:', Number.isFinite(rawBP))
    }
    let behind0to1 = (typeof rawBP === 'number' && Number.isFinite(rawBP)) 
      ? rawBP 
      : (typeof rawBP === 'string' ? Number(rawBP) : NaN)
    
    if (!Number.isFinite(behind0to1)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((import.meta as any).env?.MODE !== 'production') {
        console.warn('[KPI calc] BehindPercent not finite, falling back to BehindCount/ActiveCount')
      }
      const bc = Number(currentKpiRow?.BehindCount ?? 0)
      const ac = Number(currentKpiRow?.ActiveCount ?? 0)
      behind0to1 = (ac > 0) ? bc / ac : 0
    }
    // final percent value is 0–100 for display
    const behindPct = behind0to1 * 100
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((import.meta as any).env?.MODE !== 'production') {
      console.log('[KPI calc] behind0to1:', behind0to1, 'behindPct:', behindPct)
    }

    // Avg Days per Migration (leave as is, sourced from sheet)
    const avgDays = currentKpiRow.AvgDaysPerMigration != null 
      ? currentKpiRow.AvgDaysPerMigration 
      : ('N/A' as string)

    return {
      Active: active,
      BehindPct: behindPct, // 0-100 range, ready for display
      AvgDaysPerMigration: avgDays,
    }
  }, [currentKpiRow])

  // Filter stage performance by normalized BTC scope (exact match)
  const filteredStagePerformance = useMemo(() => {
    return stagePerformance.filter((r) => r?.BTC === scope)
  }, [stagePerformance, scope])

  // Helper function to parse filter_key and apply filters to data
  // Supports patterns like:
  // - "BTC={{reports_btc_filter}}"
  // - "Responsibility=Customer-owned Stages;BTC={{reports_btc_filter}}"
  const applyFilter = useMemo(() => {
    return <T extends Record<string, any>>(
      rows: T[],
      filterKey: string | undefined,
      filterValues: Record<string, string>
    ): T[] => {
      if (!filterKey || rows.length === 0) return rows

      // Replace template variables like {{reports_btc_filter}} with actual values
      let resolvedFilterKey = filterKey
      for (const [key, value] of Object.entries(filterValues)) {
        resolvedFilterKey = resolvedFilterKey.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
      }

      // Parse filter_key: can be "column=value" or "column1=value1;column2=value2"
      const filterConditions = resolvedFilterKey.split(';').map(cond => cond.trim()).filter(Boolean)
      
      return rows.filter((row) => {
        return filterConditions.every((condition) => {
          // Handle simple column name (e.g., "BTC" means filter by BTC column value)
          if (!condition.includes('=')) {
            const columnName = condition.trim()
            const filterValue = filterValues[columnName] || condition
            const rowValue = String(row[columnName] || '').trim()
            return rowValue.toLowerCase() === filterValue.toLowerCase()
          }
          
          // Handle "column=value" format
          const [columnName, expectedValue] = condition.split('=').map(s => s.trim())
          const rowValue = String(row[columnName] || '').trim()
          return rowValue.toLowerCase() === expectedValue.toLowerCase()
        })
      })
    }
  }, [])

  // Filter Rpt_EngVCustTime based on BTC filter using generic filter logic
  const filteredEngVCustTime = useMemo(() => {
    const tableConfig = getComponentConfig('reports_cust_vs_eng_table')
    if (!tableConfig?.filter_key) {
      console.log('[Rpt_EngVCustTime] No filter_key in config, showing all rows')
      return engVCustTime
    }

    const filterValues: Record<string, string> = {
      reports_btc_filter: scope,
    }

    const filtered = applyFilter(engVCustTime, tableConfig.filter_key, filterValues)
    console.log('[Rpt_EngVCustTime] Applied filter:', {
      filter_key: tableConfig.filter_key,
      scope,
      totalRows: engVCustTime.length,
      filteredRows: filtered.length,
      filteredData: filtered,
    })
    return filtered
  }, [engVCustTime, scope, applyFilter])

  // Compute Customer vs Eng Time KPIs from filtered Rpt_EngVCustTime
  // Uses component config to determine filter_key for each metric
  const custEngKpis = useMemo(() => {
    const customerConfig = getComponentConfig('reports_customer_avg_days')
    const engConfig = getComponentConfig('reports_eng_avg_days')

    const filterValues: Record<string, string> = {
      reports_btc_filter: scope,
    }

    // Find customer row using filter_key from config
    let customerRow: EngVCustTimeRow | undefined
    if (customerConfig?.filter_key) {
      const customerFiltered = applyFilter(engVCustTime, customerConfig.filter_key, filterValues)
      customerRow = customerFiltered[0] // Should be exactly one row
      console.log('[reports_customer_avg_days] Resolved row:', {
        filter_key: customerConfig.filter_key,
        scope,
        row: customerRow,
      })
    } else {
      // Fallback: find by Responsibility only
      customerRow = engVCustTime.find((r) => r?.Responsibility === 'Customer-owned Stages' && r?.BTC === scope)
    }

    // Find eng row using filter_key from config
    let engRow: EngVCustTimeRow | undefined
    if (engConfig?.filter_key) {
      const engFiltered = applyFilter(engVCustTime, engConfig.filter_key, filterValues)
      engRow = engFiltered[0] // Should be exactly one row
      console.log('[reports_eng_avg_days] Resolved row:', {
        filter_key: engConfig.filter_key,
        scope,
        row: engRow,
      })
    } else {
      // Fallback: find by Responsibility only
      engRow = engVCustTime.find((r) => r?.Responsibility === 'Engineering-owned Stages' && r?.BTC === scope)
    }

    return {
      customerAvgDays: customerRow ? Math.round(customerRow['Avg Days']) : 0,
      engAvgDays: engRow ? Math.round(engRow['Avg Days']) : 0,
    }
  }, [engVCustTime, scope, applyFilter])

  // Filter migration rows for workload heatmap (only if not using Rpt_WorkloadByBTC)
  const filteredRows = useMemo(() => {
    let filtered = migrationRows.filter((r) => isValidOwner(r.OwnerEmail))
    if (scope !== 'All') {
      filtered = filtered.filter(
        (r) => r.OwnerEmail?.trim().toLowerCase() === scope.toLowerCase()
      )
    }
    return filtered
  }, [migrationRows, scope])

  useEffect(() => {
    if (!authed) {
      setLoading(false)
      return
    }

    let active = true

    const loadData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Load all data concurrently with safe parsing and header synonyms
        const [migrationData, reportsSummaryData, stagePerformanceData, engVCustTimeData] = await Promise.all([
          safeGetRows<MigrationRow>('MH_View_Migrations', ZMigrationRow, {
            aliases: {
              OwnerEmail: ['Owner', 'BTC', 'Owner Email'],
              DaysInStage: ['Days In Stage'],
              Stage: ['Current Stage'],
            },
          }).catch((e) => {
            console.warn('[Reports] Error loading MH_View_Migrations:', e)
            return []
          }),
          safeGetRows<ReportsSummaryRow>('Rpt_ReportsSummary', ZReportsSummaryRow, {
            aliases: {
              BTC: ['BTC', 'OwnerEmail', 'Owner'],
            },
          }).then((data) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((import.meta as any).env?.MODE !== 'production' && data.length > 0) {
              console.log('[Rpt_ReportsSummary] Loaded', data.length, 'rows')
              console.log('[Rpt_ReportsSummary] First row keys:', Object.keys(data[0]))
              console.log('[Rpt_ReportsSummary] First row sample:', data[0])
              console.log('[Rpt_ReportsSummary] All BTCs and BehindPercent:', data.map(r => ({ BTC: r.BTC, BehindPercent: r.BehindPercent, BehindCount: r.BehindCount, ActiveCount: r.ActiveCount })))
            }
            return data
          }).catch((e) => {
            console.warn('[Reports] Error loading Rpt_ReportsSummary:', e)
            return []
          }),
          safeGetRows<StagePerformanceRow>('Rpt_StagePerformance', ZStagePerformanceRow, {
            aliases: {
              Stage: ['Stage', 'Stage Name'],
              BTC: ['BTC', 'OwnerEmail', 'Owner'],
              AvgDaysInStage: ['Avg Days in Stage (Live)', 'Avg Days in Stage', 'AvgDaysInStage', 'Average Days in Stage'],
            },
            caseInsensitiveTabs: true,
          }).catch((e) => {
            console.warn('[Reports] Error loading Rpt_StagePerformance:', e)
            return []
          }),
          safeGetRows<EngVCustTimeRow>('Rpt_EngVCustTime', ZEngVCustTimeRow, {
            aliases: {
              Responsibility: ['Responsibility', 'Stage Type', 'Type'],
              BTC: ['BTC', 'OwnerEmail', 'Owner'],
              'Avg Days': ['Avg Days', 'AvgDays', 'Average Days', 'AverageDays'],
            },
          }).then((data) => {
            console.log('[Rpt_EngVCustTime] Loaded', data.length, 'rows')
            if (data.length > 0) {
              console.log('[Rpt_EngVCustTime] First row keys:', Object.keys(data[0]))
              console.log('[Rpt_EngVCustTime] Sample rows:', data.slice(0, 5))
            }
            return data
          }).catch((e) => {
            console.warn('[Reports] Error loading Rpt_EngVCustTime:', e)
            return []
          }),
        ])

        if (!active) return

        setMigrationRows(migrationData)
        setReportsSummary(reportsSummaryData)
        setStagePerformance(stagePerformanceData)
        setEngVCustTime(engVCustTimeData)
      } catch (e: any) {
        if (!active) return
        const msg = String(e?.message || e)
        console.error('[Reports] Error loading data:', msg)
        if (/401/.test(msg) || /Not authenticated/i.test(msg)) {
          setError('Reports unavailable (auth). Try Sign in again.')
        } else {
          setError(msg)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      active = false
    }
  }, [authed])

  if (!authed) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="mb-4 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <div className="font-medium mb-1">Reports unavailable (auth)</div>
            <div className="text-sm">Try Sign in again</div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[#1B1630]">Reports</h2>
        <BtcFilter
          value={btcFilter}
          options={btcs}
          onChange={setBtcFilter}
          loading={loading}
        />
      </div>

      {/* Error banner */}
      {error && (
        <Card className="p-4">
          <div className="text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm">
            {error}{' '}
            <button onClick={() => window.location.reload()} className="underline">
              Retry
            </button>
          </div>
        </Card>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Active"
          value={kpis.Active}
          loading={loading}
        />
        <KpiCard
          label="Behind %"
          value={`${Math.round(kpis.BehindPct)}%`}
          loading={loading}
        />
        <KpiCard
          label="Avg Days per Migration"
          value={typeof kpis.AvgDaysPerMigration === 'number' ? Math.round(kpis.AvgDaysPerMigration) : (kpis.AvgDaysPerMigration || 'N/A')}
          loading={loading}
        />
      </div>

      {/* Customer vs Eng Time KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          label="Customer-owned Stages — Avg Days"
          value={custEngKpis.customerAvgDays}
          loading={loading}
        />
        <KpiCard
          label="Engineering-owned Stages — Avg Days"
          value={custEngKpis.engAvgDays}
          loading={loading}
        />
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <WorkloadByBtcMatrix
            rows={filteredRows}
            getSLA={getSLAWithOverrides}
            slaOverrides={slaOverrides}
            loading={loading}
          />
        </div>
        <div className="lg:col-span-1">
          <StagePerformanceSidebar stagePerf={filteredStagePerformance} loading={loading} />
        </div>
      </div>
    </div>
  )
}

export default function Reports() {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={
        <div className="space-y-6">
          <div className="h-8 bg-[#E3D7E8] rounded w-32 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4 md:p-6 animate-pulse">
                <div className="h-4 bg-[#E3D7E8] rounded w-1/3 mb-2" />
                <div className="h-8 bg-[#E3D7E8] rounded w-1/4" />
              </Card>
            ))}
          </div>
        </div>
      }>
        <ReportsPageContent />
      </Suspense>
    </RouteErrorBoundary>
  )
}

