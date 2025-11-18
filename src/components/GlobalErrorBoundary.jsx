import React from 'react'

export default class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    this.setState({ info })
    // eslint-disable-next-line no-console
    console.error('[MH-UI] Uncaught error', error, info)
  }
  render() {
    if (this.state.hasError) {
      const onSafe = () => {
        const url = new URL(window.location.href)
        url.searchParams.set('safe', '1')
        window.location.assign(url.toString())
      }
      return (
        <div className="m-4 p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700">
          <div className="font-medium mb-2">Something went wrong.</div>
          <div className="text-sm mb-2">{String(this.state.error)}</div>
          <button onClick={onSafe} className="rounded-lg border border-rose-300 px-3 py-1.5 bg-white">Try Safe Mode</button>
        </div>
      )
    }
    // @ts-ignore
    return this.props.children
  }
}


