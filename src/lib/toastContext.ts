import { createContext } from 'react';

type ToastKind = 'error' | 'success' | 'info';

export interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
