import Link from "next/link";
import { FileText, Mail } from "lucide-react";
import { NavLink } from "./nav-link";
import { NAV_ITEMS } from "@/lib/nav";
import { getSiteMeta, getSummary } from "@/lib/data";

function formatTournamentUpdate(timestamp?: string | null) {
  if (!timestamp) {
    return "Update pending";
  }

  const formatted = new Intl.DateTimeFormat("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Singapore",
  }).format(new Date(timestamp));

  return `${formatted} SGT`;
}

function GithubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.39-5.27 5.68.41.35.78 1.05.78 2.12 0 1.53-.01 2.77-.01 3.14 0 .3.2.66.79.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

export function SiteHeader() {
  const siteMeta = getSiteMeta();
  const summary = getSummary();
  const lastUpdated = formatTournamentUpdate(
    siteMeta?.tournament_last_updated_at ?? summary.dataset_info.updated_at
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-bg/70 backdrop-blur-xl backdrop-saturate-150">
      <div className="border-b border-border-subtle/80 bg-bg-elevated/50">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-6 py-2 text-[11px] text-fg-muted md:px-10 lg:px-12 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-2" aria-hidden="true" />
            <span className="font-medium uppercase tracking-[0.14em] text-fg-dim">
              Last updated
            </span>
            <span className="font-mono text-fg">{lastUpdated}</span>
          </div>

          <Link
            href="/submit-model"
            className="inline-flex items-center gap-1.5 font-medium text-accent transition-colors hover:text-accent-hover"
          >
            <Mail className="h-3.5 w-3.5" />
            Want your model featured? Contact us
          </Link>
        </div>
      </div>

      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-6 md:px-10 lg:px-12">
        {/* Wordmark */}
        <Link
          href="/"
          className="flex items-baseline gap-1.5 text-sm font-semibold tracking-tight"
        >
          <span className="font-display text-[19px] leading-none">Deep Research</span>
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase leading-none text-accent">Arena</span>
        </Link>

        {/* Center navigation */}
        <nav className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Right side — external links */}
        <div className="flex items-center gap-1">
          <a
            href="https://arxiv.org/abs/2601.10504"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-fg-muted transition-colors hover:bg-bg-elevated hover:text-fg"
            aria-label="Paper on arXiv"
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Paper</span>
          </a>
          <a
            href="https://github.com/iNLP-Lab/DR-Arena"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-fg-muted transition-colors hover:bg-bg-elevated hover:text-fg"
            aria-label="Source on GitHub"
          >
            <GithubMark className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </div>
    </header>
  );
}
