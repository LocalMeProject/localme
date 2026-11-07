import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[LocalMe ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-slate-50 text-slate-800" dir="rtl">
          <div className="max-w-lg w-full bg-white rounded-2xl border border-rose-200 shadow-xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {this.props.fallbackTitle || 'خطایی در پردازش این بخش رخ داده است'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  رابط کاربری با خطای غیرمنتظره جاوااسکریپت مواجه شد و برای جلوگیری از آسیب به داده‌ها متوقف گردید.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="p-3.5 bg-slate-950 rounded-xl font-mono text-[11px] text-rose-300 overflow-x-auto whitespace-pre-wrap select-text" dir="ltr">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => window.location.href = '/panel'}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                <Home className="w-3.5 h-3.5" />
                <span>میزکار توسعه‌دهندگان</span>
              </button>

              <button
                onClick={this.handleReset}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تازه سازی صفحه و تلاش مجدد</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
