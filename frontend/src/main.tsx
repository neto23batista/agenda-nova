import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Falha ao renderizar a aplicacao.' };
  }

  componentDidCatch(error: Error) {
    console.error('Root render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="page">
          <section className="app-shell">
            <article className="panel">
              <h2>Falha ao abrir a tela</h2>
              <p>{this.state.message}</p>
              <button className="button button-primary" onClick={() => window.location.reload()}>
                Recarregar
              </button>
            </article>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>,
);
