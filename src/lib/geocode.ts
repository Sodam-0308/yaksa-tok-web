/** 주소 → 좌표(lat/lng) 변환 클라이언트 헬퍼.
 *  내부에서 /api/geocode (서버 라우트, 카카오 REST 키 보유) 호출.
 *  네트워크/HTTP/매칭 실패 어느 경우든 throw 하지 않고 { lat: null, lng: null } 로 폴백.
 *  → 좌표를 못 구해도 주소 저장 자체는 막지 않는다.
 */
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number | null; lng: number | null }> {
  const trimmed = (address ?? "").trim();
  if (!trimmed) return { lat: null, lng: null };
  try {
    const res = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: trimmed }),
    });
    if (!res.ok) {
      console.error("[geocode] http error:", res.status);
      return { lat: null, lng: null };
    }
    const data = (await res.json()) as {
      lat?: number | null;
      lng?: number | null;
      matched?: boolean;
    };
    const lat = typeof data.lat === "number" && Number.isFinite(data.lat) ? data.lat : null;
    const lng = typeof data.lng === "number" && Number.isFinite(data.lng) ? data.lng : null;
    return { lat, lng };
  } catch (err) {
    console.error("[geocode] fetch failed:", err);
    return { lat: null, lng: null };
  }
}
