export type RecordType = "deposit" | "expense";

export type MonthlyRecord = {
  id: string;
  month: string;
  amount: number;
  type: RecordType;
  note?: string;
  createdAt: string;
};
