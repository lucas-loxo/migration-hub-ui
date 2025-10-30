export default function NavBar({ title }) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      <h1 className="text-lg sm:text-xl font-semibold text-slate-900">{title}</h1>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => console.log('[MH-UI] Global action clicked')}
          className="hidden sm:inline-flex items-center rounded-xl bg-slate-900 text-white text-sm px-3 py-2 shadow hover:shadow-md transition"
        >
          ⚙️ Actions
        </button>
      </div>
    </header>
  )
}


