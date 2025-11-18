import React, { Component, ReactNode } from 'react'
import Card from '../Card.jsx'

type Props = {
  children: ReactNode
  fallback?: ReactNode
}

type State = {
  hasError: boolean
  error: Error | null
}

export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[RouteErrorBoundary] Error caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card className="p-6">
          <div className="text-center">
            <div className="mb-4 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
              <div className="font-medium mb-1">Something went wrong</div>
              <div className="text-sm">{this.state.error?.message || 'An unexpected error occurred'}</div>
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
            >
              Try again
            </button>
          </div>
        </Card>
      )
    }

    return this.props.children
  }
}

