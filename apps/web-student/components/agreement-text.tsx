/** Renders the agreement markup ("# ", "## ", "- ", blank-line paragraphs) as readable HTML. */
export function AgreementText({ body }: { body: string }) {
  const blocks = body.split(/\n\s*\n/);
  return (
    <div className="space-y-3 text-[15px] leading-7 text-slate-700">
      {blocks.map((block, i) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.every((l) => l.startsWith('- '))) {
          return (
            <ul key={i} className="square-list space-y-1.5">
              {lines.map((l, j) => <li key={j}>{l.slice(2)}</li>)}
            </ul>
          );
        }
        return lines.map((l, j) =>
          l.startsWith('# ') ? (
            <h2 key={`${i}-${j}`} className="display pb-2 text-[clamp(2rem,4vw,2.75rem)] text-ink">{l.slice(2)}</h2>
          ) : l.startsWith('## ') ? (
            <h3 key={`${i}-${j}`} className="border-b border-dashed border-ink/20 pb-1 pt-5 text-base font-extrabold text-ink">{l.slice(3)}</h3>
          ) : l.startsWith('- ') ? (
            <ul key={`${i}-${j}`} className="square-list">
              <li>{l.slice(2)}</li>
            </ul>
          ) : (
            <p key={`${i}-${j}`}>{l}</p>
          ),
        );
      })}
    </div>
  );
}
