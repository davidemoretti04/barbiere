import { createContext, useContext } from 'react';

export interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

export interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface Feedback {
  toast: (o: ToastOptions | string) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
}

export const FeedbackContext = createContext<Feedback>({
  toast: () => {},
  confirm: async () => false,
});

export const useFeedback = () => useContext(FeedbackContext);
