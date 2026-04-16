"use client";

import { useState } from "react";
import { Check, Copy, Mail, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MODEL_SUBMISSION_BODY,
  MODEL_SUBMISSION_EMAIL,
  MODEL_SUBMISSION_MAILTO,
  MODEL_SUBMISSION_SUBJECT,
} from "@/lib/site";

type CopyTarget = "email" | "subject" | "template" | null;

export function ModelSubmissionPanel() {
  const [copied, setCopied] = useState<CopyTarget>(null);

  async function copyText(target: Exclude<CopyTarget, null>, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      window.setTimeout(() => setCopied((current) => (current === target ? null : current)), 1800);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-[28px] border border-border bg-bg-elevated/70 px-6 py-7 backdrop-blur-sm md:px-8">
        <div className="app-kicker text-accent">Submission channel</div>
        <h1 className="font-display mt-4 text-3xl leading-[0.98] tracking-tight md:text-[3.75rem]">
          Submit a model for Deep Research Arena.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-fg-muted md:text-base">
          Send the team the model identity, access details, and evaluation constraints needed
          to consider it for the leaderboard.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => copyText("email", MODEL_SUBMISSION_EMAIL)}
            className="rounded-2xl border border-border-subtle bg-bg/65 px-4 py-4 text-left transition-colors hover:border-accent/30 hover:bg-bg-elevated"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-fg-dim">
                Contact email
              </span>
              {copied === "email" ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4 text-fg-dim" />}
            </div>
            <div className="mt-2 break-all font-mono text-sm text-fg">{MODEL_SUBMISSION_EMAIL}</div>
          </button>

          <button
            type="button"
            onClick={() => copyText("subject", MODEL_SUBMISSION_SUBJECT)}
            className="rounded-2xl border border-border-subtle bg-bg/65 px-4 py-4 text-left transition-colors hover:border-accent/30 hover:bg-bg-elevated"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-fg-dim">
                Email subject
              </span>
              {copied === "subject" ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4 text-fg-dim" />}
            </div>
            <div className="mt-2 text-sm font-medium text-fg">{MODEL_SUBMISSION_SUBJECT}</div>
          </button>

          <div className="rounded-2xl border border-border-subtle bg-bg/65 px-4 py-4">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-fg-dim">
              Email action
            </div>
            <div className="mt-3">
              <Button asChild size="sm" className="w-full">
                <a href={MODEL_SUBMISSION_MAILTO}>
                  <Mail className="h-4 w-4" />
                  Open email app
                </a>
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] border border-border bg-bg/60 p-4 md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-fg-dim">
                Suggested template
              </div>
              <p className="mt-1 text-sm text-fg-muted">
                Copy this into your email so the team gets the information needed to evaluate your model.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyText("template", MODEL_SUBMISSION_BODY)}
            >
              {copied === "template" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copy template
            </Button>
          </div>

          <pre className="mt-4 overflow-x-auto rounded-2xl border border-border-subtle bg-bg-elevated/80 p-4 font-mono text-xs leading-6 text-fg">
            {MODEL_SUBMISSION_BODY}
          </pre>
        </div>
      </div>

      <aside className="rounded-[28px] border border-border bg-bg-elevated/55 px-6 py-7 backdrop-blur-sm md:px-8">
        <div className="app-kicker">What to include</div>
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-border-subtle bg-bg/65 px-4 py-4">
            <div className="text-sm font-semibold text-fg">Model identity</div>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">
              Include the exact model name, provider, and any public product page or technical documentation link.
            </p>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-bg/65 px-4 py-4">
            <div className="text-sm font-semibold text-fg">Access details</div>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">
              Share how the model is accessed, such as API endpoint, platform, or evaluation constraints the team should know about.
            </p>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-bg/65 px-4 py-4">
            <div className="text-sm font-semibold text-fg">Evaluation readiness</div>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">
              If there are rate limits, required tools, or search capabilities involved, mention them up front.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-accent/20 bg-accent/[0.06] px-4 py-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
            SUTD iNLP Lab
          </div>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            The SUTD iNLP group led by Wenxuan Zhang works on language-model research
            spanning reasoning, safety, efficiency, multilinguality, and trustworthy AI.
          </p>
          <a
            href="https://isakzhang.github.io/group.html"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
          >
            Lab page
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-4 rounded-2xl border border-border-subtle bg-bg/65 px-4 py-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-fg-dim">
            Benchmark maintainer
          </div>
          <div className="mt-3 flex flex-col items-start gap-2">
            <a
              href="mailto:matthewchristopherpohadi@gmail.com"
              className="inline-flex items-center gap-1.5 break-all text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            >
              matthewchristopherpohadi@gmail.com
              <Mail className="h-4 w-4 shrink-0" />
            </a>
            <a
              href="https://matthewchristopherpohadi.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            >
              Portfolio
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <a
              href="https://www.linkedin.com/in/matthewchristopherpohadi/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            >
              LinkedIn profile
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </aside>
    </section>
  );
}
