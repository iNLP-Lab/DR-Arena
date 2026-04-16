import { cn } from "@/lib/utils";

interface PagePlaceholderProps {
  kicker: string;
  title: string;
  description: string;
  milestone: string;
  className?: string;
}

export function PagePlaceholder({
  kicker,
  title,
  description,
  milestone,
  className,
}: PagePlaceholderProps) {
  return (
    <div
      className={cn(
        "relative mx-auto flex w-full max-w-3xl flex-col items-center px-6 py-20 text-center md:py-32",
        className
      )}
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -z-10 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-accent/[0.06] blur-[120px]"
      />

      {/* Kicker pill */}
      <div className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/[0.06] px-4 py-1.5 backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
          {kicker}
        </span>
      </div>

      {/* Title */}
      <h1
        className="animate-fade-in-up font-display mt-6 text-4xl leading-[1.08] tracking-tight md:text-[56px] md:leading-[1.05]"
        style={{ animationDelay: "0.1s" }}
      >
        {title}
      </h1>

      {/* Description */}
      <p
        className="animate-fade-in-up mt-5 max-w-xl text-base leading-relaxed text-fg-muted"
        style={{ animationDelay: "0.2s" }}
      >
        {description}
      </p>

      {/* Milestone badge */}
      <div
        className="animate-fade-in-up mt-10 inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated/60 px-4 py-2.5 backdrop-blur-sm"
        style={{ animationDelay: "0.3s" }}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
        </span>
        <span className="text-xs font-medium text-fg-muted">
          Coming in {milestone}
        </span>
      </div>
    </div>
  );
}
