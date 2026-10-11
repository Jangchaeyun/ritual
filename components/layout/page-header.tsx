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
      <p className="text-[11px] font-medium tracking-[0.22em] text-[#8a847c]">{kicker}</p>
      <h1 className="mt-2 text-[1.75rem] font-medium tracking-[-0.03em] text-[#1c2430]">{title}</h1>
      {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f6a64]">{description}</p> : null}
    </header>
  );
}
