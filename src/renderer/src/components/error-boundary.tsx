import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Prevents a render error from leaving the whole window blank/black. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error): void {
    console.error('[ErrorBoundary]', error)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
          <div className="max-w-md">
            <h1 className="mb-2 text-lg font-semibold text-foreground">
              Algo quebrou ao renderizar
            </h1>
            <p className="text-sm text-muted-foreground">{this.state.error.message}</p>
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
