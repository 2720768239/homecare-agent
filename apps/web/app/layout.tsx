import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HomeCare Agent',
  description: 'HomeCare Agent — 移动端 Agent-first 家庭设备档案助手',
  manifest: '/manifest.webmanifest',
  applicationName: 'HomeCare Agent',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'HomeCare Agent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#FFFFFF',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="app-frame">{children}</div>
      </body>
    </html>
  );
}
