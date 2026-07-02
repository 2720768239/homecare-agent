'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  BellIcon,
  DeviceIcon,
  HistoryIcon,
  HomeIcon,
  InfoIcon,
  SettingsIcon,
  CloseIcon,
} from '@/components/ui/Icon';
import { useUIStore } from '@/store/ui-store';
import { useAuthStore } from '@/store/auth-store';

const MAIN_ITEMS = [
  { href: '/devices', label: '设备库', icon: DeviceIcon, group: '主要', match: '/devices' },
  { href: '/reminders', label: '提醒', icon: BellIcon, group: '主要', match: '/reminders' },
  { href: '/runs', label: 'Agent 执行记录', icon: HistoryIcon, group: '主要', match: '/runs' },
];

const MGMT_ITEMS = [
  { href: '/settings', label: '设置', icon: SettingsIcon, group: '管理', match: '/settings' },
  { href: '/settings#about', label: '关于 HomeCare Agent', icon: InfoIcon, group: '管理', match: '/about' },
];

export function SideDrawer() {
  const { drawerOpen, closeDrawer } = useUIStore();
  const pathname = usePathname();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    closeDrawer();
  }, [pathname, closeDrawer]);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  if (!drawerOpen) return null;

  const isActive = (match: string) =>
    match === '/' ? pathname === '/' : pathname.startsWith(match);

  const goNewTask = () => {
    router.push('/');
    closeDrawer();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={closeDrawer} aria-hidden />
      <aside className="fixed left-0 top-0 z-50 flex h-full w-[300px] flex-col bg-bg shadow-xl">
        <div className="flex items-center justify-between px-6 pb-3 pt-[max(env(safe-area-inset-top),20px)]">
          <div>
            <p className="text-[15px] font-semibold text-ink">HomeCare Agent</p>
            <p className="mt-0.5 text-xs text-ink-secondary">{session?.householdName || '我的家'}</p>
          </div>
          <button
            onClick={closeDrawer}
            aria-label="关闭菜单"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary active:bg-muted"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="px-4 pb-2 pt-1">
          <button
            onClick={goNewTask}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium text-ink active:bg-muted"
          >
            <HomeIcon size={20} />
            新任务
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 pb-6">
          <DrawerGroup title="主要" items={MAIN_ITEMS} isActive={isActive} />
          <DrawerGroup title="管理" items={MGMT_ITEMS} isActive={isActive} />
        </nav>

        <div className="border-t border-line px-6 py-4">
          <p className="text-xs text-ink-tertiary">
            {session?.displayName} · {session?.username}
          </p>
        </div>
      </aside>
    </>
  );
}

function DrawerGroup({
  title,
  items,
  isActive,
}: {
  title: string;
  items: { href: string; label: string; icon: typeof HomeIcon; match: string }[];
  isActive: (m: string) => boolean;
}) {
  return (
    <div className="mt-3">
      <p className="px-4 pb-2 text-xs text-ink-tertiary">{title}</p>
      <div className="space-y-1">
        {items.map((it) => {
          const Icon = it.icon;
          const active = isActive(it.match);
          return (
            <Link
              key={it.label}
              href={it.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] ${
                active ? 'bg-muted font-semibold text-ink' : 'text-ink'
              } active:bg-muted`}
            >
              <Icon size={20} />
              {it.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
