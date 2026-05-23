import { NextResponse } from "next/server";

/** 카카오 로컬 API: 주소 → 좌표(lat/lng) 지오코딩 Route Handler.
 *  서버 전용 — process.env.KAKAO_REST_API_KEY 사용 (NEXT_PUBLIC_ 금지).
 *  요청:  POST { address: string }
 *  응답:
 *    - 200 { lat, lng, matched: true }      성공
 *    - 200 { lat: null, lng: null, matched: false }  매칭 0건(주소 정상이지만 카카오가 못 찾음)
 *    - 400 { error: "address required" }    address 누락/빈 문자열
 *    - 400 { error: "invalid json body" }   body 파싱 실패
 *    - 500 { error: "kakao key missing" }   서버 env 미설정
 *    - 502 { error: "kakao request failed", status }  카카오 응답 실패
 *    - 500 { error: "geocode internal error" }        예외
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid json body" }, { status: 400 });
    }
    const rawAddress = (body as { address?: unknown })?.address;
    const address = typeof rawAddress === "string" ? rawAddress.trim() : "";
    if (!address) {
      return NextResponse.json({ error: "address required" }, { status: 400 });
    }
    const key = process.env.KAKAO_REST_API_KEY;
    if (!key) {
      console.error("[geocode] KAKAO_REST_API_KEY missing");
      return NextResponse.json({ error: "kakao key missing" }, { status: 500 });
    }
    const url =
      "https://dapi.kakao.com/v2/local/search/address.json?query=" +
      encodeURIComponent(address);
    const res = await fetch(url, {
      headers: { Authorization: "KakaoAK " + key },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[geocode] kakao response not ok:", res.status);
      return NextResponse.json(
        { error: "kakao request failed", status: res.status },
        { status: 502 },
      );
    }
    const data = (await res.json()) as {
      documents?: Array<{ x?: string; y?: string }>;
    };
    const doc = data.documents?.[0];
    if (!doc || typeof doc.x !== "string" || typeof doc.y !== "string") {
      return NextResponse.json(
        { lat: null, lng: null, matched: false },
        { status: 200 },
      );
    }
    const lat = Number(doc.y);
    const lng = Number(doc.x);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { lat: null, lng: null, matched: false },
        { status: 200 },
      );
    }
    return NextResponse.json({ lat, lng, matched: true }, { status: 200 });
  } catch (err) {
    console.error("[geocode] internal error:", err);
    return NextResponse.json(
      { error: "geocode internal error" },
      { status: 500 },
    );
  }
}
