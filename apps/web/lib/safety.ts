import type { FaultRiskLevel } from './types';

// 真实高风险安全判断 — EXECUTION_PLAN §9.5 / §12.2
// 命中关键词即视为高风险，必须保守拒答。

export const HIGH_RISK_KEYWORDS: string[] = [
  '漏电',
  '电击',
  '燃气味',
  '煤气味',
  '明火',
  '冒烟',
  '爆炸',
  '电池鼓包',
  '电池发烫',
  '带电拆机',
  '带电维修',
  '短路',
  '高压',
  '烧焦味',
  '漏气',
  '触电',
];

export interface SafetyCheckResult {
  isHighRisk: boolean;
  riskLevel: FaultRiskLevel;
  matchedKeywords: string[];
}

export function detectSafetyRisk(text: string): SafetyCheckResult {
  const lower = text.toLowerCase();
  const matched = HIGH_RISK_KEYWORDS.filter((k) =>
    text.includes(k) || lower.includes(k.toLowerCase()),
  );
  const isHighRisk = matched.length > 0;
  // 拆机/带电维修类判断
  const disassembly =
    text.includes('拆开') ||
    text.includes('拆机') ||
    text.includes('拆修') ||
    text.includes('自己修') ||
    text.includes('拆开修');
  if (disassembly && !isHighRisk) {
    return { isHighRisk: true, riskLevel: 'high', matchedKeywords: ['需要拆机维修'] };
  }
  return {
    isHighRisk,
    riskLevel: isHighRisk ? 'high' : 'low',
    matchedKeywords: matched,
  };
}

export const SAFETY_GUIDANCE: string[] = [
  '立即停止使用该设备',
  '断开电源 / 关闭燃气阀门 / 远离现场',
  '不要尝试带电拆机、燃气维修或复杂拆机',
  '联系官方售后或专业维修人员处理',
];

export const SAFETY_TITLE = '检测到高风险情况';
export const SAFETY_MESSAGE =
  '这类故障涉及安全风险，我不能提供拆机或带电维修步骤。请先确保人身安全，再联系官方售后或专业人员。';
