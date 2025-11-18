export type MigrationRow = {
  CustomerID: string
  CustomerName: string
  Stage: string
  DaysInStage: number
  OwnerEmail: string
  TargetDueDate?: string | null
  CreatedAt?: string | null
  UpdatedAt?: string | null
  PrevATS?: string | null
  CZ_Link?: string | null
  GitHub_Link?: string | null
  PrimaryContactName?: string | null
  PrimaryContactEmail?: string | null
  PrimaryContactPhone?: string | null
}

export type StagePerfRow = {
  Stage: string
  AvgDaysInStage: number
}

export type ReportSummaryRow = {
  Active: number
  Behind: number
  BehindPct: number // 0–100
  AvgDaysPerMigration: number
}

