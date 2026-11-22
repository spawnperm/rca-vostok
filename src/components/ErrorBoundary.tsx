import React from 'react';
import { RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Произошла непредвиденная ошибка при отображении раздела.',
    };
  }

  componentDidCatch(error: Error): void {
    console.error('[UI ErrorBoundary]', error);
  }

  private handleRecover = () => {
    this.setState({ hasError: false, message: '' });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="bg-white border border-slate-200 rounded-xl p-8 max-w-2xl mx-auto my-8 space-y-4"
        >
          <p className="text-xs font-medium text-red-700">Восстановление интерфейса</p>
          <h2 className="text-xl font-bold text-slate-900">
            Не удалось отобразить текущий блок
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">{this.state.message}</p>
          <button
            type="button"
            onClick={this.handleRecover}
            className="px-4 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Вернуться к обзору</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
