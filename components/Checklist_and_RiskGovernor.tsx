// Save this to: src/components/Checklist_and_RiskGovernor.tsx
// Minimal subset needed when NOT adding a new tab.
// Provides only useRiskGovernor and helpers (no Checklist UI).

'use client';

import { useEffect, useMemo, useState } from 'react';

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function writeLS<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function useStickyState<T>(key: string, initial: T) {
  const [val, setVal] = useState<T>(() => readLS<T>(key, initial));
  useEffect(() => { writeLS<T>(key, val); }, [key, val]);
  return [val, setVal] as const;
}

export type RiskGovernorInput = {
  startBalance: number;
  equity: number;
  sessionLossSoFar: number; // negative or 0
  todayLossSoFar: number;   // negative or 0
  riskAmountRequested: number;
};
export type RiskGovernorState = {
  profit: number;
  thresholdAmount: number;
  profitOnlyActive: boolean;
  remainingProfit: number;
  effectiveRisk: number;
  locked: boolean;
  lockReason: string | null;
  statusChip: string;
  maxSessionLoss: number;
  maxDailyLoss: number;
};

const LS = {
  armed: 'ust-checklist-armed',            // default false
  thresholdPct: 'ust-checklist-thresholdPct', // default 30
  doNotRiskCapital: 'ust-checklist-doNotRiskCapital', // default true
  sessionMaxLossMode: 'ust-checklist-sessionMaxLossMode', // 'profitDiv4' | 'custom'
  sessionMaxLossValue: 'ust-checklist-sessionMaxLossValue', // number when 'custom'
  dailyMaxLossPct: 'ust-checklist-dailyMaxLossPct', // default 50
  givebackPct: 'ust-checklist-givebackPct', // default 50
} as const;
type LossMode = 'profitDiv4' | 'custom';

export function useRiskGovernor(input: RiskGovernorInput): RiskGovernorState {
  const [armed] = useStickyState<boolean>(LS.armed, true);         // armed by default since no UI tab
  const [thresholdPct] = useStickyState<number>(LS.thresholdPct, 30);
  const [doNotRiskCapital] = useStickyState<boolean>(LS.doNotRiskCapital, true);
  const [sessionMaxLossMode] = useStickyState<LossMode>(LS.sessionMaxLossMode, 'profitDiv4');
  const [sessionMaxLossValue] = useStickyState<number>(LS.sessionMaxLossValue, 0);
  const [dailyMaxLossPct] = useStickyState<number>(LS.dailyMaxLossPct, 50);
  const [givebackPct] = useStickyState<number | null>(LS.givebackPct, 50);

  const profit = Math.max(0, input.equity - input.startBalance);
  const thresholdAmount = (thresholdPct / 100) * input.startBalance;
  const profitOnlyActive = !!armed && profit >= thresholdAmount;

  const sessionLossAbs = Math.abs(input.sessionLossSoFar || 0);
  const todayLossAbs = Math.abs(input.todayLossSoFar || 0);
  const remainingProfit = Math.max(0, profit - sessionLossAbs);

  const capIsActive = profitOnlyActive || doNotRiskCapital;
  const effectiveRisk = capIsActive
    ? Math.min(input.riskAmountRequested, remainingProfit)
    : input.riskAmountRequested;

  const maxSessionLoss = (sessionMaxLossMode === 'profitDiv4')
    ? profit / 4
    : Math.max(0, sessionMaxLossValue || 0);
  const maxDailyLoss = (dailyMaxLossPct >= 0) ? (dailyMaxLossPct / 100) * profit : Infinity;

  let locked = false;
  let lockReason: string | null = null;
  if (capIsActive && remainingProfit <= 0) { locked = true; lockReason = 'Profit exhausted.'; }
  if (!locked && maxSessionLoss > 0 && sessionLossAbs >= maxSessionLoss) { locked = true; lockReason = 'Max session loss reached.'; }
  if (!locked && isFinite(maxDailyLoss) && maxDailyLoss > 0 && todayLossAbs >= maxDailyLoss) { locked = true; lockReason = 'Max daily loss reached.'; }
  if (!locked && givebackPct != null && givebackPct >= 0) {
    const givebackAmt = (givebackPct / 100) * profit;
    if (todayLossAbs >= givebackAmt) { locked = true; lockReason = `Giveback lock at ${givebackPct}% of profit.`; }
  }

  const statusChip = locked ? 'Locked' : (profitOnlyActive ? 'Active • Profit-Only' : 'Active • Standard');

  return {
    profit,
    thresholdAmount,
    profitOnlyActive,
    remainingProfit,
    effectiveRisk,
    locked,
    lockReason,
    statusChip,
    maxSessionLoss,
    maxDailyLoss,
  };
}
