/** Renders the agreement markup ("# ", "## ", "- ", blank-line paragraphs) as readable HTML. */
export function AgreementText({ body }: { body: string }) {
  const blocks = body.split(/\n\s*\n/);
  return (
    <div className="space-y-3 text-[15px] leading-7 text-slate-700">
      {blocks.map((block, i) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.every((l) => l.startsWith('- '))) {
          return (
            <ul key={i} className="ml-5 list-disc space-y-1">
              {lines.map((l, j) => <li key={j}>{l.slice(2)}</li>)}
            </ul>
          );
        }
        return lines.map((l, j) =>
          l.startsWith('# ') ? (
            <h2 key={`${i}-${j}`} className="text-2xl font-black text-slate-900">{l.slice(2)}</h2>
          ) : l.startsWith('## ') ? (
            <h3 key={`${i}-${j}`} className="pt-3 text-base font-bold text-slate-900">{l.slice(3)}</h3>
          ) : l.startsWith('- ') ? (
            <p key={`${i}-${j}`} className="ml-5">• {l.slice(2)}</p>
          ) : (
            <p key={`${i}-${j}`}>{l}</p>
          ),
        );
      })}
    </div>
  );
}
