import { getLeaderboard, getBattles, getPairwise, getModelMeta, getFailureProfiles } from "@/lib/data";
import { LeaderboardShell } from "@/components/leaderboard/leaderboard-shell";

export const metadata = {
  title: "Leaderboard",
  description:
    "The main ranking dashboard for Deep Research Arena — dense table, pairwise matrix, and answer-failure profiles.",
};

export default function LeaderboardPage() {
  const leaderboard = getLeaderboard();
  const battles = getBattles();
  const pairwise = getPairwise();
  const modelMeta = getModelMeta();
  const failureProfiles = getFailureProfiles();
  const topModel = leaderboard[0];
  const eloSpread = leaderboard.length > 1
    ? Math.round(leaderboard[0].elo - leaderboard[leaderboard.length - 1].elo)
    : 0;

  return (
    <div className="relative w-full max-w-[1440px] px-6 py-8 md:px-10 md:py-12 lg:px-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 -z-10 h-[420px] w-[520px] rounded-full bg-accent/[0.05] blur-[140px]"
      />

      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="app-kicker">Ranked field report</div>
          <h1 className="app-title mt-3">Leaderboard</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted md:text-base">
            Final Deep Research Arena Elo ratings across {battles.length} matches. Select a row for inspected context,
            or open a model dossier for the full breakdown.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-l-0 border-border-subtle pl-0 sm:grid-cols-4 lg:border-l lg:pl-8">
          <div>
            <div className="font-mono text-2xl font-semibold tabular" data-numeric>{leaderboard.length}</div>
            <div className="app-kicker mt-1">Models</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-semibold tabular" data-numeric>{battles.length}</div>
            <div className="app-kicker mt-1">Matches</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-semibold tabular" data-numeric>{topModel?.elo.toFixed(0)}</div>
            <div className="app-kicker mt-1">Top Elo</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-semibold tabular" data-numeric>{eloSpread}</div>
            <div className="app-kicker mt-1">Spread</div>
          </div>
        </div>
      </div>

      <LeaderboardShell
        leaderboard={leaderboard}
        battles={battles}
        pairwise={pairwise}
        modelMeta={modelMeta}
        failureProfiles={failureProfiles}
      />
    </div>
  );
}
