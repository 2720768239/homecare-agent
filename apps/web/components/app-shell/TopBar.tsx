'use client';

import { useRouter } from 'next/navigation';
import { MenuIcon, PlusIcon } from '@/components/ui/Icon';
import { StatusBar } from './StatusBar';
import { useUIStore } from '@/store/ui-store';
import { useConversationStore } from '@/store/conversation-store';

export function TopBar({ title = 'HomeCare Agent' }: { title?: string }) {
  const openDrawer = useUIStore((s) => s.openDrawer);
  const newTask = useConversationStore((s) => s.newTask);
  const router = useRouter();

  const handleNewTask = () => {
    newTask();
    router.push('/');
  };

  return (
    <header className="shrink-0 bg-bg">
      <StatusBar />
      <div className="safe-x relative flex h-[52px] items-center justify-between">
        <button
          onClick={openDrawer}
          aria-label="打开菜单"
          className="flex h-10 w-10 -ml-2 items-center justify-center rounded-xl text-ink active:bg-muted"
        >
          <MenuIcon size={26} />
        </button>
        <h1 className="pointer-events-none absolute inset-x-0 mx-auto w-full text-center text-[19px] font-semibold text-ink">
          {title}
        </h1>
        <button
          onClick={handleNewTask}
          aria-label="新任务"
          className="flex h-9 items-center justify-center rounded-xl text-[15px] font-medium text-ink active:bg-muted whitespace-nowrap"
        >
          <PlusIcon size={16} className="sr-only" />
          <span>新任务</span>
        </button>
      </div>
    </header>
  );
}
