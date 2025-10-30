import React, { useState } from 'react'

export default function NewMigrationModal({ open, onClose }) {
  const [form, setForm] = useState({ MigrationID: '', Customer: '', Owner: '', Stage: '' })
  if (!open) return null
  const onSubmit = (e) => {
    e.preventDefault()
    console.log('[MH-UI] New Migration submit', form)
    onClose && onClose()
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-lg w-full max-w-md p-5">
        <h3 className="text-lg font-semibold mb-3">New Migration</h3>
        <form onSubmit={onSubmit} className="space-y-3">
          <input className="w-full rounded-xl border-slate-300" placeholder="MigrationID" value={form.MigrationID} onChange={set('MigrationID')} />
          <input className="w-full rounded-xl border-slate-300" placeholder="Customer" value={form.Customer} onChange={set('Customer')} />
          <input className="w-full rounded-xl border-slate-300" placeholder="Owner" value={form.Owner} onChange={set('Owner')} />
          <input className="w-full rounded-xl border-slate-300" placeholder="Stage" value={form.Stage} onChange={set('Stage')} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-1.5">Cancel</button>
            <button type="submit" className="rounded-xl bg-slate-900 text-white px-3 py-1.5 shadow hover:shadow-md">Create</button>
          </div>
        </form>
      </div>
    </div>
  )
}


