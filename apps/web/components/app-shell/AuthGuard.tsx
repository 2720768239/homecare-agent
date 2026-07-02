'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, hydrated, hydrate } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (hydrated && !session) {
      router.replace('/login');
    }
  }, [hydrated, session, router]);

  if (!hydrated) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-ink" />
        <p className="text-[13px] text-ink-secondary">正在检查登录状态...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <p className="text-[13px] text-ink-secondary">正在跳转登录...</p>
      </div>
    );
  }

  return <>{children}</>;
}
