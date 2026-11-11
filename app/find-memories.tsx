"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { GoogleAuthProvider, inMemoryPersistence, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, documentId, getDocsFromServer, limit, orderBy, query, startAfter, where, type QueryDocumentSnapshot, type DocumentData } from "firebase/firestore";
import { mindstampsAuth, mindstampsConfigValid, mindstampsDb } from "@/lib/mindstamps";
import { addMemoryLink, type MemoryLinks } from "@/lib/memory-links";
import type { GalleryWalk } from "@/lib/walks";

export default function FindMemories({ walks, onClose, onFound }: { walks: GalleryWalk[]; onClose: () => void; onFound: (uid: string, links: MemoryLinks) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const active = useRef(false);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(mindstampsConfigValid ? "" : "Cấu hình Firebase của Mindstamps chưa đầy đủ.");

  useEffect(() => {
    active.current = true;
    let mounted = true;
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!mindstampsConfigValid) return () => { mounted = false; active.current = false; };
    let unsubscribe: (() => void) | undefined;
    void setPersistence(mindstampsAuth, inMemoryPersistence).then(() => {
      if (!mounted) return;
      unsubscribe = onAuthStateChanged(mindstampsAuth, (current) => { setUser(current); setReady(true); }, () => setError("Không thể kiểm tra tài khoản Mindstamps."));
    }).catch(() => { if (mounted) setError("Không thể khởi tạo đăng nhập Mindstamps."); });
    return () => { mounted = false; active.current = false; unsubscribe?.(); };
  }, []);

  async function login(method: "google" | "email") {
    setBusy(true); setError("");
    try {
      if (method === "google") await signInWithPopup(mindstampsAuth, new GoogleAuthProvider());
      else await signInWithEmailAndPassword(mindstampsAuth, email.trim(), password);
      if (active.current) setPassword("");
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (active.current) setError(code === "auth/unauthorized-domain" ? "Tên miền này chưa được cho phép trong Firebase Authentication của Mindstamps." : "Không thể đăng nhập Mindstamps. Kiểm tra tài khoản và thử lại.");
    } finally { if (active.current) setBusy(false); }
  }

  async function find() {
    if (!user || busy) return;
    setBusy(true); setError("");
    const uid = user.uid;
    const links: MemoryLinks = {};
    let cursor: QueryDocumentSnapshot<DocumentData> | undefined;
    try {
      // Paginate the signed-in user's own memories only. Existing exports have
      // no dedicated block field, so inspect their story for the exact URL.
      while (active.current) {
        const constraints = [where("userId", "==", uid), orderBy(documentId()), limit(20)];
        const page = await getDocsFromServer(query(collection(mindstampsDb, "memories"), ...constraints, ...(cursor ? [startAfter(cursor)] : [])));
        if (!active.current) return;
        if (mindstampsAuth.currentUser?.uid !== uid) throw new Error("account changed");
        for (const doc of page.docs) addMemoryLink(links, walks, uid, doc.id, doc.data());
        if (page.size < 20) break;
        cursor = page.docs[page.docs.length - 1];
      }
      if (active.current) { onFound(uid, links); onClose(); }
    } catch {
      if (active.current) setError("Không thể tìm Memory. Kiểm tra tài khoản và kết nối rồi thử lại; kết quả cũ chưa bị thay đổi.");
    } finally { if (active.current) setBusy(false); }
  }

  return <dialog ref={dialog} className="memory-dialog" aria-labelledby="find-memory-title" onClose={onClose}>
    <div className="memory-panel">
      <h2 id="find-memory-title">Tìm Memory đã lưu</h2>
      <p>Đăng nhập bằng tài khoản Mindstamps đã dùng để lưu. Khi bạn chọn tìm, ứng dụng sẽ đọc các Memory của tài khoản đó để đối chiếu liên kết Are.na; việc này có thể tải nhiều dữ liệu.</p>
      {!user ? <div className="memory-form">
        <button className="button button--ghost" type="button" disabled={!ready || busy} onClick={() => void login("google")}>Đăng nhập với Google</button>
        <form className="memory-form" onSubmit={(event: FormEvent) => { event.preventDefault(); void login("email"); }}>
          <label>Email Mindstamps<input className="input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Mật khẩu<input className="input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button className="button button--ghost" disabled={!ready || busy}>Đăng nhập bằng email</button>
        </form>
      </div> : <div className="memory-form">
        <p className="label">Mindstamps: {user.email || user.displayName || "Đã đăng nhập"} · <button type="button" className="tile-play" disabled={busy} onClick={() => void signOut(mindstampsAuth).catch(() => setError("Không thể đổi tài khoản."))}>Đổi tài khoản</button></p>
        <button className="button" type="button" disabled={busy} onClick={() => void find()}>{busy ? "Đang tìm…" : "Tìm trong Memory của tôi"}</button>
      </div>}
      {error && <p role="alert" className="memory-error">{error}</p>}
      <button className="button button--ghost" type="button" onClick={onClose}>Đóng</button>
    </div>
  </dialog>;
}
