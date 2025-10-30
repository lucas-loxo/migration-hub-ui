export function computeNextUp(migrations) {
  const list = Array.isArray(migrations) ? migrations : []
  const dueToday = list.filter((m) => Number(m.Days) === 0)
  if (dueToday.length > 0) return dueToday
  // fallback: 5 soonest actionable by Days asc, prefer Behind first
  const sorted = [...list].sort((a, b) => {
    const behindA = a.Status === 'Behind' ? 1 : 0
    const behindB = b.Status === 'Behind' ? 1 : 0
    if (behindA !== behindB) return behindB - behindA
    const da = Number.isFinite(+a.Days) ? +a.Days : 9999
    const db = Number.isFinite(+b.Days) ? +b.Days : 9999
    return da - db
  })
  return sorted.slice(0, 5)
}


