import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isMobileUA } from "@/lib/device";
import { getToken } from "@/lib/session";
import Recorder from "./recorder";

export default async function WalkPage() {
  const token = await getToken();
  if (!token) redirect("/");
  // Recording is phone-only; dev mode stays open for the simulate-a-walk flow.
  const ua = (await headers()).get("user-agent") ?? "";
  if (!isMobileUA(ua) && process.env.NODE_ENV !== "development") redirect("/");
  return <Recorder />;
}
