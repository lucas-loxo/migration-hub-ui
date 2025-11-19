import React, { useEffect, useState } from 'react'
import Card from '../Card.jsx'
import { getActivitiesForMigration, type Activity } from '../../lib/sheetsCustomers'

type ActivityFeedProps = {
  migrationId: string
}

export default function ActivityFeed({ migrationId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!migrationId) {
      setLoading(false)
      return
    }

    let active = true

    const loadActivities = async () => {
      setLoading(true)
      try {
        const data = await getActivitiesForMigration(migrationId)
        if (active) {
          setActivities(data)
        }
      } catch (e) {
        console.error('[ActivityFeed] Error loading activities:', e)
        if (active) {
          setActivities([])
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadActivities()

    return () => {
      active = false
    }
  }, [migrationId])

  const formatActivitySummary = (activity: Activity): string => {
    if (activity.eventType === 'stage_changed') {
      if (activity.prevStage && activity.newStage) {
        return `Stage changed from ${activity.prevStage} to ${activity.newStage}`
      } else if (activity.newStage) {
        return `Stage changed to ${activity.newStage}`
      } else if (activity.prevStage) {
        return `Stage changed from ${activity.prevStage}`
      }
    }
    if (activity.eventType === 'migration_created') {
      return 'Migration created'
    }
    return activity.details || activity.eventType || 'Activity'
  }

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return dateStr
      return date.toLocaleString()
    } catch {
      return dateStr
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Activity Feed</h2>
      {loading ? (
        <div className="text-sm text-slate-500">Loading...</div>
      ) : activities.length === 0 ? (
        <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
          <div className="text-sm text-slate-600">No activities yet</div>
          <div className="text-xs text-slate-400 mt-1">Activity feed will appear here</div>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-4">
          {activities.map((activity, index) => (
            <div key={activity.eventId || index} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
              <div className="text-sm text-slate-900 font-medium">{formatActivitySummary(activity)}</div>
              <div className="text-xs text-slate-400 mt-1">
                {activity.actor ? `By ${activity.actor}` : ''}
                {activity.actor && activity.occurredAt ? ' · ' : ''}
                {activity.occurredAt ? formatDate(activity.occurredAt) : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

