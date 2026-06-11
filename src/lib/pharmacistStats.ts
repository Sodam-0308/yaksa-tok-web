import { supabase } from "@/lib/supabase";

/**
 * 약사 "내 실적" 실집계 — pharmacist_profiles 정적 컬럼 대신 이벤트 테이블에서 직접 계산.
 *
 * 베타 규모에선 클라이언트 집계로 충분. 나중에 RPC(서버 함수)로 옮길 때
 * 이 파일의 함수 시그니처(userId → 값)만 유지하면 호출부는 그대로 둘 수 있다.
 */

/**
 * 총 상담 — 본인 담당 consultations 중 status ∈ {accepted, completed} 행 수.
 * pending·rejected·cancelled 등은 화이트리스트로 제외. 실패 시 0.
 */
export async function fetchTotalConsultations(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("consultations")
    .select("*", { count: "exact", head: true })
    .eq("pharmacist_id", userId)
    .in("status", ["accepted", "completed"]);
  if (error) {
    console.error("[pharmacistStats] total consultations count failed:", error);
    return 0;
  }
  return count ?? 0;
}

/**
 * 평균 응답 시간(분) — 본인 상담들의 messages.response_minutes 평균.
 *  - response_minutes 는 약사 text 응답에만 트리거가 채우는 컬럼. null 행은 제외.
 *  - 본인 consultation id 목록을 먼저 구한 뒤 그 메시지들의 평균을 클라에서 계산.
 *  - 데이터(응답 측정값)가 0건이면 null 반환(호출부에서 "—" 처리).
 *
 *  NOTE: messages.response_minutes 는 typed Database 에 없는 컬럼이라 캐스팅으로 접근.
 *        추후 단일 RPC(AVG)로 대체 가능 — 그때 이 함수 본문만 교체.
 */
export async function fetchAvgResponseMinutes(userId: string): Promise<number | null> {
  // 1) 본인 consultation id 목록
  const consRes = await supabase
    .from("consultations")
    .select("id")
    .eq("pharmacist_id", userId);
  if (consRes.error) {
    console.error("[pharmacistStats] consultation ids fetch failed:", consRes.error);
    return null;
  }
  const ids = (consRes.data ?? []).map((r) => (r as { id: string }).id);
  if (ids.length === 0) return null;

  // 2) 해당 상담의 messages 중 response_minutes IS NOT NULL 값만 수집
  const msgRes = await (supabase
    .from("messages") as unknown as {
      select: (cols: string) => {
        in: (col: string, vals: string[]) => {
          not: (col: string, op: string, val: null) => Promise<{
            data: { response_minutes: number | null }[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    })
    .select("response_minutes")
    .in("consultation_id", ids)
    .not("response_minutes", "is", null);

  if (msgRes.error) {
    console.error("[pharmacistStats] response_minutes fetch failed:", msgRes.error);
    return null;
  }
  const vals = (msgRes.data ?? [])
    .map((m) => m.response_minutes)
    .filter((v): v is number => typeof v === "number" && !isNaN(v));
  if (vals.length === 0) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(avg);
}
