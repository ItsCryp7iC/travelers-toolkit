import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#030712] text-[#E8E3D5]">
          <div
            role="alert"
            aria-live="assertive"
            className="max-w-md w-full bg-[#0b101b]/95 border border-[var(--border,#2b3245)] rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-xl text-center flex flex-col items-center gap-4"
          >
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-2xl text-red-400 select-none">
              ⚠️
            </div>

            <h1 className="text-xl font-bold tracking-tight text-[#E8E3D5]">
              Something went wrong
            </h1>

            <p className="text-sm text-[var(--muted,#8B8BA0)] leading-relaxed">
              Traveler&apos;s Toolkit encountered an unexpected issue while rendering this view. Your saved data is safe.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--primary,#4EC9B0)] hover:bg-[var(--primary,#4EC9B0)]/80 text-[#030712] font-semibold text-sm transition-all shadow-md cursor-pointer"
              >
                Reload App
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-[var(--border,#2b3245)] text-[var(--text,#E8E3D5)] font-semibold text-sm transition-all cursor-pointer"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
