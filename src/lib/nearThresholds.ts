/** I-4 임박 알림 공용 헬퍼.
 *  순수 모듈 — DOM/React 비의존, 서버(Route Handler/Server Action)·클라이언트 양쪽에서 사용.
 *  원본: src/app/mypage/MypageClient.tsx (I-4 (B-1) 단계에서 추출).
 *  로직 변경 금지 — 추출만. UTC 미사용(자정 어긋남 회피) 유지.
 */

/** I-4 임박 알람 기준 — 단위 일. 복용 종료/방문 일정 D-N 이하일 때 배너/알림 노출. */
export const MED_NEAR_THRESHOLD = 3;
export const VISIT_NEAR_THRESHOLD = 2;

/** 오늘 날짜를 로컬(한국시간) 기준 YYYY-MM-DD 문자열로 반환.
 *  toISOString() 은 UTC 라 한국시간 자정 부근에 하루 어긋날 수 있으니 로컬 연/월/일로 조립. */
export function getTodayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD → (해당 날짜 - 오늘) 일수. 로컬 자정 기준 (toISOString UTC 미사용).
 *  null/형식이상이면 null. calcRemainingDays 와 동일한 분해 방식. */
export function daysFromTodayLocal(iso: string | null): number | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  const target = new Date(y, mo - 1, d);
  if (Number.isNaN(target.getTime())) return null;
  const todayISO = getTodayLocalISO();
  const tm = todayISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!tm) return null;
  const today = new Date(Number(tm[1]), Number(tm[2]) - 1, Number(tm[3]));
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/** start_date(YYYY-MM-DD) + days → 종료예정일 기준 남은 일수.
 *  로직: end = start + days. remain = end - today (달력 날짜 차이).
 *  start_date / days 가 없거나 형식이 깨지면 null. */
export function calcRemainingDays(startDate: string | null, days: number | null): number | null {
  if (!startDate || days == null || days <= 0) return null;
  const m = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const sy = Number(m[1]); const sm = Number(m[2]); const sd = Number(m[3]);
  const start = new Date(sy, sm - 1, sd);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(sy, sm - 1, sd + days);
  const todayISO = getTodayLocalISO();
  const tm = todayISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!tm) return null;
  const today = new Date(Number(tm[1]), Number(tm[2]) - 1, Number(tm[3]));
  // 달력 일수 차이 (시/분/초 무시)
  const diffMs = end.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}
