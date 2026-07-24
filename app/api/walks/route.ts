import { NextResponse } from "next/server";
import { arenaFetch, getCurrentUser } from "@/lib/arena";
import { formatDistance, formatDuration } from "@/lib/format";
import { chunkEncoded } from "@/lib/points";
import { getToken } from "@/lib/session";

// The client sends the rendered PNG + encoded streams here, and the server
// does presign → S3 PUT → create block with the walker's own OAuth token, so
// the block is authored by the walker. The channel is open, so any signed-in
// walker can post into it; the service token is only used for reading
// (lib/walks.ts).

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TITLE_CHARS = 100;
// Metadata totals 32KB across all keys+values; leave room for the fixed keys.
const MAX_ENCODED_CHARS = 28000;

export async function POST(request: Request) {
  const userToken = await getToken();
  if (!userToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const channel = process.env.ARENA_WALKS_CHANNEL;
  if (!channel) {
    return NextResponse.json(
      { error: "ARENA_WALKS_CHANNEL not configured" },
      { status: 500 }
    );
  }

  let walker: { name: string; slug: string };
  try {
    walker = await getCurrentUser(userToken);
  } catch {
    return NextResponse.json({ error: "Session expired — sign in again" }, { status: 401 });
  }

  const form = await request.formData();
  const image = form.get("image");
  const title = String(form.get("title") ?? "").trim();
  const startedAt = String(form.get("startedAt") ?? "");
  const endedAt = String(form.get("endedAt") ?? "");
  const distanceM = Number(form.get("distanceM"));
  const pointCount = Number(form.get("pointCount"));
  const pointsEncoded = String(form.get("points") ?? "");
  const timesEncoded = String(form.get("times") ?? "");

  if (!(image instanceof File) || image.size === 0 || image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Missing or oversized image" }, { status: 400 });
  }
  if (title.length > MAX_TITLE_CHARS) {
    return NextResponse.json({ error: "Title too long" }, { status: 400 });
  }
  if (!Number.isFinite(Date.parse(startedAt)) || !Number.isFinite(Date.parse(endedAt))) {
    return NextResponse.json({ error: "Invalid walk timestamps" }, { status: 400 });
  }
  if (!Number.isFinite(distanceM) || !Number.isInteger(pointCount) || pointCount < 2) {
    return NextResponse.json({ error: "Invalid walk stats" }, { status: 400 });
  }
  if (!pointsEncoded || pointsEncoded.length + timesEncoded.length > MAX_ENCODED_CHARS) {
    return NextResponse.json({ error: "Point data missing or too large" }, { status: 400 });
  }

  const durationS = Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 1000);

  const metadata: Record<string, string | number> = {
    app: "walk-as-score",
    schema_version: 1,
    walker: walker.slug,
    started_at: startedAt,
    duration_s: durationS,
    distance_m: Math.round(distanceM),
    point_count: pointCount,
  };
  const pointChunks = chunkEncoded(pointsEncoded);
  metadata.points_chunks = pointChunks.length;
  pointChunks.forEach((chunk, i) => (metadata[`points_${i}`] = chunk));
  if (timesEncoded) {
    const timeChunks = chunkEncoded(timesEncoded);
    metadata.times_chunks = timeChunks.length;
    timeChunks.forEach((chunk, i) => (metadata[`times_${i}`] = chunk));
  }

  try {
    const presign = await arenaFetch<{
      files: { upload_url: string; key: string; content_type: string }[];
    }>("/uploads/presign", userToken, {
      method: "POST",
      body: JSON.stringify({
        files: [{ filename: `walk-${Date.now()}.png`, content_type: "image/png" }],
      }),
    });
    const file = presign.files[0];

    const put = await fetch(file.upload_url, {
      method: "PUT",
      headers: { "Content-Type": file.content_type },
      body: image,
    });
    if (!put.ok) {
      throw new Error(`S3 upload failed: ${put.status}`);
    }

    const meters = Math.round(distanceM);
    const block = await arenaFetch<{ id: number }>("/blocks", userToken, {
      method: "POST",
      body: JSON.stringify({
        value: `https://s3.amazonaws.com/arena_images-temp/${file.key}`,
        title: title
          ? `${title} (${meters}m)`
          : `Walk — ${startedAt.slice(0, 10)} (${meters}m)`,
        description: [
          `A walk by [${walker.name}](https://www.are.na/${walker.slug})`,
          ``,
          `${startedAt.slice(0, 10)} · ${formatDuration(durationS)} · ${formatDistance(distanceM)} · ${pointCount} points`,
        ].join("\n"),
        alt_text: `A ${formatDistance(distanceM)}, ${formatDuration(durationS)} walk drawn as a single black line on a white background`,
        metadata,
        channels: [{ id: channel }],
      }),
    });

    return NextResponse.json({ id: block.id, url: `https://www.are.na/block/${block.id}` });
  } catch (err) {
    console.error("Walk upload failed:", err);
    return NextResponse.json(
      { error: "Upload to Are.na failed — your walk is still saved on this device, try again" },
      { status: 502 }
    );
  }
}
