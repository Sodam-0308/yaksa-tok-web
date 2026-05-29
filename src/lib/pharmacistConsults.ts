/**
 * 약사 대시보드·환자 목록 공유 데이터 레이어.
 *
 * - PatientConsult 인터페이스: 약사가 보는 환자 한 명에 대한 통합 뷰 모델.
 * - fetchAllConsultations: pharmacist_id 의 모든 consultations + 보조 테이블 IN 쿼리 → PatientConsult[].
 * - 표시/판정 헬퍼: relativeTimeLabel / mapGenderKo / symptomLabelToCategory / sortableLastMsgTs 등.
 *
 * DashboardClient.tsx 에서 추출(2026-05-27). 추출과 동시에 mock 시각 상수(NOW_ISO/CURRENT_YEAR)는
 * 실시간(Date.now() / new Date().getFullYear())으로 교체했음.
 */
import type { CSSProperties } from "react";
import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import { calcRemainingDays, getTodayLocalISO, PHARM_MED_NEAR_DAYS } from "./nearThresholds";

/* ── 기본 타입 ── */

export type PatientStatus = "requested" | "managing" | "inactive";
export type SymptomCategory = "digestion" | "fatigue" | "sleep" | "skin" | "immune";
export type RelationTag = "regular" | "over" | "none";

export interface PatientConsult {
  id: string;
  /** consultations.patient_id — 대시보드에서 pharmacist_charts upsert(메모 저장) 키로 사용. mock 보존 위해 optional. */
  patientId?: string | null;
  patientName: string;
  patientGender: string;
  birthYear: number;
  patientStatus: PatientStatus;
  consultType: "local" | "remote";
  symptoms: { label: string; category: SymptomCategory }[];
  aiSummary: string;
  freeText: string;
  unreadCount: number;
  lastMessageAt: string; // relative
  createdAt: string;
  prevConsultCount: number;
  healthScores?: { label: string; before: number; after: number }[];
  memo?: string;
  visitDate?: string;
  nextVisitDate?: string;
  purchasedMeds?: string[];
  registrationSource: "app" | "offline";
  hasAppAccount: boolean;
  supplementStatus: "taking" | "not_taking" | "completed";
  consultationCount: number;
  hasPurchase: boolean;
  hasVisit: boolean;
  isRejected?: boolean;
  rejectedReason?: string;
  rejectedAt?: string;
  /** 환자 마지막 메시지 시각 (ISO). 약사 답장 긴급도 계산용. */
  lastPatientMessageAt?: string;
  /** 이 상담의 messages 중 가장 최근 created_at(sender 무관). "마지막 대화" 표시·정렬 기준. */
  lastMessageAtIso?: string;
  /** 약사가 환자 마지막 메시지를 읽었는지 여부. false면 미답변. */
  isReadByPharmacist?: boolean;
  /** AI 문답 답변 (라벨-값). requested 환자 펼침 시 전문 표시. */
  questionnaire?: Record<string, string>;
  /** 이전 거절 이력 (재요청 환자 경고용) */
  previousRejections?: { date: string; reason: string; symptoms: string[] }[];
  /** 노쇼 — visit_schedules status='scheduled' AND scheduled_date < 오늘 인 방문이 1건 이상. */
  isNoShow?: boolean;
  /** 노쇼 중 가장 최근 지난 예정일 (YYYY-MM-DD). isNoShow 시에만 채워짐. */
  noShowDate?: string;
  /** 환자의 patient_supplements 중 (start_date + days) 잔여 최소일. 모두 계산 불가면 null. */
  minRemainingDays?: number | null;
  /** 복용 종료 임박 — minRemainingDays 가 0..PHARM_MED_NEAR_DAYS 사이. */
  isMedEndingSoon?: boolean;
  /** 오늘(KST) 방문 예정 — 통계 카드 "오늘 방문 예정" 카운트용. */
  hasVisitToday?: boolean;
  /** 방문 후 처리 끊김 — 구매 영양제 리스트 미작성.
   *  visit_records 중 purchased_supplements 가 null/빈 배열인 행이 1건 이상. */
  needsPurchaseList?: boolean;
  /** 방문 후 처리 끊김 — 구매는 작성됐는데 복용 가이드 미발송.
   *  구매 작성된 마지막 방문일 이후 dosage_guides 발송이 0건. */
  needsDosageGuide?: boolean;
  /** 환자 생년월일 (YYYY-MM-DD). patient_profiles.birth_date 가 있을 때만 채워짐.
   *  ※ 현재 patient_profiles 스키마에는 birth_date 컬럼이 없으므로 항상 null — 컬럼 추가 시 매핑 한 줄로 활성화. */
  birthDate?: string | null;
  /** 우리 약국 가이드로 등록된 patient_supplements 의 created_at 최댓값(ISO).
   *  "구매 시점" 근사. source='dosage_guide' 외(manual·타 약국) 제외. 없으면 null. */
  lastPurchaseAtIso?: string | null;
}

/* ── 표시/판정 상수 ── */

/** 24시간 이상 미답변 여부. 환자 마지막 메시지 시간과 약사 읽음 상태 기준. */
export const URGENT_THRESHOLD_HOURS = 24;

export const PATIENT_STATUS_CONFIG: Record<PatientStatus, { label: string; emoji: string; bg: string; color: string }> = {
  requested: { label: "상담 요청",    emoji: "🔔", bg: "#FFF3D6", color: "#B06D00" },
  managing:  { label: "사후 관리 중", emoji: "💊", bg: "var(--sage-pale, #EDF4F0)", color: "var(--sage-deep, #4A6355)" },
  inactive:  { label: "",             emoji: "",   bg: "",         color: "" },
};

export const SYMPTOM_TAG_CLASS: Record<SymptomCategory, string> = {
  digestion: "dash-tag-digestion",
  fatigue:   "dash-tag-fatigue",
  sleep:     "dash-tag-sleep",
  skin:      "dash-tag-skin",
  immune:    "dash-tag-immune",
};

/* ── 순수 헬퍼 ── */

/** iso 시각으로부터 경과 시간(h). nowIso 생략 시 실제 현재 시각 기준(mock NOW_ISO 제거). */
export function hoursSince(iso: string, nowIso?: string): number {
  const then = new Date(iso).getTime();
  const now = nowIso ? new Date(nowIso).getTime() : Date.now();
  if (Number.isNaN(then) || Number.isNaN(now)) return 0;
  return (now - then) / 3_600_000;
}

export function needsUrgentReply(c: PatientConsult): boolean {
  if (!c.lastPatientMessageAt) return false;
  if (c.isReadByPharmacist) return false;
  if (c.isRejected) return false;
  if (c.patientStatus !== "managing") return false;
  return hoursSince(c.lastPatientMessageAt) >= URGENT_THRESHOLD_HOURS;
}

/** 상담 요청(requested) 대기 24시간 경과 여부 — 수락 기다리는 상태 */
export function needsAcceptUrgent(c: PatientConsult): boolean {
  if (c.patientStatus !== "requested") return false;
  if (c.isRejected) return false;
  const iso = c.lastPatientMessageAt ?? `${c.createdAt.replace(/\./g, "-")}T00:00:00+09:00`;
  return hoursSince(iso) >= URGENT_THRESHOLD_HOURS;
}

/** 마지막 환자 메시지로부터 경과 시간(시간 단위). 뱃지 색상 단계 계산용. */
export function hoursOfLastPatientMsg(c: PatientConsult): number {
  if (c.lastPatientMessageAt) return Math.max(0, hoursSince(c.lastPatientMessageAt));
  const label = c.lastMessageAt ?? "";
  const hm = label.match(/(\d+)\s*시간/);
  if (hm) return parseInt(hm[1], 10);
  if (label === "어제") return 24;
  const dm = label.match(/(\d+)\s*일/);
  if (dm) return parseInt(dm[1], 10) * 24;
  const wm = label.match(/(\d+)\s*주/);
  if (wm) return parseInt(wm[1], 10) * 24 * 7;
  return 0;
}

/** 경과 시간별 뱃지 배경·글씨 색상. 24h+는 pulse 애니메이션 적용. */
export function getUnreadBadgeStyle(hours: number): CSSProperties {
  if (hours < 6) return { background: "#FFD4A8", color: "#8B4513" };
  if (hours < 12) return { background: "#FF9A4D", color: "#fff" };
  if (hours < 24) return { background: "#F06820", color: "#fff" };
  return { background: "#E02020", color: "#fff", animation: "dashUnreadPulse 1s ease-in-out infinite" };
}

/** 마지막 대화 시각을 정렬용 timestamp(ms)로 변환. lastMessageAtIso 우선, ISO 폴백, 라벨 파싱. */
export function sortableLastMsgTs(c: PatientConsult): number {
  const now = Date.now();
  if (c.lastMessageAtIso) {
    const t = new Date(c.lastMessageAtIso).getTime();
    if (!Number.isNaN(t)) return t;
  }
  if (c.lastPatientMessageAt) {
    const t = new Date(c.lastPatientMessageAt).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const label = c.lastMessageAt ?? "";
  let hoursAgo = 9999;
  const hm = label.match(/(\d+)\s*시간/);
  const dm = label.match(/(\d+)\s*일/);
  const wm = label.match(/(\d+)\s*주/);
  if (hm) hoursAgo = parseInt(hm[1], 10);
  else if (label === "어제") hoursAgo = 24;
  else if (dm) hoursAgo = parseInt(dm[1], 10) * 24;
  else if (wm) hoursAgo = parseInt(wm[1], 10) * 24 * 7;
  return now - hoursAgo * 3_600_000;
}

/** ISO 시각 → 사람-친화 라벨 ("N시간 전", "어제", "N일 전", "N주 전"). */
export function relativeTimeLabel(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const diffMs = Date.now() - ms;
  const h = diffMs / 3_600_000;
  if (h < 1) return "방금";
  if (h < 24) return `${Math.floor(h)}시간 전`;
  if (h < 48) return "어제";
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return `${Math.floor(d / 7)}주 전`;
}

/** patient_profiles.gender (DB 영문/한글 혼재) → 카드 표시용 한글 ("여성"/"남성"/"기타"). */
export function mapGenderKo(g: string | null | undefined): string {
  if (!g) return "";
  const v = g.trim().toLowerCase();
  if (v === "female" || v === "f" || v === "여" || v === "여성") return "여성";
  if (v === "male" || v === "m" || v === "남" || v === "남성") return "남성";
  return "기타";
}

/** ai_questionnaires.symptoms 의 자유 문자열 라벨 → 카드 카테고리(아이콘/색). */
export function symptomLabelToCategory(label: string): SymptomCategory {
  const l = label.trim();
  if (/소화|위|장|역류|변비|설사|복통/.test(l)) return "digestion";
  if (/수면|불면|잠/.test(l)) return "sleep";
  if (/피부|여드름|탈모|아토피|건조/.test(l)) return "skin";
  if (/면역|감기|관절|염증/.test(l)) return "immune";
  return "fatigue";
}

export function getRelationTag(c: PatientConsult): RelationTag {
  if (c.hasPurchase && c.hasVisit) return "regular";
  if (!c.hasPurchase && !c.hasVisit && c.consultationCount >= 5) return "over";
  return "none";
}

export function getRelationSortPriority(tag: RelationTag): number {
  if (tag === "regular") return 0;
  if (tag === "none") return 1;
  return 2;
}

/* ── fetcher ── */

type SupabaseLike = SupabaseClient;

/**
 * 이 약사가 담당하는 모든 consultations(status 무관) → 통합 PatientConsult[].
 * setState 하지 않고 결과만 반환(호출 측에서 setConsults 적용).
 *
 * 보조 테이블 IN 쿼리 1회씩(N+1 금지): profiles / patient_profiles / ai_questionnaires
 *   / visit_schedules / patient_supplements / messages(consultation_id 별 max created_at).
 */
export async function fetchAllConsultations(
  supabase: SupabaseLike,
  pharmacistId: string,
): Promise<PatientConsult[]> {
  type ConsRow = {
    id: string;
    status: string;
    patient_id: string;
    questionnaire_id: string | null;
    consultation_type: "local" | "remote" | null;
    registration_source: string | null;
    rejected_reason: string | null;
    rejected_at: string | null;
    last_message_at: string | null;
    unread_count_pharmacist: number | null;
    created_at: string;
  };
  const consRes = await supabase
    .from("consultations")
    .select(
      "id, status, patient_id, questionnaire_id, consultation_type, registration_source, rejected_reason, rejected_at, last_message_at, unread_count_pharmacist, created_at",
    )
    .eq("pharmacist_id", pharmacistId)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (consRes.error) {
    console.error("[pharmacistConsults] consultations fetch failed:", consRes.error);
    return [];
  }
  const consultations = ((consRes.data ?? []) as unknown) as ConsRow[];
  if (consultations.length === 0) return [];

  const consultationIds = consultations.map((c) => c.id);
  const patientIds = Array.from(new Set(consultations.map((c) => c.patient_id)));
  const questionnaireIds = consultations
    .map((c) => c.questionnaire_id)
    .filter((v): v is string => !!v);

  const [profilesRes, patientProfRes, qRes, visitRes, suppRes, msgRes, vrRes, dgRes, pcRes] = await Promise.all([
    patientIds.length > 0
      ? supabase.from("profiles").select("id, name, avatar_url").in("id", patientIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    patientIds.length > 0
      ? supabase.from("patient_profiles").select("id, birth_year, gender").in("id", patientIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    questionnaireIds.length > 0
      ? supabase
          .from("ai_questionnaires")
          .select("id, symptoms, ai_summary, free_text")
          .in("id", questionnaireIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    consultationIds.length > 0
      ? supabase
          .from("visit_schedules")
          .select("id, consultation_id, scheduled_date, status, visited_date")
          .in("consultation_id", consultationIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    patientIds.length > 0
      ? supabase
          .from("patient_supplements")
          .select("id, patient_id, name, source, start_date, days, created_at")
          .in("patient_id", patientIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    consultationIds.length > 0
      ? supabase
          .from("messages")
          .select("consultation_id, created_at")
          .in("consultation_id", consultationIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    // 방문 후 처리 끊김 판정 — 구매 영양제 리스트 작성 여부.
    consultationIds.length > 0
      ? supabase
          .from("visit_records")
          .select("id, consultation_id, visit_date, purchased_supplements")
          .in("consultation_id", consultationIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    // 방문 후 처리 끊김 판정 — 복용 가이드 발송 여부(본문 불필요, created_at 만).
    consultationIds.length > 0
      ? supabase
          .from("dosage_guides")
          .select("id, consultation_id, created_at")
          .in("consultation_id", consultationIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    // 약사 메모 — 차트(pharmacist_charts.pharmacist_memo)와 단일 소스. RLS 가 pharmacist_id 자동 필터.
    consultationIds.length > 0
      ? supabase
          .from("pharmacist_charts")
          .select("consultation_id, pharmacist_memo")
          .in("consultation_id", consultationIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ]);

  for (const [name, res] of [
    ["profiles", profilesRes],
    ["patient_profiles", patientProfRes],
    ["ai_questionnaires", qRes],
    ["visit_schedules", visitRes],
    ["patient_supplements", suppRes],
    ["messages", msgRes],
    ["visit_records", vrRes],
    ["dosage_guides", dgRes],
    ["pharmacist_charts", pcRes],
  ] as const) {
    if ("error" in res && res.error) {
      console.error(`[pharmacistConsults] ${name} fetch failed:`, res.error);
    }
  }

  // consultation_id → pharmacist_memo. row 없는 consultation 은 Map 에 없음(undefined → 매핑 시 "").
  const chartMemoByCons = new Map<string, string | null>();
  for (const pc of (pcRes.data ?? []) as Array<{ consultation_id: string | null; pharmacist_memo: string | null }>) {
    if (!pc.consultation_id) continue;
    chartMemoByCons.set(pc.consultation_id, pc.pharmacist_memo);
  }

  const lastMsgByCons = new Map<string, string>();
  for (const m of (msgRes.data ?? []) as Array<{ consultation_id: string; created_at: string }>) {
    if (!m.consultation_id || !m.created_at) continue;
    const prev = lastMsgByCons.get(m.consultation_id);
    if (!prev || m.created_at > prev) lastMsgByCons.set(m.consultation_id, m.created_at);
  }

  const profileById = new Map<string, { name: string; avatar_url: string | null }>();
  for (const p of (profilesRes.data ?? []) as { id: string; name: string; avatar_url: string | null }[]) {
    profileById.set(p.id, { name: p.name, avatar_url: p.avatar_url });
  }
  const patientProfById = new Map<string, { birth_year: number | null; gender: string | null }>();
  for (const pp of (patientProfRes.data ?? []) as { id: string; birth_year: number | null; gender: string | null }[]) {
    patientProfById.set(pp.id, { birth_year: pp.birth_year, gender: pp.gender });
  }
  const qById = new Map<string, { symptoms: string[] | null; ai_summary: string | null; free_text: string | null }>();
  for (const q of (qRes.data ?? []) as { id: string; symptoms: string[] | null; ai_summary: string | null; free_text: string | null }[]) {
    qById.set(q.id, { symptoms: q.symptoms, ai_summary: q.ai_summary, free_text: q.free_text });
  }

  type VisitRow = { id: string; consultation_id: string; scheduled_date: string; status: string; visited_date: string | null };
  const visitsByCons = new Map<string, VisitRow[]>();
  for (const v of (visitRes.data ?? []) as VisitRow[]) {
    const arr = visitsByCons.get(v.consultation_id) ?? [];
    arr.push(v);
    visitsByCons.set(v.consultation_id, arr);
  }
  const todayIso = getTodayLocalISO();

  type SuppRow = { id: string; patient_id: string; name: string; source: "manual" | "dosage_guide"; start_date: string | null; days: number | null; created_at: string | null };
  const suppsByPatient = new Map<string, SuppRow[]>();
  for (const s of (suppRes.data ?? []) as SuppRow[]) {
    const arr = suppsByPatient.get(s.patient_id) ?? [];
    arr.push(s);
    suppsByPatient.set(s.patient_id, arr);
  }

  // 방문 후 처리 끊김 — consultation_id 별 visit_records / dosage_guides 모음.
  type VisitRecRow = { id: string; consultation_id: string; visit_date: string | null; purchased_supplements: unknown };
  const visitRecsByCons = new Map<string, VisitRecRow[]>();
  for (const vr of (vrRes.data ?? []) as VisitRecRow[]) {
    if (!vr.consultation_id) continue;
    const arr = visitRecsByCons.get(vr.consultation_id) ?? [];
    arr.push(vr);
    visitRecsByCons.set(vr.consultation_id, arr);
  }
  type DosageGuideRow = { id: string; consultation_id: string; created_at: string | null };
  const dosageGuidesByCons = new Map<string, DosageGuideRow[]>();
  for (const dg of (dgRes.data ?? []) as DosageGuideRow[]) {
    if (!dg.consultation_id) continue;
    const arr = dosageGuidesByCons.get(dg.consultation_id) ?? [];
    arr.push(dg);
    dosageGuidesByCons.set(dg.consultation_id, arr);
  }

  return consultations.map((c) => {
    const prof = profileById.get(c.patient_id);
    const pProf = patientProfById.get(c.patient_id);
    const q = c.questionnaire_id ? qById.get(c.questionnaire_id) : null;
    const visits = visitsByCons.get(c.id) ?? [];
    const supps = suppsByPatient.get(c.patient_id) ?? [];

    const upcomingVisit = visits
      .filter((v) => v.status === "scheduled" && v.scheduled_date >= todayIso)
      .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))[0];
    const hasVisitToday = visits.some(
      (v) => v.status === "scheduled" && v.scheduled_date === todayIso,
    );
    const noShowList = visits
      .filter((v) => v.status === "scheduled" && v.scheduled_date < todayIso)
      .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
    const isNoShow = noShowList.length > 0;
    const noShowDate = noShowList[0]?.scheduled_date;

    // 방문 후 처리 끊김 — 구매 리스트 미작성 / 복용 가이드 미발송.
    //   visit_records 행이 아예 없는 consultation(레거시 completed)은 두 boolean 다 false → 제외.
    const vrList = visitRecsByCons.get(c.id) ?? [];
    const emptyPurchaseRows = vrList.filter((vr) => {
      const ps = vr.purchased_supplements;
      if (ps == null) return true;
      return Array.isArray(ps) && ps.length === 0;
    });
    const needsPurchaseList = emptyPurchaseRows.length > 0;
    const filledPurchaseRows = vrList.filter((vr) => {
      const ps = vr.purchased_supplements;
      return Array.isArray(ps) && ps.length > 0;
    });
    let needsDosageGuide = false;
    if (filledPurchaseRows.length > 0) {
      const lastPurchaseVisitDate = filledPurchaseRows
        .map((vr) => vr.visit_date)
        .filter((d): d is string => !!d)
        .sort((a, b) => b.localeCompare(a))[0];
      if (lastPurchaseVisitDate) {
        const dgList = dosageGuidesByCons.get(c.id) ?? [];
        const sentAfter = dgList.filter(
          (dg) => !!dg.created_at && dg.created_at.slice(0, 10) > lastPurchaseVisitDate,
        );
        needsDosageGuide = sentAfter.length === 0;
      }
    }

    const completedVisits = visits.filter((v) => v.status === "completed" || v.status === "visited");
    const lastCompletedDate = completedVisits
      .map((v) => v.visited_date ?? v.scheduled_date)
      .sort((a, b) => b.localeCompare(a))[0];

    const purchasedMeds: string[] = [];
    const purchasedSeen = new Set<string>();
    for (const s of supps) {
      if (s.source !== "dosage_guide") continue;
      const nm = s.name?.trim();
      if (!nm || purchasedSeen.has(nm)) continue;
      purchasedSeen.add(nm);
      purchasedMeds.push(nm);
    }
    const remainList = supps
      .map((s) => calcRemainingDays(s.start_date, s.days))
      .filter((r): r is number => r != null);
    const minRemainingDays = remainList.length > 0 ? Math.min(...remainList) : null;
    const isMedEndingSoon =
      minRemainingDays != null && minRemainingDays >= 0 && minRemainingDays <= PHARM_MED_NEAR_DAYS;

    // supplementStatus — 환자 목록 "복용 중/미복용/복용 완료" 칩 연결용.
    //   supps 없음 → "not_taking"
    //   days 있는 row 들의 잔여일이 전부 음수(종료) AND days null 행 없음 → "completed"
    //   그 외(잔여>=0 행 1건↑ 또는 days null 행 1건↑) → "taking" (days null = 종료일 모름이라 복용 중 간주)
    let supplementStatus: "taking" | "not_taking" | "completed";
    if (supps.length === 0) {
      supplementStatus = "not_taking";
    } else {
      const hasUnknownEnd = supps.some((s) => s.days == null);
      const allEnded =
        !hasUnknownEnd &&
        supps.every((s) => {
          const r = calcRemainingDays(s.start_date, s.days);
          return r != null && r < 0;
        });
      supplementStatus = allEnded ? "completed" : "taking";
    }
    const isTaking = supplementStatus === "taking";
    // hasPurchase — 우리 약국 가이드 발행 영양제(source='dosage_guide') 1건 이상이면 true.
    //   ※ 마이그레이션 정의 "전담(단골)" = 3회 구매. 현재 누적 구매 횟수 컬럼이 없어 "구매 1건 이상"으로 근사.
    //   purchasedMeds 가 이미 source 필터를 거친 결과라 그대로 재사용.
    const hasPurchase = purchasedMeds.length > 0;

    // 우리 약국 구매(=가이드 등록) 마지막 시점 — source='dosage_guide' row 의 created_at MAX.
    //   기간 필터·최근 활동 정렬의 4기준 중 하나로 사용.
    let lastPurchaseAtIso: string | null = null;
    for (const s of supps) {
      if (s.source !== "dosage_guide") continue;
      if (!s.created_at) continue;
      if (!lastPurchaseAtIso || s.created_at > lastPurchaseAtIso) {
        lastPurchaseAtIso = s.created_at;
      }
    }

    let patientStatus: PatientStatus;
    if (c.status === "pending" || c.status === "matched") {
      patientStatus = "requested";
    } else if (completedVisits.length >= 1 && isTaking) {
      patientStatus = "managing";
    } else {
      patientStatus = "inactive";
    }

    const symptoms = ((q?.symptoms ?? []) as string[])
      .filter((s): s is string => typeof s === "string" && !!s.trim())
      .map((label) => ({ label, category: symptomLabelToCategory(label) }));

    const createdAtLabel = c.created_at.slice(0, 10).replace(/-/g, ".");
    const visitDateLabel = lastCompletedDate
      ? lastCompletedDate.replace(/-/g, ".")
      : undefined;
    const nextVisitLabel = upcomingVisit
      ? upcomingVisit.scheduled_date.replace(/-/g, ".")
      : undefined;

    const unread = c.unread_count_pharmacist ?? 0;
    const lastMsgAtIso = lastMsgByCons.get(c.id) ?? c.last_message_at ?? null;

    return {
      id: c.id,
      patientId: c.patient_id ?? null,
      patientName: prof?.name?.trim() || "환자",
      patientGender: mapGenderKo(pProf?.gender),
      birthYear: pProf?.birth_year ?? 0,
      patientStatus,
      consultType: c.consultation_type ?? "remote",
      symptoms,
      aiSummary: q?.ai_summary ?? "",
      freeText: q?.free_text ?? "",
      memo: chartMemoByCons.get(c.id) ?? "",
      unreadCount: unread,
      lastMessageAt: relativeTimeLabel(lastMsgAtIso),
      lastMessageAtIso: lastMsgAtIso ?? undefined,
      createdAt: createdAtLabel,
      prevConsultCount: 0,
      visitDate: visitDateLabel,
      nextVisitDate: nextVisitLabel,
      purchasedMeds,
      registrationSource: c.registration_source === "offline" ? "offline" : "app",
      hasAppAccount: true,
      supplementStatus,
      consultationCount: 1,
      hasPurchase,
      hasVisit: completedVisits.length >= 1,
      isRejected: c.status === "rejected",
      rejectedReason: c.rejected_reason ?? undefined,
      rejectedAt: c.rejected_at ?? undefined,
      isReadByPharmacist: unread === 0,
      lastPatientMessageAt: c.last_message_at ?? undefined,
      isNoShow,
      noShowDate,
      minRemainingDays,
      isMedEndingSoon,
      hasVisitToday,
      needsPurchaseList,
      needsDosageGuide,
      // patient_profiles 에 birth_date 컬럼이 없어 현재 항상 null. 컬럼 추가 시 pProf?.birth_date 로 교체.
      birthDate: null,
      lastPurchaseAtIso,
    };
  });
}

/**
 * 약사 메모 저장 — pharmacist_charts.pharmacist_memo 단일 소스. 대시보드·차트 공용.
 * UNIQUE(pharmacist_id, consultation_id) 기준 upsert(없으면 INSERT, 있으면 UPDATE).
 * 빈 메모는 호출부에서 trim 후 null 로 넘긴다(차트와 일관성).
 */
export async function upsertChartMemo(
  supabase: SupabaseLike,
  args: { pharmacistId: string; consultationId: string; patientId: string | null; patientName: string; memo: string | null },
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from("pharmacist_charts")
    .upsert(
      {
        pharmacist_id: args.pharmacistId,
        consultation_id: args.consultationId,
        patient_id: args.patientId,
        patient_name: args.patientName,
        chart_type: "self",
        pharmacist_memo: args.memo,
      },
      { onConflict: "pharmacist_id,consultation_id" },
    );
  return { error };
}
