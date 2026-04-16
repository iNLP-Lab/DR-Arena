"use client";

import { ChevronDown, Eye } from "lucide-react";
import { useState, type ReactNode } from "react";

type EvidenceToggleProps = {
  eyebrow: string;
  label: string;
  children: ReactNode;
};

export function EvidenceToggle({ eyebrow, label, children }: EvidenceToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const action = isOpen ? `Hide ${label}` : `Show ${label}`;

  return (
    <div className="border-t border-border-subtle bg-bg/40">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
        className="group flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-bg-elevated/55 md:px-6"
      >
        <span className="min-w-0">
          <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-dim">
            {eyebrow}
          </span>
          <span className="mt-1 flex items-center gap-2 text-sm font-semibold text-fg md:text-base">
            <Eye className="h-4 w-4 text-accent" />
            {action}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-fg-dim transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
