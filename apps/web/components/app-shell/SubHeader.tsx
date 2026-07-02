'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeftIcon } from '@/components/ui/Icon';

export function SubHeader({
  title,
  backHref,
  rightAction,
}: {
  title: string;
  backHref?: string;
  rightAction?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="safe-x flex h-14 shrink-0 items-center justify-between border-b border-line bg-bg">
      <button
        onClick={() => (backHref ? router.push(backHref) : router.back())}
        aria-label="返回"
        className="flex h-10 w-10 items-center justify-center rounded-xl text-ink active:bg-muted"
      >
        <ChevronLeftIcon size={24} />
      </button>
      <h1 className="absolute left-0 right-0 mx-auto w-full text-center text-[16px] font-semibold text-ink pointer-events-none">
        {title}
      </h1>
      <div className="min-w-[40px] flex justify-end">{rightAction}</div>
    </header>
  );
}
