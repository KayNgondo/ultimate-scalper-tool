import React, { createContext, useContext, useRef, useState, ReactNode, HTMLAttributes } from "react";

type PopoverCtxT = {
  open: boolean;
  setOpen: (o: boolean) => void;
  triggerRef: React.RefObject<HTMLDivElement>;
};
const PopoverCtx = createContext<PopoverCtxT | null>(null);

type PopProps = {
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export function Popover({ open, onOpenChange, children }: PopProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const controlled = typeof open === "boolean";
  const isOpen = controlled ? open : internalOpen;
  const setOpen = (o: boolean) => {
    if (controlled) onOpenChange?.(o);
    else setInternalOpen(o);
  };
  return (
    <PopoverCtx.Provider value={{ open: isOpen, setOpen, triggerRef }}>
      <div className="relative inline-block">{children}</div>
    </PopoverCtx.Provider>
  );
}

export function PopoverTrigger({ asChild, children }: { asChild?: boolean; children: ReactNode }) {
  const ctx = useContext(PopoverCtx)!;
  const child = (
    <div ref={ctx.triggerRef} onClick={() => ctx.setOpen(!ctx.open)} className="inline-block w-full">
      {children}
    </div>
  );
  return asChild ? (<>{child}</>) : child;
}

type ContentProps = { align?: "start" | "center" | "end"; children: ReactNode } & HTMLAttributes<HTMLDivElement>;
export function PopoverContent({ align, children, className, ...rest }: ContentProps) {
  const ctx = useContext(PopoverCtx)!;
  if (!ctx.open) return null;
  return (
    <div
      {...rest}
      className={["absolute mt-1 rounded-md bg-white border shadow-md z-50", className].filter(Boolean).join(" ")}
      style={{ minWidth: "100%" }}
    >
      {children}
    </div>
  );
}
