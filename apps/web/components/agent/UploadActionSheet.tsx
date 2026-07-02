'use client';

// Composer 左侧 + 点击后弹出的上传 Action Sheet。
// 它是自动建档主链路入口，不得省略（DESIGN.md §11.3）。
// 包含：拍照 / 从相册选择 / 上传文件 / 手动添加设备 / 取消。

import { BottomSheet } from '@/components/ui/BottomSheet';
import {
  CameraIcon,
  ImageIcon,
  FileIcon,
  EditIcon,
} from '@/components/ui/Icon';

export type UploadAction = 'camera' | 'album' | 'file' | 'manual_add';

interface UploadActionSheetProps {
  open: boolean;
  onClose: () => void;
  onAction: (action: UploadAction) => void;
}

export function UploadActionSheet({ open, onClose, onAction }: UploadActionSheetProps) {
  const handle = (action: UploadAction) => {
    onClose();
    onAction(action);
  };

  const items: { action: UploadAction; label: string; icon: React.ReactNode }[] = [
    { action: 'camera', label: '拍照', icon: <CameraIcon size={22} /> },
    { action: 'album', label: '从相册选择', icon: <ImageIcon size={22} /> },
    { action: 'file', label: '上传文件', icon: <FileIcon size={22} /> },
    { action: 'manual_add', label: '手动添加设备', icon: <EditIcon size={22} /> },
  ];

  return (
    <BottomSheet open={open} onClose={onClose} title="添加资料">
      <div className="pb-2">
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.action}>
              <button
                onClick={() => handle(it.action)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left active:bg-muted"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink">
                  {it.icon}
                </span>
                <span className="text-[15px] text-ink">{it.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <button
          onClick={onClose}
          className="mt-3 w-full rounded-xl py-3 text-center text-[14px] text-ink-secondary active:bg-muted"
        >
          取消
        </button>
      </div>
    </BottomSheet>
  );
}
