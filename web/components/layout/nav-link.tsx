"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function NavLink({ href, children, className }: NavLinkProps) {
  const pathname = usePathname();
  // Active if exact match or if current route starts with href (for section matches)
  const isActive =
    pathname === href ||
    (href !== "/" && pathname?.startsWith(href));

  return (
    <Link
      href={href}
      className={cn(
        "relative px-1 py-2 text-sm font-medium transition-colors",
        isActive
          ? "text-fg"
          : "text-fg-muted hover:text-fg",
        className
      )}
    >
      {children}
      {isActive && (
        <span className="absolute -bottom-[1px] left-0 right-0 h-px bg-accent" />
      )}
    </Link>
  );
}
