export default function SummaryCard({ label, value, accent, helper }) {
  return (
    <article className="rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div
        className="mb-4 h-2 w-16 rounded-full"
        style={{ backgroundColor: accent }}
      />
      <p className="text-sm uppercase tracking-[0.2em] text-steel">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-ink">{value}</p>
      {helper ? <p className="mt-2 text-sm text-steel">{helper}</p> : null}
    </article>
  );
}
