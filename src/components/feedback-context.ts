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

export interface ChooseOptions {
  title?: string;
  message?: string;
  options: { label: string; destructive?: boolean }[];
  cancelLabel?: string;
}

export interface Feedback {
  toast: (o: ToastOptions | string) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  /** Action sheet con più scelte: ritorna l'indice scelto o null se annullato. */
  choose: (o: ChooseOptions) => Promise<number | null>;
}

export const FeedbackContext = createContext<Feedback>({
  toast: () => {},
  confirm: async () => false,
  choose: async () => null,
});

export const useFeedback = () => useContext(FeedbackContext);
