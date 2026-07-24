import { notFound } from "next/navigation";
import { getWalk } from "@/lib/walks";
import WalkView from "./walk-view";

// Public: a walk's page is viewable by anyone with the URL (it renders
// server-side via the service token).
export default async function WalkDetailPage({ params }: PageProps<"/walk/[id]">) {
  const { id } = await params;
  const blockId = Number(id);
  if (!Number.isInteger(blockId) || blockId <= 0) notFound();
  const walk = await getWalk(blockId);
  if (!walk) notFound();
  return <WalkView walk={walk} />;
}
