// HomeCare Agent v0.1 API client
// v0.1 默认走内置 mock-backend（无需后端即可运行）。
// 当 NEXT_PUBLIC_USE_MOCK=false 且配置了 NEXT_PUBLIC_API_BASE_URL 时，可改为代理到 FastAPI。

import * as mock from './mock-backend';
import type {
  AgentRun,
  Attachment,
  AttachmentType,
  Device,
  FaultRecord,
  Reminder,
  Session,
  Settings,
} from './types';

const USE_MOCK =
  process.env.NEXT_PUBLIC_USE_MOCK !== 'false'; // 默认 true

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// ── Real backend helpers ──────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw body?.detail ?? body;
  }
  return res.json();
}

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}

// In-memory session for real backend mode
let _session: Session | null = null;
let _token: string | null = null;

export const api = {
  // ---- auth ----
  login(username: string, password: string) {
    if (USE_MOCK) {
      const r = mock.login(username, password);
      if (r.ok) return delay({ user: r.session, token: r.session.token });
      return delay(Promise.reject(r.error), 80);
    }
    return apiFetch<{ user: Session; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }).then((data) => {
      _session = data.user;
      _token = data.token;
      if (typeof window !== 'undefined') {
        localStorage.setItem('hc_session', JSON.stringify(_session));
        localStorage.setItem('hc_token', _token);
      }
      return data;
    });
  },
  me(): Session | null {
    if (USE_MOCK) return mock.me();
    if (typeof window !== 'undefined' && !_session) {
      const raw = localStorage.getItem('hc_session');
      if (raw) _session = JSON.parse(raw);
    }
    return _session;
  },
  logout() {
    if (USE_MOCK) { mock.logout(); return; }
    _session = null;
    _token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hc_session');
      localStorage.removeItem('hc_token');
    }
  },

  // ---- devices ----
  listDevices(): Promise<Device[]> {
    if (USE_MOCK) return delay(mock.listDevices());
    return apiFetch<Device[]>('/api/devices');
  },
  getDevice(id: string): Promise<Device | undefined> {
    if (USE_MOCK) return delay(mock.getDevice(id));
    return apiFetch<Device>(`/api/devices/${id}`).catch(() => undefined);
  },
  patchDevice(id: string, patch: Partial<Device>, userId: string): Promise<Device | undefined> {
    if (USE_MOCK) return delay(mock.patchDevice(id, patch, userId));
    return apiFetch<Device>(withQuery(`/api/devices/${id}`, { userId }), {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  // ---- attachments ----
  listAttachmentsByDevice(deviceId: string): Promise<Attachment[]> {
    if (USE_MOCK) return delay(mock.listAttachmentsByDevice(deviceId));
    return apiFetch<Attachment[]>(`/api/attachments/by-device/${deviceId}`);
  },
  registerAttachment(
    input: { filename: string; mimeType: string; sizeBytes?: number; attachmentType?: AttachmentType },
    userId: string,
  ): Promise<Attachment> {
    if (USE_MOCK) return delay(mock.registerAttachment(input, userId), 60);
    return apiFetch<Attachment>(withQuery('/api/attachments', { userId }), {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  parseAttachment(id: string): Promise<Attachment> {
    if (USE_MOCK) return delay(mock.parseAttachment(id), 400);
    return apiFetch<Attachment>(`/api/attachments/${id}/parse`, { method: 'POST' });
  },
  setAttachmentParseStatus(
    id: string,
    status: Attachment['parseStatus'],
    error?: string,
  ): Promise<void> {
    if (USE_MOCK) { mock.setAttachmentParseStatus(id, status, error); return delay(undefined, 60); }
    return apiFetch<Attachment>(`/api/attachments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ parseStatus: status, parseError: error }),
    }).then(() => undefined);
  },

  // ---- reminders ----
  listReminders(): Promise<Reminder[]> {
    if (USE_MOCK) return delay(mock.listReminders());
    return apiFetch<Reminder[]>('/api/reminders');
  },
  patchReminder(id: string, patch: Partial<Reminder>, userId: string): Promise<Reminder | undefined> {
    if (USE_MOCK) return delay(mock.patchReminder(id, patch, userId));
    return apiFetch<Reminder>(withQuery(`/api/reminders/${id}`, { userId }), {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  // ---- fault records ----
  listFaultRecordsByDevice(deviceId: string): Promise<FaultRecord[]> {
    if (USE_MOCK) return delay(mock.listFaultRecordsByDevice(deviceId));
    return apiFetch<FaultRecord[]>(`/api/fault-records/by-device/${deviceId}`);
  },

  // ---- agent runs ----
  listAgentRuns(): Promise<AgentRun[]> {
    if (USE_MOCK) return delay(mock.listAgentRuns());
    return apiFetch<AgentRun[]>('/api/agent/runs');
  },
  getAgentRun(id: string): Promise<AgentRun | undefined> {
    if (USE_MOCK) return delay(mock.getAgentRun(id));
    return apiFetch<AgentRun>(`/api/agent/runs/${id}`).catch(() => undefined);
  },
  startAgentRun(input: mock.RunInput): Promise<AgentRun> {
    if (USE_MOCK) return delay(mock.startAgentRun(input), 500);
    return apiFetch<AgentRun>('/api/agent/runs', {
      method: 'POST',
      body: JSON.stringify({
        inputText: input.inputText,
        intentHint: input.intentHint,
        attachmentIds: input.attachmentIds,
        context: input.context,
        userId: input.userId,
      }),
    });
  },
  confirmAgentRun(runId: string, input: mock.ConfirmInput): Promise<AgentRun> {
    if (USE_MOCK) return delay(mock.confirmAgentRun(runId, input), 400);
    return apiFetch<AgentRun>(`/api/agent/runs/${runId}/confirm`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  requestSaveFaultRecordConfirmation(runId: string, userId: string): Promise<AgentRun> {
    if (USE_MOCK) return delay(mock.requestSaveFaultRecordConfirmation(runId), 200);
    return apiFetch<AgentRun>(`/api/agent/runs/${runId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ action: 'save_fault_record', userId }),
    });
  },

  // ---- settings ----
  getSettings(userId: string): Promise<Settings> {
    if (USE_MOCK) return delay(mock.getSettings(userId));
    return apiFetch<Settings>(withQuery('/api/settings', { userId }));
  },

  // ---- utils ----
  resetDemoData(): Promise<void> {
    if (USE_MOCK) {
      mock.resetDemoData();
      return Promise.resolve();
    }
    return apiFetch<{ ok: boolean }>('/api/settings/reset', { method: 'POST' }).then(() => undefined);
  },
  exportData(): Promise<string> {
    if (USE_MOCK) return Promise.resolve(mock.exportData());
    return apiFetch<Record<string, unknown>>('/api/settings/export').then((data) =>
      JSON.stringify(data, null, 2),
    );
  },
};

export type { RunInput, ConfirmInput } from './mock-backend';
