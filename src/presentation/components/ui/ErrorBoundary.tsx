import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  resetKey: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Произошла непредвиденная ошибка отображения раздела',
    };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: '' });
    }
  }

  componentDidCatch(error: Error) {
    console.error('Portal view error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="mx-auto my-8 max-w-lg rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm"
        >
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h2 className="mt-3 text-base font-semibold text-slate-900">
            Ошибка загрузки раздела
          </h2>
          <p className="mt-1.5 text-xs text-slate-600">{this.state.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#0077FF] px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Повторить отображение
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
