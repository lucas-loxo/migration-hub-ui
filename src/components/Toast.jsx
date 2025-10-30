import { useEffect } from 'react'

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const id = setTimeout(() => onClose && onClose(), 2500)
    return () => clearTimeout(id)
  }, [onClose])

  if (!message) return null
  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-xl shadow text-white ${
      type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
    }`}>
      {message}
    </div>
  )
}


