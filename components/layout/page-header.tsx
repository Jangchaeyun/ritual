export function PageHeader({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-6">
      <p className="text-[11px] font-medium tracking-[0.22em] text-muted">{kicker}</p>
      <h1 className="mt-2 text-[1.75rem] font-medium tracking-[-0.03em] text-ink">{title}</h1>
      {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-soft">{description}</p> : null}
    </header>
  );
}
