'use client';

// 提醒列表（路由 /reminders）—— 从左侧抽屉进入。
// 包含：筛选 Tabs / 提醒卡片 / 查看设备 / 标记完成 / 忽略（DESIGN.md §12.8）。

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import { AppShell } from '@/components/app-shell/AppShell';
import { AuthGuard } from '@/components/app-shell/AuthGuard';
import { SubHeader } from '@/components/app-shell/SubHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChevronRightIcon, BellIcon } from '@/components/ui/Icon';
import { api } from '@/lib/api-client';
import type { Reminder, ReminderStatus } from '@/lib/types';
import { formatDate, relativeTime } from '@/lib/format';

type Tab = 'all' | ReminderStatus;

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待处理' },
  { key: 'done', label: '已完成' },
  { key: 'ignored', label: '已忽略' },
];

export default function RemindersPage() {
  return (
    <AuthGuard>
      <AppShell>
        <div className="flex h-[100dvh] flex-col">
          <SubHeader title="提醒" backHref="/" />
          <RemindersContent />
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function RemindersContent() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const session = useAuthStore((s) => s.session);

  const load = () => {
    api.listReminders().then((r) => {
      setReminders(r);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const filtered = reminders.filter((r) => tab === 'all' || r.status === tab);

  const handleAction = async (id: string, status: ReminderStatus) => {
    if (!session) return;
    await api.patchReminder(id, { status }, session.userId);
    load();
  };

  return (
    <main className="safe-x flex-1 overflow-y-auto pb-6">
      {/* 筛选 Tabs */}
      <div className="sticky top-0 z-10 flex gap-2 bg-bg py-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] ${
              tab === t.key ? 'bg-ink text-white' : 'bg-surface text-ink-secondary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-8 text-center text-[13px] text-ink-tertiary">加载中...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="暂无提醒"
          description="设备保修到期或需要保养时会在这里提醒你。"
          action={
            <Link href="/" className="btn-secondary">
              返回
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <ReminderCard
              key={r.id}
              reminder={r}
              onDone={() => handleAction(r.id, 'done')}
              onIgnore={() => handleAction(r.id, 'ignored')}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function ReminderCard({
  reminder,
  onDone,
  onIgnore,
}: {
  reminder: Reminder;
  onDone: () => void;
  onIgnore: () => void;
}) {
  const overdue =
    reminder.status === 'pending' && new Date(reminder.dueDate) < new Date();
  return (
    <div className="card space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-ink">{reminder.title}</p>
          {reminder.description && (
            <p className="mt-0.5 text-[13px] text-ink-secondary">{reminder.description}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
            reminder.status === 'pending'
              ? overdue
                ? 'bg-danger-bg text-danger-text'
                : 'bg-warn-bg/60 text-warn-text'
              : reminder.status === 'done'
                ? 'bg-[#ECFDF5] text-ok-text'
                : 'bg-muted text-ink-tertiary'
          }`}
        >
          {reminder.status === 'pending' ? (overdue ? '已逾期' : '待处理') : reminder.status === 'done' ? '已完成' : '已忽略'}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-ink-tertiary">
        <BellIcon size={14} />
        <span>到期：{formatDate(reminder.dueDate)}</span>
        <span>· {relativeTime(reminder.dueDate)}</span>
      </div>
      <div className="flex items-center gap-2 pt-1">
        {reminder.deviceId && (
          <Link
            href={`/devices/${reminder.deviceId}`}
            className="flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-[13px] text-ink-secondary active:bg-muted"
          >
            查看设备
            <ChevronRightIcon size={14} />
          </Link>
        )}
        {reminder.status === 'pending' && (
          <>
            <button
              onClick={onDone}
              className="rounded-full bg-ink px-3 py-1.5 text-[13px] text-white active:opacity-70"
            >
              标记完成
            </button>
            <button
              onClick={onIgnore}
              className="rounded-full border border-line px-3 py-1.5 text-[13px] text-ink-secondary active:bg-muted"
            >
              忽略
            </button>
          </>
        )}
      </div>
    </div>
  );
}
