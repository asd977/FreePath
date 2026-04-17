export function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
      {description ? <p className="text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}
