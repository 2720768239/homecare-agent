import type { Device, WarrantyStatus } from './types';

// 真实保修状态计算 — EXECUTION_PLAN §9.4
// 规则：
//   无 purchaseDate 或无 warrantyMonths → unknown
//   当前日期 > warrantyExpireDate → expired
//   距离过保 <= 30 天 → expiring
//   其他 → active

export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // handle month overflow (e.g. Jan 31 + 1 month)
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function calcWarrantyExpireDate(
  purchaseDate?: string,
  warrantyMonths?: number,
): string | undefined {
  if (!purchaseDate || !warrantyMonths) return undefined;
  return addMonths(purchaseDate, warrantyMonths);
}

export function calcWarrantyStatus(
  purchaseDate?: string,
  warrantyMonths?: number,
  now: Date = new Date(),
): { status: WarrantyStatus; expireDate?: string; daysRemaining?: number } {
  if (!purchaseDate || !warrantyMonths) {
    return { status: 'unknown' };
  }
  const expireDate = calcWarrantyExpireDate(purchaseDate, warrantyMonths);
  if (!expireDate) return { status: 'unknown' };

  const today = toISODate(now);
  if (today > expireDate) {
    return { status: 'expired', expireDate };
  }
  const daysRemaining = diffDays(today, expireDate);
  if (daysRemaining <= 30) {
    return { status: 'expiring', expireDate, daysRemaining };
  }
  return { status: 'active', expireDate, daysRemaining };
}

export function diffDays(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + 'T00:00:00').getTime();
  const b = new Date(toISO + 'T00:00:00').getTime();
  return Math.round((b - a) / 86400000);
}

export function deviceWarrantyStatus(d: Device): WarrantyStatus {
  return calcWarrantyStatus(d.purchaseDate, d.warrantyMonths).status;
}

export const WARRANTY_STATUS_LABEL: Record<WarrantyStatus, string> = {
  active: '保修中',
  expiring: '即将过保',
  expired: '已过保',
  unknown: '保修未知',
};
