export const stageThresholds: Record<string, number> = {
  "Waiting on Data Upload": 7,
  "Data Upload": 7,
  "Waiting on Eng Import Map": 7,
  "Eng Map": 7,
  "Waiting on Customer Import Map": 7,
  "Cust Map": 7,
  "Waiting on Data Import": 7,
  "Data Import": 7,
  "Waiting on Validation Requests": 7,
  "Validation": 7,
  "Waiting on Eng Validation": 7,
  "Eng Validation": 7,
  "Waiting on Final Confirmation": 5,
  "Final Confirm": 5,
  "Waiting on Duplicate Merge": 5,
  "Duplicate Merge": 5,
  "Complete": 0,
}

export function getSLA(stage: string, overrides?: Record<string, number>): number {
  return overrides?.[stage] ?? stageThresholds[stage] ?? 7
}

