"use client";

import { useState } from "react";
import { LeaderboardTable } from "./leaderboard-table";
import { PairwiseMatrix } from "./pairwise-matrix";
import { ModelInspector } from "./model-inspector";
import type { LeaderboardEntry, Battle, PairwiseData, ModelMetaMap, FailureProfiles } from "@/lib/types";

interface Props {
  leaderboard: LeaderboardEntry[];
  battles: Battle[];
  pairwise: PairwiseData;
  modelMeta: ModelMetaMap;
  failureProfiles: FailureProfiles;
}

export function LeaderboardShell({ leaderboard, battles, pairwise, modelMeta, failureProfiles }: Props) {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <section className="surface-ledger overflow-hidden rounded-[28px]">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_340px]">
          <LeaderboardTable
            data={leaderboard}
            modelMeta={modelMeta}
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
          />

          <div className="section-divider xl:hidden" />

          <div className="hidden xl:block xl:border-l xl:border-border-subtle">
            <div className="sticky top-20 p-6">
              <ModelInspector
                selectedModel={selectedModel}
                leaderboard={leaderboard}
                modelMeta={modelMeta}
                battles={battles}
                failureProfiles={failureProfiles}
              />
            </div>
          </div>

          <div className="p-5 xl:hidden">
            <ModelInspector
              selectedModel={selectedModel}
              leaderboard={leaderboard}
              modelMeta={modelMeta}
              battles={battles}
              failureProfiles={failureProfiles}
            />
          </div>
        </div>
      </section>

      <section className="surface-ledger overflow-hidden rounded-[28px]">
        <div className="flex items-end justify-between border-b border-border-subtle px-5 py-4 md:px-6">
          <div>
            <h2 className="text-base font-semibold text-fg">Head-to-Head Win Rates</h2>
            <p className="mt-1 text-sm text-fg-dim">Observed win rate from the row model&apos;s perspective.</p>
          </div>
        </div>
        <div className="px-3 py-4 md:px-5">
          <PairwiseMatrix pairwise={pairwise} modelMeta={modelMeta} />
        </div>
      </section>
    </div>
  );
}
