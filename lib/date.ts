export function addMonths(yyyyMm: string, monthsToAdd: number): string {
  const [year, month] = yyyyMm.split("-").map(Number);
  const base = new Date(Date.UTC(year, month - 1 + monthsToAdd, 1));
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthDiff(startYyyyMm: string, endYyyyMm: string): number {
  const [sy, sm] = startYyyyMm.split("-").map(Number);
  const [ey, em] = endYyyyMm.split("-").map(Number);
  return (ey - sy) * 12 + (em - sm);
}

export function toReadableMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-");
  return `${year}年${month}月`;
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
