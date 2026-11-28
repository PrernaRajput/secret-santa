import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { formatFriendlyFirestoreError } from '../../services/firebase';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    const friendly = formatFriendlyFirestoreError(
      error,
      'Something unexpected happened in Santa’s workshop.'
    );
    return {
      hasError: true,
      message: friendly.message,
    };
  }

  componentDidCatch(error: Error) {
    console.error('Secret Santa ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-3xl bg-slate-900 border border-white/15 p-8 text-center space-y-5 shadow-2xl">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="font-display text-2xl font-bold">
              Oops! Reindeer tripped on a wire
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed break-words">
              {this.state.message.slice(0, 220)}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Workshop
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
