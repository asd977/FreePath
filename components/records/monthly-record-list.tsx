import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { MonthlyRecord } from "@/types/record";

type Props = {
  records: MonthlyRecord[];
  onDelete: (id: string) => void;
};

export function MonthlyRecordList({ records, onDelete }: Props) {
  const labels = {
    deposit: "存入",
    expense: "支出",
  } as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>历史记录</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {records.length === 0 ? (
          <p className="text-sm text-slate-500">暂无记录，先添加第一条月度数据。</p>
        ) : (
          records.map((record) => (
            <div key={record.id} className="flex items-start justify-between rounded-md border border-slate-200 p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">{record.month}</p>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      record.type === "expense"
                        ? "rounded px-2 py-0.5 text-xs bg-rose-100 text-rose-700"
                        : "rounded px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700"
                    }
                  >
                    {labels[record.type]}
                  </span>
                  <p className={record.type === "expense" ? "text-sm text-rose-700" : "text-sm text-emerald-700"}>
                    {record.type === "expense" ? "-" : "+"}
                    {formatCurrency(record.amount)}
                  </p>
                </div>
                {record.note ? <p className="text-xs text-slate-500">{record.note}</p> : null}
              </div>
              <Button variant="ghost" size="sm" onClick={() => onDelete(record.id)}>
                删除
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
