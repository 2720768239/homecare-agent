'use client';

import { useEffect } from 'react';
import { CloseIcon } from './Icon';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeight?: string;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  maxHeight = '80vh',
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} aria-hidden />
      <div
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        style={{ maxHeight }}
      >
        <div className="grabber" />
        <div className="flex items-center justify-between px-7 pt-3 pb-2">
          <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary active:bg-muted"
          >
            <CloseIcon size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-7 pb-2">{children}</div>
        {footer && <div className="px-7 pt-2">{footer}</div>}
      </div>
    </>
  );
}
