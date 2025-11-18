// [MH-AI] Sheet tab name mapping for validation
// Maps sheet tab names to their identifiers (for validation and reference)
// Note: All tabs are in the same spreadsheet (VITE_SHEETS_ID)
// The gid (grid ID) is the tab's unique identifier within the spreadsheet

export interface SheetMapping {
  tabName: string;
  description?: string;
  // gid can be added if needed for direct API access
  // gid?: string;
}

// Valid sheet tabs in the Migration Hub backend spreadsheet
export const SHEET_MAPPING: SheetMapping[] = [
  {
    tabName: 'MH_View_Migrations',
    description: 'Canonical migration rows view',
  },
  {
    tabName: 'Rpt_StageMetrics',
    description: 'Stage + owner metrics (columns A:F)',
  },
  {
    tabName: 'Rpt_BehindMigrations',
    description: 'Is_Behind = TRUE subset of MH_View_Migrations',
  },
  {
    tabName: 'Rpt_ReportsSummary',
    description: 'KPI summary by BTC (Active, Behind%, AvgDaysPerMigration)',
  },
  {
    tabName: 'Rpt_StagePerformance',
    description: 'Per-stage performance metrics by BTC',
  },
  {
    tabName: 'Rpt_WorkloadByBTC',
    description: 'Workload heatmap by BTC and stage',
  },
  {
    tabName: 'Rpt_EngVCustTime',
    description: 'Customer vs Engineering time metrics',
  },
  {
    tabName: 'ComponentsConfig',
    description: 'Component configuration definitions',
  },
  {
    tabName: 'Owners',
    description: 'Owners lookup table',
  },
  {
    tabName: 'MH_EmailThreads',
    description: 'Email threads linked to migrations',
  },
  {
    tabName: 'MH_EmailMessages',
    description: 'Individual email messages within threads',
  },
  // Note: Some components have empty sheet_tab (e.g., toggle filters)
  // These are handled specially and don't require sheet mapping
];

// Helper to validate if a sheet tab name exists in the mapping
export function isValidSheetTab(tabName: string): boolean {
  return SHEET_MAPPING.some((m) => m.tabName === tabName);
}

// Get all valid sheet tab names
export function getValidSheetTabs(): string[] {
  return SHEET_MAPPING.map((m) => m.tabName);
}

