import React, { createContext, useContext, useState, ReactNode, HTMLAttributes } from "react";

type Ctx = { query: string; setQuery: (s: string) => void };
const CommandCtx = createContext<Ctx | null>(null);

export function Command({ children, ...rest }: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const [query, setQuery] = useState("");
  return (
    <CommandCtx.Provider value={{ query, setQuery }}>
      <div {...rest} className={["w-full", rest.className].filter(Boolean).join(" ")}>{children}</div>
    </CommandCtx.Provider>
  );
}

export function CommandInput({ placeholder }: { placeholder?: string }) {
  const ctx = useContext(CommandCtx)!;
  return (
    <div className="p-2 border-b bg-white">
      <input
        className="w-full outline-none text-sm"
        placeholder={placeholder}
        value={ctx.query}
        onChange={(e) => ctx.setQuery(e.target.value)}
      />
    </div>
  );
}

export function CommandList({ children }: { children: ReactNode }) {
  return <div className="max-h-72 overflow-auto">{children}</div>;
}

// Very minimal: will still render; visibility handled in CommandItem via filtering
export function CommandEmpty({ children }: { children?: ReactNode }) {
  // This simple shim doesn't auto-detect empty state. Keep hidden by default.
  return <div className="hidden p-3 text-sm text-slate-500">{children || "No results."}</div>;
}

export function CommandGroup({ heading, children }: { heading?: ReactNode; children: ReactNode }) {
  return (
    <div className="py-1">
      {heading && <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-slate-500">{heading}</div>}
      <div>{children}</div>
    </div>
  );
}

type ItemProps = {
  value: string;
  onSelect?: (value: string) => void;
  children: ReactNode;
};
export function CommandItem({ value, onSelect, children }: ItemProps) {
  const ctx = useContext(CommandCtx)!;
  const visible = !ctx.query || value.toLowerCase().includes(ctx.query.toLowerCase());
  return (
    <button
      type="button"
      onClick={() => onSelect?.(value)}
      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex items-center"
      style={{ display: visible ? "flex" : "none" }}
    >
      {children}
    </button>
  );
}
