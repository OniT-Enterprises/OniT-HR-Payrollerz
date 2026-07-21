/**
 * Shared renderers for public docs content blocks (client/lib/docs/types.ts)
 * — the visual language established by /docs/payroll-money-chain: lime
 * accent, ledger cards with classic credit indentation, deadline cards with
 * tabular-nums, bordered callouts. One accent per page (lime).
 */
import type { DocBlock } from "@/lib/docs/types";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

function Prose({ body }: { body: string }) {
  return (
    <>
      {body.split(/\n\s*\n/).map((paragraph, index) => (
        <p
          key={index}
          className="mt-4 max-w-2xl leading-7 text-zinc-400 first:mt-0"
        >
          {paragraph.trim()}
        </p>
      ))}
    </>
  );
}

export function DocBlockRenderer({ block }: { block: DocBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <h2
          id={block.id}
          className="mt-14 scroll-mt-32 text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
        >
          {block.text}
        </h2>
      );
    case "prose":
      return (
        <div className="mt-4">
          <Prose body={block.body} />
        </div>
      );
    case "list":
      return (
        <ul className="mt-4 max-w-2xl space-y-2">
          {block.items.map((item, index) => (
            <li key={index} className="flex gap-3 leading-7 text-zinc-400">
              <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-lime-400/70" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="mt-6 max-w-2xl space-y-5">
          {block.items.map((step, index) => (
            <li key={index} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-lime-400/40 font-mono text-[13px] font-bold text-lime-300">
                {index + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[15px] font-bold text-white">{step.title}</p>
                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      );
    case "callout":
      return (
        <div className="mt-6 flex max-w-2xl items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-lime-300" />
          <p className="text-sm leading-relaxed text-zinc-300">{block.body}</p>
        </div>
      );
    case "deadlines":
      return (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {block.items.map((deadline, index) => (
            <div
              key={index}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"
            >
              <p className="font-mono text-3xl font-bold tabular-nums tracking-tight text-lime-300">
                {deadline.day}
                <span className="ml-1.5 align-middle text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  {deadline.small}
                </span>
              </p>
              <h3 className="mt-2 text-[15px] font-bold text-white">
                {deadline.title}
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
                {deadline.body}
              </p>
            </div>
          ))}
        </div>
      );
    case "ledger":
      return (
        <div className="mt-6 max-w-md rounded-2xl border border-white/[0.07] bg-white/[0.025]">
          <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.07] px-5 py-3.5">
            <h3 className="text-sm font-bold text-white">{block.title}</h3>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              {block.when}
            </span>
          </div>
          <div className="px-5 py-3 font-mono text-[12.5px]">
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
                    row.side === "dr" ? "text-zinc-200" : "text-zinc-400"
                  }
                >
                  <span className="text-zinc-500">{row.code}</span> {row.name}
                </span>
                <span
                  className={cn(
                    "font-bold",
                    row.side === "dr" ? "text-lime-300" : "text-zinc-500",
                  )}
                >
                  {row.side === "dr" ? "Dr" : "Cr"}
                </span>
              </div>
            ))}
          </div>
          <p className="border-t border-white/[0.07] px-5 py-3 text-xs leading-relaxed text-zinc-500">
            {block.foot}
          </p>
        </div>
      );
    case "table":
      return (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full max-w-3xl border-collapse text-sm">
            <thead>
              <tr>
                {block.headers.map((header, index) => (
                  <th
                    key={index}
                    className="border-b border-white/15 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-500"
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
                        "border-b border-white/[0.06] px-3 py-2.5 align-top leading-6",
                        cellIndex === 0
                          ? "font-semibold text-zinc-200"
                          : "text-zinc-400",
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
      );
  }
}
