import { notFound } from "next/navigation";
import { getWalk } from "@/lib/walks";
import WalkView from "./walk-view";

// Public by link: the channel is private, but a walk's own page is viewable by
// anyone the walker shares the URL with (it renders via the service token).
export default async function WalkDetailPage({ params }: PageProps<"/walk/[id]">) {
  const { id } = await params;
  const blockId = Number(id);
  if (!Number.isInteger(blockId) || blockId <= 0) notFound();
  const walk = await getWalk(blockId);
  if (!walk) notFound();
  return <WalkView walk={walk} />;
}
