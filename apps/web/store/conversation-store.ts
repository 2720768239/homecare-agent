'use client';

import { create } from 'zustand';
import { api } from '@/lib/api-client';
import type { AgentRun, Attachment } from '@/lib/types';
import { useAuthStore } from './auth-store';

export interface UserMessage {
  id: string;
  role: 'user';
  text: string;
  attachments?: Attachment[];
}

export interface AgentMessage {
  id: string;
  role: 'agent';
  run: AgentRun;
}

export type Message = UserMessage | AgentMessage;

interface ConversationState {
  messages: Message[];
  pendingAttachments: Attachment[];
  contextDeviceId?: string;
  running: boolean;
  addPendingAttachment: (a: Attachment) => void;
  updatePendingAttachment: (id: string, patch: Partial<Attachment>) => void;
  removePendingAttachment: (id: string) => void;
  clearPendingAttachments: () => void;
  setContextDevice: (id?: string) => void;
  submit: (text: string) => Promise<void>;
  confirm: (runId: string, action: Parameters<typeof api.confirmAgentRun>[1]['action'], payload?: { deviceId?: string; patch?: Record<string, unknown> }) => Promise<void>;
  requestSaveFault: (runId: string) => Promise<void>;
  newTask: () => void;
  hydrateFromSeed: () => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  messages: [],
  pendingAttachments: [],
  contextDeviceId: undefined,
  running: false,

  addPendingAttachment: (a) =>
    set((s) => ({ pendingAttachments: [...s.pendingAttachments, a] })),

  updatePendingAttachment: (id, patch) =>
    set((s) => ({
      pendingAttachments: s.pendingAttachments.map((x) =>
        x.id === id ? { ...x, ...patch } : x,
      ),
    })),

  removePendingAttachment: (id) =>
    set((s) => ({ pendingAttachments: s.pendingAttachments.filter((x) => x.id !== id) })),

  clearPendingAttachments: () => set({ pendingAttachments: [] }),

  setContextDevice: (id) => set({ contextDeviceId: id }),

  submit: async (text) => {
    const session = useAuthStore.getState().session;
    if (!session) return;
    const { pendingAttachments, contextDeviceId } = get();
    const userMsg: UserMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text,
      attachments: pendingAttachments.length ? pendingAttachments : undefined,
    };
    set((s) => ({ messages: [...s.messages, userMsg], running: true, pendingAttachments: [] }));

    try {
      const run = await api.startAgentRun({
        inputText: text,
        attachmentIds: pendingAttachments.map((a) => a.id),
        context: contextDeviceId ? { deviceId: contextDeviceId, source: 'agent_home' } : { source: 'agent_home' },
        userId: session.userId,
      });
      const agentMsg: AgentMessage = { id: `a_${run.id}`, role: 'agent', run };
      set((s) => ({ messages: [...s.messages, agentMsg] }));
    } catch (e) {
      const err = e as Error;
      const failed: AgentRun = {
        id: `run_err_${Date.now()}`,
        householdId: 'household_default',
        createdByUserId: session.userId,
        intent: 'unknown',
        userInput: text,
        status: 'failed',
        errorMessage: err.message || 'Agent 执行失败',
        nodePath: [],
        result: { type: 'error', error: { code: 'RUN_FAILED', message: err.message || 'Agent 执行失败' } },
        resultType: 'error',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      set((s) => ({ messages: [...s.messages, { id: `a_${failed.id}`, role: 'agent', run: failed }] }));
    } finally {
      set({ running: false });
    }
  },

  confirm: async (runId, action, payload) => {
    const session = useAuthStore.getState().session;
    if (!session) return;
    set({ running: true });
    try {
      const run = await api.confirmAgentRun(runId, {
        action,
        deviceId: payload?.deviceId,
        patch: payload?.patch,
        userId: session.userId,
      });
      set((s) => ({
        messages: s.messages.map((m) =>
          m.role === 'agent' && m.run.id === runId ? { ...m, run } : m,
        ),
      }));
    } finally {
      set({ running: false });
    }
  },

  requestSaveFault: async (runId) => {
    set({ running: true });
    try {
      const run = await api.requestSaveFaultRecordConfirmation(runId);
      set((s) => ({
        messages: s.messages.map((m) =>
          m.role === 'agent' && m.run.id === runId ? { ...m, run } : m,
        ),
      }));
    } finally {
      set({ running: false });
    }
  },

  newTask: () =>
    set({ messages: [], pendingAttachments: [], contextDeviceId: undefined, running: false }),

  hydrateFromSeed: () => {
    // 进入 Agent Home 时，把最近的 waiting_confirmation / 失败 run 展示在对话顶部（可选）
    // v0.1 默认不注入历史 run，保持新会话干净。
    set({ messages: [] });
  },
}));
