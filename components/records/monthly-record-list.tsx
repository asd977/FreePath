import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { MonthlyRecord } from "@/types/record";

type Props = {
  records: MonthlyRecord[];
  onDelete: (id: string) => void;
};

export function MonthlyRecordList({ records, onDelete }: Props) {
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
                <p className="text-sm text-slate-700">{formatCurrency(record.amount)}</p>
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
