import { type ReactNode, type FormEvent } from 'react';
import { X, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface CrudModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  loading?: boolean;
  submitLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  error?: string | null;
}

export default function CrudModal({
  title,
  open,
  onClose,
  onSubmit,
  loading,
  submitLabel = 'Save',
  size = 'md',
  children,
  error,
}: CrudModalProps) {
  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-sky-darkest/80 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full glass border border-sky-light/30 rounded-2xl shadow-glass animate-fade-up',
          widths[size],
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sky-light/20">
          <h2 className="font-heading text-xl font-semibold tracking-wide text-cloud">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="btn-icon text-runway hover:text-cloud"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={onSubmit}>
          <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-4">
            {error && (
              <div className="bg-ember/10 border border-ember/30 rounded-lg px-4 py-3 text-sm text-ember">
                {error}
              </div>
            )}
            {children}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-sky-light/20 flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : (
                submitLabel
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
