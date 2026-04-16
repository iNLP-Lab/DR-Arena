import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BattleReplayView } from "@/components/battle/battle-replay";
import { getBattleIndex, getBattleReplay, getModelMeta } from "@/lib/data";

type RouteParams = {
  id: string;
};

export function generateStaticParams() {
  return getBattleIndex()
    .filter((entry) => entry.replay_available && entry.replay_id)
    .map((entry) => ({ id: entry.replay_id! }));
}

export const dynamicParams = false;

function resolveReplay(id: string) {
  const battleIndex = getBattleIndex();
  const battle = battleIndex.find((entry) => entry.replay_id === id && entry.replay_available);
  if (!battle) return null;

  try {
    const replay = getBattleReplay(id);
    return { battle, replay };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { id } = await params;
  const resolved = resolveReplay(id);
  if (!resolved) {
    return { title: "Battle not found" };
  }

  return {
    title: `${resolved.replay.tree_title} · Battles`,
    description: `Replay for ${resolved.replay.model_a} vs ${resolved.replay.model_b} on ${resolved.replay.tree_id}.`,
  };
}

export default async function BattleDetailPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { id } = await params;
  const resolved = resolveReplay(id);
  if (!resolved) {
    notFound();
  }

  return (
    <div className="relative w-full max-w-[1440px] px-6 py-8 md:px-10 md:py-12 lg:px-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 -z-10 h-[440px] w-[560px] rounded-full bg-accent/[0.05] blur-[150px]"
      />
      <BattleReplayView replay={resolved.replay} modelMeta={getModelMeta()} />
    </div>
  );
}
