function Card({ title, children, actions }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-inner shadow-slate-950">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        {actions && <div className="text-sm text-slate-400">{actions}</div>}
      </header>
      <div>{children}</div>
    </section>
  );
}

export default Card;
