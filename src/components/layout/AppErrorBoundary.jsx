import { Component } from "react";

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : "Unknown startup error",
    };
  }

  componentDidCatch(error, info) {
    console.error("TMpesa startup error", error, info);
  }

  render() {
    if (this.state.hasError) {
      const encodedError = encodeURIComponent(
        `TMpesa failed to load in World App.\n\nError: ${this.state.errorMessage}`,
      );

      return (
        <div className="page-bg">
          <section className="auth-layout">
            <div className="auth-card stack">
              <span className="brand-kicker">TMpesa</span>
              <h1 className="brand-title">Reload TMpesa</h1>
              <p className="muted">
                World App had trouble loading this session. Close and reopen TMpesa, or tap reload.
              </p>
              {this.state.errorMessage ? (
                <div className="error">
                  Startup error: <code>{this.state.errorMessage}</code>
                </div>
              ) : null}
              <button type="button" className="button" onClick={() => window.location.reload()}>
                Reload App
              </button>
              <a
                className="button-secondary"
                href={`mailto:brianokindo2022@gmail.com?subject=TMpesa%20World%20App%20startup%20error&body=${encodedError}`}
              >
                Email Support
              </a>
            </div>
          </section>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
