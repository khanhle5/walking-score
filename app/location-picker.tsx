"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { canonicalPoint, parsePlaceResults, type MapPoint, type PlaceResult } from "@/lib/location-picker";

const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const style = process.env.NEXT_PUBLIC_MAPBOX_STYLE || "mapbox://styles/mapbox/streets-v12";

type Props = {
  point: MapPoint | null;
  onSelect: (point: MapPoint, name: string) => void;
  disabled: boolean;
};

export default function LocationPicker({ point, onSelect, disabled }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const request = useRef<AbortController | null>(null);
  const selectRef = useRef(onSelect);
  const disabledRef = useRef(disabled);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [mapError, setMapError] = useState("");
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => { selectRef.current = onSelect; disabledRef.current = disabled; }, [onSelect, disabled]);
  useEffect(() => {
    if (!token || !container.current) return;
    let instance: mapboxgl.Map;
    try {
      instance = new mapboxgl.Map({ container: container.current, accessToken: token, style, center: [0, 20], zoom: 1.3 });
    } catch {
      // A synchronous failure from the external Mapbox constructor must be shown to the visitor.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMapError("Không thể mở bản đồ. Kiểm tra trình duyệt và cấu hình Mapbox.");
      return;
    }
    map.current = instance;
    instance.addControl(new mapboxgl.NavigationControl(), "top-right");
    instance.on("load", () => setMapReady(true));
    instance.on("error", () => setMapError("Bản đồ không tải được một số dữ liệu. Kiểm tra token, style và kết nối Mapbox."));
    instance.on("click", (event) => {
      if (disabledRef.current) return;
      const selected = canonicalPoint(event.lngLat.lat, event.lngLat.lng);
      if (!selected) return;
      request.current?.abort();
      request.current = null;
      setSearching(false);
      setResults([]);
      setMessage("");
      selectRef.current(selected, "");
    });
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current);
    return () => {
      request.current?.abort();
      observer.disconnect();
      marker.current = null;
      map.current = null;
      instance.remove();
    };
  }, []);

  useEffect(() => {
    if (!map.current || !point) return;
    if (!marker.current) marker.current = new mapboxgl.Marker({ color: "#2563eb" }).setLngLat([point.lng, point.lat]).addTo(map.current);
    else marker.current.setLngLat([point.lng, point.lat]);
  }, [point]);

  async function search() {
    const text = query.trim();
    if (!text || disabled) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setSearching(true);
    setResults([]);
    setMessage("");
    try {
      const params = new URLSearchParams({ q: text, access_token: token, permanent: "true", autocomplete: "false", limit: "5" });
      const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error("search failed");
      const places = parsePlaceResults(await response.json());
      if (request.current !== controller) return;
      setResults(places);
      if (!places.length) setMessage("Không tìm thấy địa điểm. Thử tìm lại hoặc chọn trực tiếp trên bản đồ.");
    } catch {
      if (!controller.signal.aborted) setMessage("Không tìm được địa chỉ. Kiểm tra quyền permanent geocoding, token hoặc kết nối; bạn vẫn có thể chọn trực tiếp trên bản đồ.");
    } finally {
      if (request.current === controller) { request.current = null; setSearching(false); }
    }
  }

  function chooseResult(result: PlaceResult) {
    if (disabled) return;
    selectRef.current({ lat: result.lat, lng: result.lng }, result.name);
    map.current?.flyTo({ center: [result.lng, result.lat], zoom: 15 });
    setResults([]);
    setMessage("");
  }

  if (!token) return <p role="alert" className="memory-error">Chưa cấu hình bản đồ. Quản trị viên cần thêm NEXT_PUBLIC_MAPBOX_TOKEN và triển khai lại.</p>;
  return (
    <div className="location-picker">
      <label htmlFor="place-search">Tìm địa chỉ (tùy chọn)</label>
      <div className="location-search">
        <input id="place-search" className="input" value={query} disabled={disabled} onChange={(e) => {
          request.current?.abort(); request.current = null; setSearching(false); setResults([]); setMessage(""); setQuery(e.target.value);
        }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(); } }} placeholder="Tìm địa chỉ hoặc địa điểm" />
        <button className="button button--ghost" type="button" disabled={disabled || searching || !query.trim()} onClick={() => void search()}>{searching ? "Đang tìm…" : "Tìm"}</button>
      </div>
      {message && <p role="status" className="label">{message}</p>}
      {results.length > 0 && <ul className="location-results" aria-label="Kết quả tìm kiếm">{results.map((result, i) => <li key={`${result.lng},${result.lat},${i}`}><button type="button" disabled={disabled} onClick={() => chooseResult(result)}>{result.name}</button></li>)}</ul>}
      <div className="location-map" ref={container} aria-label="Bản đồ chọn vị trí" style={disabled ? { pointerEvents: "none" } : undefined} />
      {mapError && <p role="alert" className="memory-error">{mapError}</p>}
      <p className="label">Nhấn vào bản đồ để chọn điểm; di chuyển hoặc phóng to để chọn chính xác. Hoặc dùng bàn phím di chuyển bản đồ rồi chọn tâm bản đồ.</p>
      <button className="button button--ghost" type="button" disabled={disabled || !mapReady} onClick={() => {
        const center = map.current?.getCenter();
        const selected = center && canonicalPoint(center.lat, center.lng);
        if (selected) { request.current?.abort(); request.current = null; setSearching(false); setResults([]); setMessage(""); onSelect(selected, ""); }
      }}>Chọn tâm bản đồ</button>
      <p className="label">{point ? `Điểm đã chọn: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}` : "Chưa chọn điểm trên bản đồ."}</p>
      <p className="label">Bản đồ và tìm kiếm do Mapbox cung cấp; nội dung tìm kiếm được gửi tới Mapbox.</p>
    </div>
  );
}
