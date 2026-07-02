'use client';

import { SideDrawer } from './SideDrawer';

// AppShell 仅负责挂载左侧抽屉；TopBar / SubHeader / Composer 由各页面自行组合。
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SideDrawer />
      {children}
    </>
  );
}
