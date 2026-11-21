import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../lib/utils';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-jade flex-shrink-0" />,
    error: <XCircle className="w-5 h-5 text-ember flex-shrink-0" />,
    warning: <AlertCircle className="w-5 h-5 text-gold flex-shrink-0" />,
    info: <Info className="w-5 h-5 text-horizon-bright flex-shrink-0" />,
  };

  const borders = {
    success: 'border-jade/30',
    error: 'border-ember/30',
    warning: 'border-gold/30',
    info: 'border-horizon/30',
  };

  return (
    <div
      className={cn(
        'toast border animate-slide-down',
        borders[toast.type],
      )}
      role="alert"
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-heading font-semibold tracking-wide text-cloud">
          {toast.title}
        </p>
        {toast.message && (
          <p className="text-xs text-runway mt-0.5 truncate">{toast.message}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="text-runway/60 hover:text-cloud transition-colors flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, title, message }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const ctx: ToastContextType = {
    success: (t, m) => add('success', t, m),
    error: (t, m) => add('error', t, m),
    warning: (t, m) => add('warning', t, m),
    info: (t, m) => add('info', t, m),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 w-80 no-print"
        aria-live="polite"
      >
        {toasts.map(toast => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => dismiss(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
