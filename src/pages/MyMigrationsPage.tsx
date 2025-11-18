import React, { useEffect, useMemo, useRef, useState } from 'react'
import Card from '../components/Card.jsx'
import DataTable from '../components/DataTable.jsx'
import { fetchViewMigrations, type ViewMigration } from '../lib/sheets'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'
import { usePermissions } from '../state/usePermissions'
import { toSearch } from '../lib/url'
import NewMigrationModal from '../components/migrations/NewMigrationModal'
// [MH-AI]
import { getComponentConfig, COMPONENTS_CONFIG } from '../config/index'
import { isValidSheetTab } from '../config/sheetMapping'

const STAGE_ORDER = [
  'Waiting on Data Upload',
  'Waiting on Eng Import Map',
  'Waiting on Customer Import Map',
  'Waiting on Data Import',
  'Waiting on Validation Requests',
  'Waiting on Eng Validation',
  'Waiting on Final Confirmation',
  'Waiting on Duplicate Merge',
  'Complete',
] as const
const STAGE_RANK: Record<string, number> = Object.fromEntries(STAGE_ORDER.map((s, i) => [s, i])) as Record<string, number>
const CARD_MAP = [
  { label: 'Upload', stage: 'Waiting on Data Upload' },
  { label: 'Eng Map', stage: 'Waiting on Eng Import Map' },
  { label: 'Cust Map', stage: 'Waiting on Customer Import Map' },
  { label: 'Import', stage: 'Waiting on Data Import' },
  { label: 'Val Req', stage: 'Waiting on Validation Requests' },
  { label: 'Eng Val', stage: 'Waiting on Eng Validation' },
  { label: 'Final Conf', stage: 'Waiting on Final Confirmation' },
  { label: 'Dup Merge', stage: 'Waiting on Duplicate Merge' },
  { label: 'Complete', stage: 'Complete' },
] as const

export default function MyMigrationsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { userEmail } = useAuth()
  const { isEditor } = usePermissions()
  
  // [MH-AI] Load config for owner_migrations_table and overdue_migrations
  const ownerMigrationsConfig = getComponentConfig('owner_migrations_table')
  const overdueMigrationsConfig = getComponentConfig('overdue_migrations')
  const nextUpToggleConfig = getComponentConfig('next_up_toggle')
  
  // Parse query params safely
  const query = useMemo(() => new URLSearchParams(location.search || ''), [location.search])
  const ownerQ = query.get('owner') ?? ''
  const stageQ = query.get('stage') ?? ''
  
  const [allRows, setAllRows] = useState<ViewMigration[]>([])
  const [mainTableRows, setMainTableRows] = useState<ViewMigration[]>([]) // Always from MH_View_Migrations for stage counts
  const [viewNextUp, setViewNextUp] = useState(false)
  const [q, setQ] = useState('')
  const [selectedStage, setSelectedStage] = useState<string>(stageQ)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newMigrationOpen, setNewMigrationOpen] = useState(false)
  const ownerFilterInitialized = useRef(false)

  // Always load main table data from MH_View_Migrations (for stage counts and owner list)
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const sheetTab = ownerMigrationsConfig?.sheet_tab || 'MH_View_Migrations'
        const range = ownerMigrationsConfig?.range || 'A:Z'
        
        if (sheetTab && !isValidSheetTab(sheetTab)) {
          throw new Error(`Invalid sheet_tab in component config: "${sheetTab}"`)
        }
        
        const { rows: data } = await fetchViewMigrations({ sheetTab, range })
        if (!active) return
        setMainTableRows((data ?? []).filter(Boolean))
      } catch (e: any) {
        console.warn('[MH-UI] Failed to load main table data:', e)
      }
    })()
    return () => { active = false }
  }, [ownerMigrationsConfig])

  // Load table data based on viewNextUp: main table uses MH_View_Migrations, Behind/Next Up uses Rpt_BehindMigrations
  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        // When viewNextUp is true, load from Rpt_BehindMigrations; otherwise use main table data
        if (viewNextUp) {
          const sheetTab = overdueMigrationsConfig?.sheet_tab || 'Rpt_BehindMigrations'
          const range = overdueMigrationsConfig?.range || 'A:Z'
          
          if (sheetTab && !isValidSheetTab(sheetTab)) {
            throw new Error(`Invalid sheet_tab in component config: "${sheetTab}"`)
          }
          
          const { rows: data } = await fetchViewMigrations({ sheetTab, range })
          if (!active) return
          setAllRows((data ?? []).filter(Boolean))
        } else {
          // Use main table data (already loaded)
          setAllRows(mainTableRows)
        }
      } catch (e: any) {
        console.warn('[MH-UI]', e)
        setError(String(e?.message || 'Failed to load'))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [viewNextUp, mainTableRows, overdueMigrationsConfig])

  const baseRows = useMemo(() => (allRows ?? []).filter(Boolean), [allRows])

  // Build distinct owner list from main table data (always from MH_View_Migrations)
  const owners = useMemo(() => {
    const mainRowsFiltered = (mainTableRows ?? []).filter(Boolean)
    const ownerSet = new Set<string>()
    for (const r of mainRowsFiltered) {
      const email = (r?.OwnerEmail ?? '').trim()
      if (email.length > 0) {
        ownerSet.add(email.toLowerCase())
      }
    }
    return Array.from(ownerSet).sort((a, b) => a.localeCompare(b))
  }, [mainTableRows])

  // Initialize owner filter from URL or default to user email if present
  const [ownerFilter, setOwnerFilter] = useState<string>(() => {
    if (ownerQ) {
      return ownerQ.toLowerCase()
    }
    return 'all'
  })
  
  // Initialize owner filter from URL or user email on first data load
  useEffect(() => {
    if (owners.length === 0 || ownerFilterInitialized.current) return
    if (ownerQ) {
      const normalized = ownerQ.toLowerCase()
      if (normalized === 'all' || owners.includes(normalized)) {
        if (ownerFilter !== normalized) {
          setOwnerFilter(normalized)
        }
        ownerFilterInitialized.current = true
        return
      }
    }
    // If no URL param, check if user email exists in data
    if (userEmail && !ownerQ) {
      const userEmailLower = userEmail.toLowerCase()
      if (owners.includes(userEmailLower)) {
        setOwnerFilter(userEmailLower)
        navigate({ search: toSearch({ owner: userEmailLower }) }, { replace: true })
        ownerFilterInitialized.current = true
        return
      }
    }
    // Default to 'all' if no URL param and user email not in data
    if (!ownerQ && ownerFilter === 'all') {
      ownerFilterInitialized.current = true
    }
  }, [owners.length, userEmail, ownerQ, ownerFilter, navigate])

  // Sync owner filter when URL changes (e.g., browser back/forward)
  useEffect(() => {
    if (!ownerFilterInitialized.current || owners.length === 0) return
    if (ownerQ) {
      const normalized = ownerQ.toLowerCase()
      if (normalized === 'all' || owners.includes(normalized)) {
        if (ownerFilter !== normalized) {
          setOwnerFilter(normalized)
        }
      }
    } else if (ownerFilter !== 'all') {
      setOwnerFilter('all')
    }
  }, [ownerQ, owners, ownerFilter]) // Only sync when URL changes after initialization

  // Sync stage filter when URL changes
  useEffect(() => {
    if (stageQ !== selectedStage) {
      setSelectedStage(stageQ)
    }
  }, [stageQ, selectedStage])

  // Apply owner filter to baseRows (current table data - either MH_View_Migrations or Rpt_BehindMigrations)
  const filteredRows = useMemo(() => {
    const selected = (ownerFilter || 'all').toLowerCase()
    if (selected === 'all') {
      return baseRows
    }
    return baseRows.filter((r) => {
      const rowEmail = (r?.OwnerEmail ?? '').toLowerCase().trim()
      return rowEmail === selected
    })
  }, [baseRows, ownerFilter])

  // Stage counts should always use main table data (MH_View_Migrations), not filtered by Behind status
  const mainTableFilteredRows = useMemo(() => {
    const selected = (ownerFilter || 'all').toLowerCase()
    if (selected === 'all') {
      return mainTableRows
    }
    return mainTableRows.filter((r) => {
      const rowEmail = (r?.OwnerEmail ?? '').toLowerCase().trim()
      return rowEmail === selected
    })
  }, [mainTableRows, ownerFilter])

  const scoped = useMemo(() => {
    let data = filteredRows
    // Optional stage filter (user-selected)
    if (selectedStage) {
      data = data.filter((r) => r.Stage === selectedStage)
    }
    // Note: When viewNextUp is true, data is already loaded from Rpt_BehindMigrations (Is_Behind = TRUE)
    // No need to filter by Status here - the source sheet already contains only behind migrations
    const needle = q.trim().toLowerCase()
    if (needle) {
      // Search by MigrationID (primary), CustomerName, or CustomerID
      data = data.filter((r) => 
        (r.MigrationID || '').toLowerCase().includes(needle) ||
        r.CustomerName.toLowerCase().includes(needle) || 
        (r.CustomerID || '').toLowerCase().includes(needle)
      )
    }
    return data
  }, [filteredRows, q, selectedStage])

  // Stage counts always use main table data (all migrations, not filtered by Behind)
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    STAGE_ORDER.forEach((s) => (counts[s] = 0))
    for (const r of mainTableFilteredRows) {
      if (counts[r.Stage] != null) counts[r.Stage]++
    }
    return counts
  }, [mainTableFilteredRows])

  // Handle owner filter change
  const handleOwnerFilterChange = (value: string) => {
    const normalized = value.toLowerCase()
    setOwnerFilter(normalized)
    const search = toSearch({ 
      owner: normalized !== 'all' ? normalized : undefined,
      stage: selectedStage || undefined
    })
    navigate({ search }, { replace: true })
  }

  const hasRows = scoped.length > 0

  // Fixed column widths for consistent layout
  const columns = [
    { 
      id: 'CustomerName', 
      header: 'CustomerName', 
      width: '35%',
      sortable: true, 
      cell: (v: string) => (<span className="truncate block">{v}</span>) 
    },
    { 
      id: 'Stage', 
      header: (
        <div className="flex items-center gap-2">
          <span>Stage</span>
          <select
            value={selectedStage}
            onChange={(e) => {
              const newStage = e.target.value
              setSelectedStage(newStage)
              const search = toSearch({ 
                owner: ownerFilter !== 'all' ? ownerFilter : undefined,
                stage: newStage || undefined
              })
              navigate({ search }, { replace: true })
            }}
            onClick={(e) => e.stopPropagation()}
            className="rounded-md border-gray-300 text-xs"
          >
            <option value="">All Stages</option>
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      ), 
      width: '25%',
      sortable: true, 
      sortValue: (row: ViewMigration) => (STAGE_RANK[row.Stage] ?? Number.POSITIVE_INFINITY) 
    },
    { 
      id: 'DaysInStage', 
      header: 'DaysInStage', 
      width: '10%',
      sortable: true 
    },
    { 
      id: 'Status', 
      header: 'Status', 
      width: '15%',
      sortable: true, 
      cell: (v: string) => (
        <span className={v === 'Behind' ? 'text-rose-600 font-medium' : 'text-slate-600'}>{v}</span>
      ) 
    },
    { 
      id: 'OwnerEmail', 
      header: 'OwnerEmail', 
      width: '15%',
      sortable: true, 
      cell: (_: string, row: ViewMigration) => (<span className="truncate block">{row?.OwnerEmail ?? '—'}</span>) 
    },
  ]

  const handleNewMigrationSuccess = () => {
    // Refresh both main table data and current view data
    setLoading(true)
    const mainSheetTab = ownerMigrationsConfig?.sheet_tab || 'MH_View_Migrations'
    const mainRange = ownerMigrationsConfig?.range || 'A:Z'
    
    // Reload main table data
    fetchViewMigrations({ sheetTab: mainSheetTab, range: mainRange })
      .then(({ rows: data }) => {
        setMainTableRows((data ?? []).filter(Boolean))
        // If not in viewNextUp mode, also update current table data
        if (!viewNextUp) {
          setAllRows((data ?? []).filter(Boolean))
        }
      })
      .catch((e: any) => {
        console.warn('[MH-UI] Failed to reload main table:', e)
      })
    
    // If in viewNextUp mode, also reload behind migrations
    if (viewNextUp) {
      const behindSheetTab = overdueMigrationsConfig?.sheet_tab || 'Rpt_BehindMigrations'
      const behindRange = overdueMigrationsConfig?.range || 'A:Z'
      fetchViewMigrations({ sheetTab: behindSheetTab, range: behindRange })
        .then(({ rows: data }) => {
          setAllRows((data ?? []).filter(Boolean))
        })
        .catch((e: any) => {
          console.warn('[MH-UI] Failed to reload behind migrations:', e)
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setNewMigrationOpen(true)}
          disabled={!isEditor}
          title={!isEditor ? "Read-only access. Contact Lucas if you need edit permissions." : undefined}
          className={`rounded-md px-4 py-2 text-sm font-medium flex items-center gap-2 whitespace-nowrap ${
            isEditor
              ? 'bg-slate-900 text-white hover:bg-slate-800'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <span>+</span>
          <span>New Migration</span>
        </button>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          className="w-full md:w-96 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-800 placeholder:text-gray-400"
        />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <label htmlFor="owner-filter" className="text-sm text-gray-700 whitespace-nowrap">Owner:</label>
            <select
              id="owner-filter"
              value={ownerFilter}
              onChange={(e) => handleOwnerFilterChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="rounded-md border-gray-300 text-xs px-2 py-1.5 border"
            >
              <option value="all">All</option>
              {owners.map((email) => (
                <option key={email} value={email}>{email}</option>
              ))}
            </select>
          </div>
          <button type="button" onClick={() => setViewNextUp(true)} className={`rounded-md border px-3 py-1.5 text-sm ${viewNextUp ? 'bg-slate-900 text-white' : 'bg-white'}`}>{nextUpToggleConfig?.label || 'Behind'}</button>
          <button type="button" onClick={() => setViewNextUp(false)} className={`rounded-md border px-3 py-1.5 text-sm ${!viewNextUp ? 'bg-slate-900 text-white' : 'bg-white'}`}>All My Migrations</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-9 gap-3">
        {CARD_MAP.map((card) => (
          <div key={card.stage} className="text-left bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow transition">
            <div className="text-xs text-slate-500 mb-1">{card.label}</div>
            <div className="text-2xl font-semibold text-slate-900">{stageCounts[card.stage] || 0}</div>
          </div>
        ))}
      </div>

      <Card className="p-4">
        {error && (
          error === 'MH_View_Migrations not found' || error.startsWith('HEADERS_MISSING') ? (
            <div className="mb-3 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-sm">
              <div className="font-medium mb-1">Sheet mapping error</div>
              <div>Expected headers: MigrationID, CustomerID, CustomerName, Stage, DaysInStage, OwnerEmail (Status is derived from Is_Behind)</div>
              {error.startsWith('HEADERS_MISSING') && (() => {
                const m = /missing=([^|]+)\|found=(.*)$/.exec(error)
                const miss = m && m[1] ? m[1].split(',') : []
                const found = m && m[2] ? m[2].split(',') : []
                return (
                  <div className="mt-1">
                    <div>Missing: {miss.join(', ') || '—'}</div>
                    <div>Found: {found.join(', ') || '—'}</div>
                  </div>
                )
              })()}
              <a className="text-sky-700 underline" href="https://docs.google.com/spreadsheets/d/1aSy-ypUF95hLmQkIsKmqnD0RMJ4AQ-rCHdeg7OXSj4k/edit" target="_blank" rel="noreferrer">Open Sheet</a>
            </div>
          ) : (
            <div className="mb-3 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-sm">{error}</div>
          )
        )}
        <div className="mb-3" />
        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
                <div className="h-4 bg-slate-200 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : !hasRows ? (
          <div className="p-6 text-center text-slate-500">{viewNextUp ? "You're all caught up." : 'No results'}</div>
        ) : (
          <DataTable
            columns={columns as any}
            data={(scoped ?? []).filter(Boolean) as any}
            defaultSort={undefined}
            // Migrations are uniquely identified by MigrationID (M-XXXX). CustomerID is not unique because a customer may have multiple migrations (e.g., second passes).
            onRowClick={(row: any) => row?.MigrationID && navigate(`/migrations/${row.MigrationID}`)}
            rowAction={undefined}
            stickyHeader
            zebra
            rowKey={(r: any) => r?.MigrationID || Math.random().toString(36).slice(2)}
          />
        )}
      </Card>
      
      <NewMigrationModal
        open={newMigrationOpen}
        onClose={() => setNewMigrationOpen(false)}
        onSuccess={handleNewMigrationSuccess}
        existingOwners={owners}
      />
    </div>
  )
}


