// Manual schema validation (Zod-compatible interface)
type Validator<T> = {
  parse: (data: any) => T
}

function createValidator<T>(parseFn: (data: any) => T): Validator<T> {
  return { parse: parseFn }
}

function string(): Validator<string> {
  return createValidator((v: any) => String(v ?? ''))
}

function number(): Validator<number> {
  return createValidator((v: any) => {
    const num = Number(v)
    return Number.isFinite(num) ? num : 0
  })
}

function coerceNumber(): Validator<number> {
  return createValidator((v: any) => {
    const num = Number(v)
    return Number.isFinite(num) ? num : 0
  })
}

function coerceNumberDefault(defaultVal: number): Validator<number> {
  return createValidator((v: any) => {
    if (v == null || v === '') return defaultVal
    const num = Number(v)
    return Number.isFinite(num) ? num : defaultVal
  })
}

function nullable<T>(validator: Validator<T>): Validator<T | null> {
  return createValidator((v: any) => {
    if (v == null || v === '') return null
    return validator.parse(v)
  })
}

function optional<T>(validator: Validator<T>): Validator<T | undefined> {
  return createValidator((v: any) => {
    if (v == null || v === '') return undefined
    return validator.parse(v)
  })
}

function object<T extends Record<string, any>>(shape: Record<keyof T, Validator<any>>): Validator<T> {
  return createValidator((data: any) => {
    const result: any = {}
    for (const [key, validator] of Object.entries(shape)) {
      try {
        result[key] = validator.parse(data[key])
      } catch (e) {
        // Skip invalid fields
      }
    }
    return result as T
  })
}

export const ZMigrationRow = object({
  CustomerID: string(),
  CustomerName: string(),
  Stage: string(),
  DaysInStage: coerceNumberDefault(0),
  OwnerEmail: string(),
  TargetDueDate: nullable(string()),
  CreatedAt: nullable(string()),
  UpdatedAt: nullable(string()),
  PrevATS: optional(nullable(string())),
  CZ_Link: optional(nullable(string())),
  GitHub_Link: optional(nullable(string())),
  PrimaryContactName: optional(nullable(string())),
  PrimaryContactEmail: optional(nullable(string())),
  PrimaryContactPhone: optional(nullable(string())),
})

export const ZStageMapRow = object({
  Stage: string(),
  SLA: coerceNumber(),
  Category: optional(string()),
})

export const ZReportSummaryRow = object({
  Active: coerceNumber(),
  Behind: coerceNumber(),
  BehindPct: coerceNumber(),
  AvgDaysPerMigration: coerceNumber(),
})

export const ZStagePerfRow = object({
  Stage: string(),
  AvgDaysInStage: coerceNumber(),
})

export const ZReportsSummaryRow = object({
  BTC: string(),
  ActiveCount: coerceNumber(),
  BehindCount: coerceNumber(),
  BehindPercent: coerceNumber(),
  AvgDaysPerMigration: nullable(coerceNumber()),
})

export const ZStagePerformanceRow = object({
  Stage: string(),
  BTC: string(),
  ActiveCount: coerceNumber(),
  BehindCount: coerceNumber(),
  BehindPercent: coerceNumber(),
  AvgDaysInStage: nullable(coerceNumber()),
})

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

export type StageMapRow = {
  Stage: string
  SLA: number
  Category?: string
}

export type ReportSummaryRow = {
  Active: number
  Behind: number
  BehindPct: number
  AvgDaysPerMigration: number
}

export type StagePerfRow = {
  Stage: string
  AvgDaysInStage: number
}

export type ReportsSummaryRow = {
  BTC: string
  ActiveCount: number
  BehindCount: number
  BehindPercent: number
  AvgDaysPerMigration: number | null
}

export type StagePerformanceRow = {
  Stage: string
  BTC: string
  ActiveCount: number
  BehindCount: number
  BehindPercent: number
  AvgDaysInStage: number | null
}

export const ZEngVCustTimeRow = object({
  Responsibility: string(),
  BTC: string(),
  'Avg Days': coerceNumber(),
})

export type EngVCustTimeRow = {
  Responsibility: string
  BTC: string
  'Avg Days': number
}
