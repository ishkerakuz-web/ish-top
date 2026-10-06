import React from "react";

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/30">
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-red-500">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Kutilmagan xatolik</h2>
          <p className="mt-1 text-sm text-dusk">Sahifaning bir qismi yuklanmadi.</p>
        </div>
        <button
          onClick={() => {
            this.setState({ hasError: false });
            window.location.reload();
          }}
          className="rounded-xl bg-signal px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-signal/90"
        >
          Sahifani yangilash
        </button>
      </div>
    );
  }
}
