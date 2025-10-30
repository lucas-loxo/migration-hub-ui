import React from 'react'

export default function Drawer({ open, title, children, onClose }) {
  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}>
      <div
        className={`absolute inset-0 bg-black/30 transition ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-lg transition-transform ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-lg px-2 py-1 border border-slate-200">✕</button>
        </div>
        <div className="p-4 overflow-auto h-[calc(100%-4rem)]">{children}</div>
      </aside>
    </div>
  )
}


