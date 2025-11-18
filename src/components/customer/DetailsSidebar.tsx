import React, { useState, useEffect } from 'react'
import Card from '../Card.jsx'
import type { CustomerProfile } from '../../lib/sheetsCustomers'

type DetailsSidebarProps = {
  profile: CustomerProfile | null
}

const STORAGE_KEY = 'mh.customer.sidebar.collapsed'

export default function DetailsSidebar({ profile }: DetailsSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === '1') setCollapsed(true)
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [collapsed])

  if (!profile) {
    return null
  }

  return (
    <div className="sticky top-4">
      <Card className="p-4">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-between mb-4 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          <span>Details</span>
          <span className="text-slate-400">{collapsed ? '▶' : '▼'}</span>
        </button>

        {!collapsed && (
          <div className="space-y-4">
            <div>
              <div className="text-xs text-slate-500 mb-1">Previous ATS</div>
              <div className="text-sm text-slate-900">{profile.PreviousATS || '—'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1">Seats</div>
              <div className="text-sm text-slate-900">{profile.Seats ?? '—'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1">Primary Contact</div>
              <div className="text-sm text-slate-900">{profile.PrimaryContactName || '—'}</div>
              {profile.PrimaryContactEmail && (
                <a
                  href={`mailto:${profile.PrimaryContactEmail}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {profile.PrimaryContactEmail}
                </a>
              )}
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1">Secondary Contact</div>
              <div className="text-sm text-slate-900">{profile.SecondaryContactName || '—'}</div>
              {profile.SecondaryContactEmail && (
                <a
                  href={`mailto:${profile.SecondaryContactEmail}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {profile.SecondaryContactEmail}
                </a>
              )}
            </div>

            {profile.ChurnZeroLink ? (
              <div>
                <a
                  href={profile.ChurnZeroLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition"
                >
                  Open ChurnZero
                </a>
              </div>
            ) : (
              <div>
                <button
                  disabled
                  className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-slate-100 text-slate-400 cursor-not-allowed"
                >
                  Open ChurnZero
                </button>
              </div>
            )}

            {profile.Notes && (
              <div>
                <div className="text-xs text-slate-500 mb-1">Notes</div>
                <div className="text-sm text-slate-900 whitespace-pre-wrap">{profile.Notes}</div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

