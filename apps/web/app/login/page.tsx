'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { StatusBar } from '@/components/app-shell/StatusBar';
import { HomeIcon, WarningIcon } from '@/components/ui/Icon';

export default function LoginPage() {
  const router = useRouter();
  const { session, hydrated, hydrate, login, loading, error, clearError } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (hydrated && session) router.replace('/');
  }, [hydrated, session, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    const ok = await login(username.trim(), password);
    if (ok) router.replace('/');
  };

  const fillDemo = (u: string) => {
    setUsername(u);
    setPassword('home123456');
    clearError();
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-bg">
        <StatusBar />
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-12 text-center">
          <div className="flex h-[88px] w-[88px] items-center justify-center rounded-[28px] bg-ink text-white">
            <HomeIcon size={48} />
          </div>
          <div>
            <h1 className="text-[26px] font-bold text-ink">正在进入家庭空间</h1>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-secondary">
              正在检查登录状态，请稍候。
            </p>
          </div>
          <div className="h-11 w-11 animate-spin rounded-full border-2 border-line border-t-ink" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg pb-[max(env(safe-area-inset-bottom),28px)]">
      <StatusBar />
      <div className="flex flex-col items-center px-11 pt-16 text-center">
        <div className="flex h-[88px] w-[88px] items-center justify-center rounded-[28px] bg-ink text-white">
          <HomeIcon size={48} />
        </div>
        <h1 className="mt-7 text-[30px] font-bold leading-none text-ink">HomeCare Agent</h1>
        <p className="mt-4 w-[294px] text-[14px] leading-[22px] text-ink-secondary">
          登录后进入同一个家庭空间，共同管理家里的设备、说明书、保修和维修记录。
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-7 space-y-4 px-11">
        <div>
          <label className="mb-2 block text-left text-[13px] font-medium text-ink-secondary">
            账号名
          </label>
          <input
            type="text"
            autoCapitalize="none"
            autoComplete="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (error) clearError();
            }}
            placeholder="请输入账号名"
            className="figma-input"
          />
        </div>
        <div>
          <label className="mb-2 block text-left text-[13px] font-medium text-ink-secondary">
            密码
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) clearError();
            }}
            placeholder="请输入密码"
            className="figma-input"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-danger-border bg-danger-bg px-3 py-2.5 text-left">
            <WarningIcon size={18} className="mt-0.5 shrink-0 text-danger-text" />
            <p className="text-[13px] leading-snug text-danger-text">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !username.trim() || !password}
          className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-ink text-[16px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </form>

      <div className="mx-11 mt-9 rounded-2xl border border-line bg-surface px-4 py-4 text-left">
        <p className="text-[14px] font-semibold text-ink">v0.1 预置家庭账号</p>
        <p className="mt-3 text-[13px] leading-[18px] text-ink-secondary">
          home_a / home123456
          <br />
          home_b / home123456
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => fillDemo('home_a')}
            className="rounded-xl border border-line bg-bg px-3 py-2 text-left active:bg-muted"
          >
            <span className="block text-[13px] font-medium text-ink">home_a</span>
            <span className="text-xs text-ink-tertiary">成员 A</span>
          </button>
          <button
            type="button"
            onClick={() => fillDemo('home_b')}
            className="rounded-xl border border-line bg-bg px-3 py-2 text-left active:bg-muted"
          >
            <span className="block text-[13px] font-medium text-ink">home_b</span>
            <span className="text-xs text-ink-tertiary">成员 B</span>
          </button>
        </div>
      </div>

      <div className="mt-auto pt-7 text-center">
        <p className="text-xs text-ink-tertiary">
          暂不支持账号注册、找回密码或第三方登录
        </p>
      </div>
    </div>
  );
}
