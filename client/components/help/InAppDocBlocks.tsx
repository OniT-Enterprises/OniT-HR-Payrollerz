import { ShieldCheck } from "lucide-react";
import type { DocBlock } from "@/lib/docs/types";
import { cn } from "@/lib/utils";

function Prose({ body }: { body: string }) {
  return (
    <>
      {body.split(/\n\s*\n/).map((paragraph, index) => (
        <p
          key={index}
          className="mt-3 leading-7 text-muted-foreground first:mt-0"
        >
          {paragraph.trim()}
        </p>
      ))}
    </>
  );
}

/** App-shell renderer for the same typed content used by the public guides. */
export function InAppDocBlock({ block }: { block: DocBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <h2
          id={block.id}
          className="mt-10 scroll-mt-20 text-xl font-bold tracking-tight sm:text-2xl"
        >
          {block.text}
        </h2>
      );
    case "prose":
      return (
        <div className="mt-3 max-w-3xl text-sm sm:text-base">
          <Prose body={block.body} />
        </div>
      );
    case "list":
      return (
        <ul className="mt-4 max-w-3xl space-y-2.5 text-sm text-muted-foreground sm:text-base">
          {block.items.map((item, index) => (
            <li key={index} className="flex gap-3 leading-7">
              <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="mt-5 max-w-3xl space-y-4">
          {block.items.map((step, index) => (
            <li key={index} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {index + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-semibold sm:text-base">
                  {step.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      );
    case "callout":
      return (
        <div className="mt-5 flex max-w-3xl items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm leading-6 text-foreground/85">{block.body}</p>
        </div>
      );
    case "deadlines":
      return (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {block.items.map((deadline, index) => (
            <div key={index} className="rounded-xl border border-border/70 p-4">
              <p className="text-2xl font-bold tabular-nums text-primary">
                {deadline.day}
                <span className="ml-1.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {deadline.small}
                </span>
              </p>
              <h3 className="mt-2 text-sm font-semibold">{deadline.title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {deadline.body}
              </p>
            </div>
          ))}
        </div>
      );
    case "ledger":
      return (
        <div className="mt-5 max-w-lg rounded-xl border border-border/70">
          <div className="flex items-baseline justify-between gap-3 border-b border-border/70 px-4 py-3">
            <h3 className="text-sm font-semibold">{block.title}</h3>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {block.when}
            </span>
          </div>
          <div className="px-4 py-3 font-mono text-xs">
            {block.rows.map((row, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-baseline justify-between gap-3 py-1.5",
                  row.side === "cr" && "pl-6",
                )}
              >
                <span
                  className={
                    row.side === "dr"
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }
                >
                  <span className="text-muted-foreground">{row.code}</span>{" "}
                  {row.name}
                </span>
                <span className="font-bold text-primary">
                  {row.side === "dr" ? "Dr" : "Cr"}
                </span>
              </div>
            ))}
          </div>
          <p className="border-t border-border/70 px-4 py-3 text-xs leading-5 text-muted-foreground">
            {block.foot}
          </p>
        </div>
      );
    case "table":
      return (
        <div className="mt-5">
          {/* On a narrow phone, a horizontally scrolling table hides the most
              useful columns. Repeat each row as a labelled card instead. */}
          <div className="space-y-3 sm:hidden" data-testid="doc-table-cards">
            {block.rows.map((row, rowIndex) => (
              <dl
                key={rowIndex}
                className="rounded-xl border border-border/70 bg-card p-4"
              >
                {row.map((cell, cellIndex) => (
                  <div
                    key={cellIndex}
                    className="border-b border-border/50 py-2.5 first:pt-0 last:border-b-0 last:pb-0"
                  >
                    <dt className="text-xs font-semibold text-muted-foreground">
                      {block.headers[cellIndex]}
                    </dt>
                    <dd
                      className={cn(
                        "mt-1 text-sm leading-6",
                        cellIndex === 0
                          ? "font-medium text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {cell}
                    </dd>
                  </div>
                ))}
              </dl>
            ))}
          </div>

          <div
            className="hidden overflow-x-auto rounded-xl border border-border/70 sm:block"
            data-testid="doc-table-desktop"
          >
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {block.headers.map((header, index) => (
                    <th
                      key={index}
                      className="border-b border-border/70 px-3 py-2.5 text-left text-xs font-semibold"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className={cn(
                          "border-b border-border/50 px-3 py-2.5 align-top leading-6 last:border-b-0",
                          cellIndex === 0
                            ? "font-medium"
                            : "text-muted-foreground",
                        )}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
  }
}
