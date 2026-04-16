import { BattleBrowser } from "@/components/battle/battle-browser";
import { getBattleIndex, getModelMeta } from "@/lib/data";

export const metadata = {
  title: "Battles",
  description: "Browse official Deep Research Arena matches and open replay pages for canonical matched logs.",
};

export default function BattlesPage() {
  const battleIndex = getBattleIndex();
  const modelMeta = getModelMeta();
  const replayable = battleIndex.filter((entry) => entry.replay_available).length;

  return (
    <div className="relative w-full max-w-[1440px] px-6 py-8 md:px-10 md:py-12 lg:px-12">
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 -z-10 h-[420px] w-[520px] rounded-full bg-accent-2/[0.05] blur-[150px]"
      />

      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="app-kicker">Battle browser</div>
          <h1 className="app-title mt-3">Matches and replays</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted md:text-base">
            Official match feed from the tournament root. Cards open full replay pages when a log can be matched
            unambiguously to one official battle record.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-l-0 border-border-subtle pl-0 sm:grid-cols-4 lg:border-l lg:pl-8">
          <div>
            <div className="font-mono text-2xl font-semibold tabular" data-numeric>{battleIndex.length}</div>
            <div className="app-kicker mt-1">Official Battles</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-semibold tabular" data-numeric>{replayable}</div>
            <div className="app-kicker mt-1">Replay Ready</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-semibold tabular" data-numeric>{battleIndex.filter((entry) => entry.type === "onboarding").length}</div>
            <div className="app-kicker mt-1">Onboarding</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-semibold tabular" data-numeric>{battleIndex.length - replayable}</div>
            <div className="app-kicker mt-1">Summary Only</div>
          </div>
        </div>
      </div>

      <BattleBrowser entries={battleIndex} modelMeta={modelMeta} />
    </div>
  );
}
