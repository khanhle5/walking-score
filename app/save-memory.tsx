"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  GoogleAuthProvider,
  inMemoryPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { addDoc, collection } from "firebase/firestore";
import { mindstampsAuth, mindstampsConfigValid, mindstampsDb } from "@/lib/mindstamps";
import { memoryFields, parseMemoryLocation } from "@/lib/memory";
import { drawScore } from "@/lib/render";
import LocationPicker from "./location-picker";
import type { MapPoint } from "@/lib/location-picker";
import { toTimedPoints } from "@/lib/timed-points";
import type { GalleryWalk } from "@/lib/walks";

// Leave plenty of room below Firestore's 1 MiB document limit for other fields.
function scoreDataUrl(walk: GalleryWalk): string {
  const points = toTimedPoints(walk);
  if (!points.length) throw new Error("Không thể đọc dữ liệu đường đi.");
  const canvas = document.createElement("canvas");
  for (const size of [1024, 768, 512, 384]) {
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Không thể tạo hình đường đi trên thiết bị này.");
    drawScore(ctx, points, size, size);
    const image = canvas.toDataURL("image/png");
    if (image.startsWith("data:image/png;base64,") && image.length <= 700_000) return image;
  }
  throw new Error("Hình đường đi quá lớn để lưu vào Mindstamps.");
}

function authError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "auth/unauthorized-domain") return "Tên miền này chưa được cho phép trong Firebase Authentication của Mindstamps.";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Cửa sổ đăng nhập đã đóng. Hãy thử lại.";
  if (code === "auth/operation-not-allowed") return "Phương thức đăng nhập này chưa được bật trong Mindstamps.";
  return "Không thể đăng nhập Mindstamps. Hãy kiểm tra tài khoản và thử lại.";
}

export default function SaveMemory({ walk, onClose, onSaved }: { walk: GalleryWalk; onClose: () => void; onSaved: (uid: string, id: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [place, setPlace] = useState("");
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(mindstampsConfigValid ? "" : "Cấu hình Mindstamps chưa đầy đủ. Vui lòng kiểm tra bốn biến Firebase web.");
  const [memoryId, setMemoryId] = useState("");

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!mindstampsConfigValid) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void setPersistence(mindstampsAuth, inMemoryPersistence).then(() => {
      if (!active) return;
      unsubscribe = onAuthStateChanged(mindstampsAuth, (currentUser) => {
        setUser(currentUser);
        setAuthReady(true);
      }, () => setError("Không thể kiểm tra tài khoản Mindstamps. Hãy tải lại trang."));
    }).catch(() => {
      if (active) setError("Không thể khởi tạo đăng nhập Mindstamps. Hãy tải lại trang.");
    });
    return () => { active = false; unsubscribe?.(); };
  }, []);

  const login = async (method: "google" | "email") => {
    setBusy(true);
    setError("");
    try {
      // A Mindstamps sign-in here is independent of Are.na and of zofovn's
      // own browser session, and lasts only while this page remains open.
      if (method === "google") await signInWithPopup(mindstampsAuth, new GoogleAuthProvider());
      else await signInWithEmailAndPassword(mindstampsAuth, email.trim(), password);
      setPassword("");
    } catch (err) {
      setError(authError(err));
    } finally {
      setBusy(false);
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !consent || busy || !point) return;
    setError("");
    setBusy(true);
    try {
      const location = parseMemoryLocation(String(point.lat), String(point.lng), place);
      const imageData = scoreDataUrl(walk);
      const result = await addDoc(collection(mindstampsDb, "memories"), memoryFields(walk, location, imageData, user.uid));
      setMemoryId(result.id);
      if (mindstampsAuth.currentUser?.uid === user.uid) onSaved(user.uid, result.id);
    } catch (err) {
      if (err instanceof Error && !((err as { code?: string }).code)) setError(err.message);
      else setError("Không thể xác nhận Memory đã được lưu. Kiểm tra kết nối và Journal trước khi thử lại để tránh lưu trùng.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialog} className="memory-dialog" aria-labelledby="memory-title" onClose={onClose} onCancel={(e) => { if (busy) e.preventDefault(); }}>
      <div className="memory-panel">
        <h2 id="memory-title">Lưu sang Memory</h2>
        <p>Chuyến đi: <strong>{walk.title || "Walk"}</strong></p>
        {!memoryId && !user && (
          <div className="memory-form">
            <p>Đăng nhập bằng tài khoản Mindstamps của bạn. Phiên đăng nhập này tách biệt với Are.na.</p>
            <button className="button button--ghost" type="button" disabled={busy || !authReady} onClick={() => login("google")}>Đăng nhập với Google</button>
            <form className="memory-form" onSubmit={(e) => { e.preventDefault(); void login("email"); }}>
              <label>Email Mindstamps<input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
              <label>Mật khẩu<input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
              <button className="button button--ghost" type="submit" disabled={busy || !authReady}>Đăng nhập bằng email</button>
            </form>
          </div>
        )}
        {!memoryId && user && (
          <form className="memory-form" onSubmit={save}>
            <p className="label">Mindstamps: {user.email || user.displayName || "Đã đăng nhập"} · <button type="button" className="tile-play" disabled={busy} onClick={() => void signOut(mindstampsAuth).catch(() => setError("Không thể đổi tài khoản. Hãy thử lại."))}>Đổi tài khoản</button></p>
            <p>Chọn vị trí bạn muốn chia sẻ. Walking Score không lưu tọa độ GPS của chuyến đi và không tự xác định vị trí chuyến đi.</p>
            <LocationPicker point={point} disabled={busy} onSelect={(selected, name) => { setPoint(selected); setPlace(name); }} />
            <label>Tên địa điểm<input className="input" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={200} disabled={busy} required /></label>
            <label className="memory-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required /> <span>Tôi đồng ý chia sẻ tiêu đề, hình tuyến đường, ngày, quãng đường, thời gian, liên kết Are.na và vị trí đã chọn. Memory có thể được đọc công khai trên Mindstamps.</span></label>
            <button className="button" type="submit" disabled={busy || !consent || !point || !place.trim()}>{busy ? "Đang lưu…" : "Xác nhận lưu Memory"}</button>
          </form>
        )}
        {error && <p role="alert" className="memory-error">{error}</p>}
        {memoryId && <p role="status">Đã lưu Memory. <a href={`https://zofovn.vercel.app/#home?memory=${encodeURIComponent(memoryId)}`} target="_blank" rel="noreferrer">Mở trong Mindstamps →</a></p>}
        <button className="button button--ghost" type="button" disabled={busy} onClick={onClose}>Đóng</button>
      </div>
    </dialog>
  );
}
