import Link from "next/link";

export default function WalkNotFound() {
  return (
    <main>
      <h1>No such walk</h1>
      <Link href="/">Home →</Link>
    </main>
  );
}
