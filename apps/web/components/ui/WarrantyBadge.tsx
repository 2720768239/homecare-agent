import type { WarrantyStatus } from '@/lib/types';
import { WARRANTY_STATUS_LABEL } from '@/lib/warranty';

const STYLES: Record<WarrantyStatus, string> = {
  active: 'bg-[#ECFDF5] text-ok-text',
  expiring: 'bg-warn-bg text-warn-text',
  expired: 'bg-danger-bg text-danger-text',
  unknown: 'bg-muted text-ink-secondary',
};

export function WarrantyBadge({ status, className = '' }: { status: WarrantyStatus; className?: string }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ${STYLES[status]} ${className}`}>
      {WARRANTY_STATUS_LABEL[status]}
    </span>
  );
}
