import { STORAGE_KEYS } from "@/config/defaults";
import { FinanceInputs } from "@/types/finance";
import { MonthlyRecord } from "@/types/record";

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  getFinanceInputs(defaultValue: FinanceInputs): FinanceInputs {
    return safeGet(STORAGE_KEYS.finance, defaultValue);
  },
  setFinanceInputs(value: FinanceInputs): void {
    safeSet(STORAGE_KEYS.finance, value);
  },
  getRecords(): MonthlyRecord[] {
    return safeGet(STORAGE_KEYS.records, [] as MonthlyRecord[]);
  },
  setRecords(value: MonthlyRecord[]): void {
    safeSet(STORAGE_KEYS.records, value);
  },
  clearAll(): void {
    if (typeof window === "undefined") return;
    Object.values(STORAGE_KEYS).forEach((k) => window.localStorage.removeItem(k));
  },
};
