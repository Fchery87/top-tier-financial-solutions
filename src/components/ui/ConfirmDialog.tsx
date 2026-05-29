'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 w-full max-w-md mx-4 bg-card border border-border rounded-xl shadow-lg p-6"
          >
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {variant === 'danger' && (
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
            )}

            <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground mb-6">{description}</p>

            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {cancelLabel}
              </Button>
              <Button
                variant={variant === 'danger' ? 'destructive' : 'primary'}
                onClick={handleConfirm}
              >
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function useConfirmDialog() {
  const [state, setState] = React.useState<{
    open: boolean;
    config: Omit<ConfirmDialogProps, 'open' | 'onOpenChange'>;
  }>({
    open: false,
    config: {
      title: '',
      description: '',
      onConfirm: () => {},
    },
  });

  const confirm = React.useCallback(
    (config: Omit<ConfirmDialogProps, 'open' | 'onOpenChange'>): Promise<boolean> => {
      return new Promise((resolve) => {
        setState({
          open: true,
          config: {
            ...config,
            onConfirm: () => {
              config.onConfirm();
              resolve(true);
            },
          },
        });
      });
    },
    []
  );

  const dialogElement = (
    <ConfirmDialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) setState((s) => ({ ...s, open: false }));
      }}
      {...state.config}
    />
  );

  return { confirm, dialogElement };
}
