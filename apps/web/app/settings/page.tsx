'use client';

// 设置页（路由 /settings）—— 从左侧抽屉进入。
// 包含：账户信息 / 默认保修提醒时间 / 数据导出 / 关于 HomeCare Agent / 退出登录。
// 数据导出收纳在设置页，不作为抽屉独立入口（DESIGN.md §12.4, §12.8）。

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell/AppShell';
import { AuthGuard } from '@/components/app-shell/AuthGuard';
import { SubHeader } from '@/components/app-shell/SubHeader';
import { LogoutIcon, ChevronRightIcon, InfoIcon } from '@/components/ui/Icon';
import { useAuthStore } from '@/store/auth-store';
import { api } from '@/lib/api-client';
import type { Settings as SettingsType } from '@/lib/types';

export default function SettingsPage() {
  return (
    <AuthGuard>
      <AppShell>
        <div className="flex h-[100dvh] flex-col">
          <SubHeader title="设置" backHref="/" />
          <SettingsContent />
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function SettingsContent() {
  const router = useRouter();
  const { session, logout } = useAuthStore();
  const [settings, setSettings] = useState<SettingsType | undefined>(undefined);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (session) {
      api.getSettings(session.userId).then(setSettings);
    }
  }, [session]);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const handleExport = () => {
    setExporting(true);
    try {
      const json = api.exportData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `homecare-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleReset = () => {
    if (confirm('确定要重置 Demo 数据吗？这将恢复所有设备、提醒和执行记录到初始状态。')) {
      api.resetDemoData();
      window.location.reload();
    }
  };

  return (
    <main className="safe-x flex-1 overflow-y-auto pb-6 pt-4">
      {/* 账户信息 */}
      <Section title="账户信息">
        <InfoRow label="账号" value={session?.username || '—'} />
        <InfoRow label="姓名" value={session?.displayName || '—'} />
        <InfoRow label="家庭空间" value={session?.householdName || '—'} />
      </Section>

      {/* 偏好设置 */}
      <Section title="偏好设置">
        <div className="flex items-center justify-between py-2">
          <span className="text-[14px] text-ink">默认保修提醒时间</span>
          <span className="text-[14px] text-ink-secondary">
            {settings?.defaultReminderTime || '09:00'}
          </span>
        </div>
      </Section>

      {/* 数据管理 */}
      <Section title="数据管理">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex w-full items-center justify-between py-2.5 text-left active:opacity-60"
        >
          <span className="text-[14px] text-ink">数据导出</span>
          <ChevronRightIcon size={16} className="text-ink-tertiary" />
        </button>
        <button
          onClick={handleReset}
          className="flex w-full items-center justify-between py-2.5 text-left active:opacity-60"
        >
          <span className="text-[14px] text-ink">重置 Demo 数据</span>
          <ChevronRightIcon size={16} className="text-ink-tertiary" />
        </button>
      </Section>

      {/* 关于 */}
      <Section title="关于" id="about">
        <InfoRow label="应用名称" value="HomeCare Agent" />
        <InfoRow label="版本" value="v0.1" />
        <InfoRow label="产品形态" value="移动端 Agent-first PWA" />
        <div className="mt-2 flex items-start gap-2 rounded-xl bg-surface px-3 py-2.5">
          <InfoIcon size={16} className="mt-0.5 shrink-0 text-ink-secondary" />
          <p className="text-[13px] leading-relaxed text-ink-secondary">
            v0.1 为本地 Demo，使用预置家庭账号。不提供注册、忘记密码和第三方登录。
          </p>
        </div>
      </Section>

      {/* 退出登录 */}
      <div className="mt-6">
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-bg py-3 text-[15px] font-medium text-danger-text active:bg-muted"
        >
          <LogoutIcon size={18} />
          退出登录
        </button>
      </div>

      <p className="mt-6 text-center text-xs text-ink-tertiary">
        HomeCare Agent v0.1 · 本地 Demo
      </p>
    </main>
  );
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section className="mt-4" id={id}>
      <p className="mb-2 text-[13px] font-medium text-ink-secondary">{title}</p>
      <div className="card divide-y divide-line">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[14px] text-ink-secondary">{label}</span>
      <span className="text-[14px] text-ink">{value}</span>
    </div>
  );
}
