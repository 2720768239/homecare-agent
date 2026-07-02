import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-12 text-center">
      {icon && <div className="mb-4 text-ink-tertiary">{icon}</div>}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description && (
        <p className="mt-2 max-w-[260px] text-[13px] leading-relaxed text-ink-secondary">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
