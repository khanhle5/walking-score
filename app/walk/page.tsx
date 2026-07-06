import { redirect } from "next/navigation";
import { getToken } from "@/lib/session";
import Recorder from "./recorder";

export default async function WalkPage() {
  const token = await getToken();
  if (!token) redirect("/");
  return <Recorder />;
}
