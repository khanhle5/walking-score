import { notFound } from "next/navigation";
import { getWalk } from "@/lib/walks";
import { getToken } from "@/lib/session";
import WalkView from "./walk-view";

// Are.na decides whether the current viewer can read this block.
export default async function WalkDetailPage({ params }: PageProps<"/walk/[id]">) {
  const { id } = await params;
  const blockId = Number(id);
  if (!Number.isInteger(blockId) || blockId <= 0) notFound();
  const walk = await getWalk(blockId, await getToken());
  if (!walk) notFound();
  return <WalkView walk={walk} />;
}
