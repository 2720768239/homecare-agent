'use client';

// Agent Home 页面（路由 /）。
// 编排：AuthGuard + AppShell + TopBar + 消息列表 + 待上传文件 + Composer + 上传 Sheet。
// 上传 Sheet 是自动建档主链路入口（DESIGN.md §11.3）。

import { useEffect, useRef, useState } from 'react';
import { AuthGuard } from '@/components/app-shell/AuthGuard';
import { AppShell } from '@/components/app-shell/AppShell';
import { TopBar } from '@/components/app-shell/TopBar';
import { Composer } from '@/components/app-shell/Composer';
import { AgentHome } from '@/components/agent/AgentHome';
import { UploadActionSheet, type UploadAction } from '@/components/agent/UploadActionSheet';
import { FileStateList } from '@/components/agent/FileStateList';
import { useConversationStore } from '@/store/conversation-store';
import { useAuthStore } from '@/store/auth-store';
import { api } from '@/lib/api-client';
import type { Device } from '@/lib/types';

export default function Page() {
  return (
    <AuthGuard>
      <AppShell>
        <AgentHomePage />
      </AppShell>
    </AuthGuard>
  );
}

function AgentHomePage() {
  const [input, setInput] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [contextDevice, setContextDevice] = useState<Device | undefined>(undefined);

  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = useConversationStore((s) => s.submit);
  const running = useConversationStore((s) => s.running);
  const pendingAttachments = useConversationStore((s) => s.pendingAttachments);
  const addPendingAttachment = useConversationStore((s) => s.addPendingAttachment);
  const updatePendingAttachment = useConversationStore((s) => s.updatePendingAttachment);
  const removePendingAttachment = useConversationStore((s) => s.removePendingAttachment);
  const setContextDeviceId = useConversationStore((s) => s.setContextDevice);
  const session = useAuthStore((s) => s.session);

  // 从 URL 读取设备上下文（?device=xxx）—— 设备详情页"问说明书/故障售后"跳转过来时携带
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const deviceId = params.get('device');
    if (deviceId) {
      setContextDeviceId(deviceId);
      api.getDevice(deviceId).then(setContextDevice).catch(() => undefined);
    }
  }, [setContextDeviceId]);

  const handleUploadAction = (action: UploadAction) => {
    if (action === 'manual_add') {
      setInput('手动添加设备：');
      return;
    }
    if (action === 'camera') cameraRef.current?.click();
    if (action === 'album') albumRef.current?.click();
    if (action === 'file') fileRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!session) return;
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // 允许重复选择同一文件
    for (const file of files) {
      const att = await api.registerAttachment(
        {
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        },
        session.userId,
      );
      addPendingAttachment(att);
      void simulateUpload(att.id);
    }
  };

  // mock 上传 + 解析状态流转：pending → uploading → uploaded → parsing → parsed/failed
  const simulateUpload = async (id: string) => {
    updatePendingAttachment(id, { parseStatus: 'uploading' });
    await wait(250);
    updatePendingAttachment(id, { parseStatus: 'uploaded' });
    await wait(200);
    updatePendingAttachment(id, { parseStatus: 'parsing' });
    try {
      await wait(350);
      const parsed = await api.parseAttachment(id);
      updatePendingAttachment(id, parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '解析失败';
      await api.setAttachmentParseStatus(id, 'failed', msg);
      updatePendingAttachment(id, { parseStatus: 'failed', parseError: msg });
    }
  };

  const handleRetry = (id: string) => void simulateUpload(id);
  const handleManualFill = () => setInput('手动添加设备：');
  const handleSaveAsAttachmentOnly = async (id: string) => {
    await api.setAttachmentParseStatus(id, 'parsed');
    updatePendingAttachment(id, {
      parseStatus: 'parsed',
      parseSummary: '仅保存为附件',
    });
  };

  const handleSubmit = (text: string) => {
    setInput('');
    void submit(text);
  };

  return (
    <div className="flex h-[100dvh] flex-col">
      <TopBar />

      <main className="safe-x no-scrollbar flex-1 overflow-y-auto pt-4">
        {contextDevice && (
          <div className="mb-3">
            <ContextDevicePill name={contextDevice.name} />
          </div>
        )}
        <AgentHome />
        {pendingAttachments.length > 0 && (
          <div className="mt-4 pb-3">
            <p className="mb-2 text-xs text-ink-tertiary">待处理文件</p>
            <FileStateList
              attachments={pendingAttachments}
              onRemove={removePendingAttachment}
              onRetry={handleRetry}
              onManualFill={handleManualFill}
              onSaveAsAttachmentOnly={handleSaveAsAttachmentOnly}
            />
          </div>
        )}
      </main>

      <Composer
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        onPlus={() => setUploadOpen(true)}
        disabled={running}
      />

      <UploadActionSheet
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onAction={handleUploadAction}
      />

      {/* 隐藏的文件输入：拍照 / 相册 / 文件 */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <input
        ref={albumRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFile}
      />
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

function ContextDevicePill({ name }: { name: string }) {
  return (
    <span className="inline-flex h-[30px] items-center gap-1 rounded-[15px] bg-muted px-3 text-[13px] text-ink-secondary">
      当前设备：{name}
    </span>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
