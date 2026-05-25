"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import HealthIndicatorComparison from "@/components/HealthIndicatorComparison";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  MED_NEAR_THRESHOLD,
  VISIT_NEAR_THRESHOLD,
  getTodayLocalISO,
  daysFromTodayLocal,
  calcRemainingDays,
} from "@/lib/nearThresholds";
import type { Database } from "@/types/database";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type HealthCheckRow = Database["public"]["Tables"]["health_checks"]["Row"];
type MedicationStatusRow = Database["public"]["Tables"]["medication_status"]["Row"];
type MedicationStatusInsert = Database["public"]["Tables"]["medication_status"]["Insert"];
type MedicationCheckRow = Database["public"]["Tables"]["medication_checks"]["Row"];
type MedicationCheckInsert = Database["public"]["Tables"]["medication_checks"]["Insert"];
type PatientSupplementRow = Database["public"]["Tables"]["patient_supplements"]["Row"];
type PatientSupplementInsert = Database["public"]["Tables"]["patient_supplements"]["Insert"];
type PatientSupplementUpdate = Database["public"]["Tables"]["patient_supplements"]["Update"];
type VisitScheduleRow = Database["public"]["Tables"]["visit_schedules"]["Row"];

/* ══════════════════════════════════════════
   기본 프로필 (DB 로딩 실패 시 fallback)
   ══════════════════════════════════════════ */

const FALLBACK_PROFILE = {
  name: "사용자",
  birth: "",
  phone: "",
  avatarUrl: "",
};

type TimeSlot = "아침" | "점심" | "저녁" | "취침 전";

interface Supplement {
  id: string;
  name: string;
  time_slots: TimeSlot[];
  /** 하루 복용 횟수. 마이페이지 하트 개수의 기준. 슬롯은 보조 라벨로만. */
  daily_count: number;
  source: "manual" | "dosage_guide";
  source_dosage_guide_id: string | null;
  /** 복용 시작일 (YYYY-MM-DD). 레거시 row 는 null. */
  start_date: string | null;
  /** 복용 예정 일수. 가이드 가져오기 시 채워짐. null 이면 카운트다운 미표시. */
  days: number | null;
}

/** dosage_guides.supplements jsonb 해석용 (약속된 신규 형식: { name, time_slots }).
 *  기존 SupplementItem({name, dosage, timing})과 다른 별개 약속이라 mypage 로컬 타입으로 둠. */
interface DosageGuide {
  id: string;
  supplements: {
    name: string;
    time_slots: string[];
    daily_count?: number;
    dispense_type: "bottle" | "compounded";
    days: number | null;
    dosage: string;
    timing: string;
    etc_note: string;
    memo: string;
    package_note: boolean;
  }[];
  dosage_days: number | null;
  dosage_end_date: string | null;
  custom_guide: string | null;
  dosage_status: "active" | "completed" | "stopped";
  sent_at: string | null;
  created_at: string;
  /** 발송 약사 id (dosage_guides.pharmacist_id). */
  pharmacist_id: string | null;
  /** pharmacist_profiles.license_name (없으면 profiles.name 폴백). */
  pharmacist_name: string | null;
  /** pharmacist_profiles.pharmacy_name. */
  pharmacy_name: string | null;
}

const VALID_TIME_SLOTS: TimeSlot[] = ["아침", "점심", "저녁", "취침 전"];
/** 슬롯 표준 순서 — VALID_TIME_SLOTS 와 동일. 저장 시 이 순서로 정규화. */
const SLOT_ORDER: readonly TimeSlot[] = VALID_TIME_SLOTS;
/** slots 를 SLOT_ORDER 인덱스 기준으로 정렬. 표에 없는 값은 뒤로. */
function sortSlots(slots: TimeSlot[]): TimeSlot[] {
  return [...slots].sort((a, b) => {
    const ai = SLOT_ORDER.indexOf(a);
    const bi = SLOT_ORDER.indexOf(b);
    const aRank = ai < 0 ? Number.MAX_SAFE_INTEGER : ai;
    const bRank = bi < 0 ? Number.MAX_SAFE_INTEGER : bi;
    return aRank - bRank;
  });
}
const isValidTimeSlot = (s: string): s is TimeSlot =>
  (VALID_TIME_SLOTS as string[]).includes(s);

/** patient_supplements row → 화면용 Supplement 매핑.
 *  time_slots 는 DB text[] 라 임의 문자열일 수 있으므로 알려진 4종으로 필터. */
function mapPatientSupplementRow(row: PatientSupplementRow): Supplement {
  const slots = Array.isArray(row.time_slots)
    ? row.time_slots.filter((s): s is TimeSlot => typeof s === "string" && isValidTimeSlot(s))
    : [];
  // DB가 NOT NULL/기본 1 이지만 방어적으로: row.daily_count 가 number 면 그 값, 아니면 슬롯 개수(최소 1).
  const dailyCount =
    typeof row.daily_count === "number" && row.daily_count > 0
      ? row.daily_count
      : Math.max(slots.length, 1);
  return {
    id: row.id,
    name: row.name,
    time_slots: slots,
    daily_count: dailyCount,
    source: row.source === "dosage_guide" ? "dosage_guide" : "manual",
    source_dosage_guide_id: row.source_dosage_guide_id,
    start_date: row.start_date ?? null,
    days: typeof row.days === "number" && row.days > 0 ? row.days : null,
  };
}

/** I-4 임박 알림 헬퍼 5종 (MED/VISIT_NEAR_THRESHOLD, getTodayLocalISO,
 *  daysFromTodayLocal, calcRemainingDays) 는 src/lib/nearThresholds.ts 로 추출됨.
 *  서버 발송 코드와 공유하기 위함 — 로직 변경 시 lib 파일만 수정. */

/** YYYY-MM-DD → "M월 D일" 형식 라벨. 형식 파괴/null 이면 null.
 *  new Date 미사용 (자정 어긋남 회피) — 문자열 분해해서 숫자만 추출. */
function formatStartLabel(startDate: string | null): string | null {
  if (!startDate) return null;
  const m = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!month || !day) return null;
  return `${month}월 ${day}일`;
}

/** VAPID public key(urlBase64) → Uint8Array. pushManager.subscribe applicationServerKey 용 표준 변환. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

/** 일수 계산기 — 총개수 ÷ (하루횟수 × 한 번에 먹는 양) = 일수(버림).
 *  추가/편집 모달 양쪽에서 재사용. dailyCount=0 이면 슬롯 먼저 선택 안내. */
interface DayCalculatorProps {
  dailyCount: number;
  onApply: (days: number) => void;
}
function DayCalculator({ dailyCount, onApply }: DayCalculatorProps) {
  const [totalCount, setTotalCount] = useState<string>("");
  const [perDose, setPerDose] = useState<string>("1");
  const totalNum = parseInt(totalCount, 10);
  const perNum = parseInt(perDose, 10);
  const validInputs =
    Number.isFinite(totalNum) && totalNum > 0 &&
    Number.isFinite(perNum) && perNum > 0;
  const denom = dailyCount > 0 && validInputs ? dailyCount * perNum : 0;
  const result = denom > 0 ? Math.floor(totalNum / denom) : null;
  const hasRemainder = denom > 0 ? (totalNum % denom !== 0) : false;
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(94,125,108,0.22)",
    fontSize: 15,
    color: "#2C3630",
    fontFamily: "'Noto Sans KR', sans-serif",
    boxSizing: "border-box",
  };
  return (
    <div style={{
      marginTop: 10,
      padding: 14,
      borderRadius: 12,
      background: "#EDF4F0",
      border: "1px solid rgba(94,125,108,0.18)",
    }}>
      {dailyCount === 0 ? (
        <div style={{ fontSize: 14, color: "#3D4A42", lineHeight: 1.5 }}>
          복용 시간을 먼저 선택해 주세요.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#2C3630", marginBottom: 10 }}>
            하루 {dailyCount}번 기준으로 계산해요
          </div>
          <label style={{ display: "block", marginBottom: 10, fontSize: 14, color: "#3D4A42" }}>
            <span style={{ display: "block", marginBottom: 4 }}>총 개수 (정/캡슐)</span>
            <input
              type="number"
              min={1}
              placeholder="예: 60"
              value={totalCount}
              onChange={(e) => setTotalCount(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "block", marginBottom: 12, fontSize: 14, color: "#3D4A42" }}>
            <span style={{ display: "block", marginBottom: 4 }}>한 번에 (정/캡슐)</span>
            <input
              type="number"
              min={1}
              placeholder="예: 1"
              value={perDose}
              onChange={(e) => setPerDose(e.target.value)}
              style={inputStyle}
            />
          </label>
          {result != null && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 15, color: "#2C3630", fontWeight: 700 }}>
                약 {result}일분
              </div>
              {hasRemainder && (
                <div style={{ fontSize: 14, color: "#C06B45", marginTop: 4, lineHeight: 1.5 }}>
                  정확히 나누어떨어지지 않아 마지막 날은 복용량이 조금 다를 수 있어요
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => { if (result != null) onApply(result); }}
            disabled={result == null}
            style={{
              width: "100%",
              minHeight: 48,
              borderRadius: 12,
              border: "none",
              background: result == null ? "#B3CCBE" : "#4A6355",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: result == null ? "default" : "pointer",
              fontFamily: "'Noto Sans KR', sans-serif",
            }}
          >
            이 일수로 넣기
          </button>
        </>
      )}
    </div>
  );
}

/** "오늘" pill 배지. 선택된 날짜가 오늘과 같을 때만 부모가 조건부 렌더링. */
function TodayBadge() {
  return (
    <span style={{
      fontSize: 13,
      padding: "2px 8px",
      borderRadius: 100,
      background: "var(--sage-pale, #EDF4F0)",
      color: "#4A6355",
      fontWeight: 600,
      flexShrink: 0,
      whiteSpace: "nowrap",
    }}>오늘</span>
  );
}

type HeartStatus = "full" | "half" | "empty" | "today";
const WEEK_DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const WEEK_HEARTS: HeartStatus[] = ["full", "full", "half", "today", "empty", "empty", "empty"];

interface HealthScore {
  label: string;
  before: number;
  after: number;
  lowerIsBetter?: boolean;
}
const HEALTH_SCORES: HealthScore[] = [
  { label: "에너지/활력", before: 3, after: 5 },
  { label: "수면", before: 2, after: 4 },
  { label: "소화", before: 4, after: 6 },
  { label: "기분", before: 3, after: 4 },
  { label: "증상 불편도", before: 7, after: 4, lowerIsBetter: true },
];

interface Stamp {
  date: string;
  filled: boolean;
}
const STAMPS: Stamp[] = [
  { date: "03.20", filled: true },
  { date: "03.27", filled: true },
  { date: "04.03", filled: true },
  ...Array.from({ length: 7 }, () => ({ date: "", filled: false })),
];

type SymptomCategory = "fatigue" | "sleep" | "digestion" | "immune" | "skin";
const TAG_CLASS: Record<SymptomCategory, string> = {
  fatigue: "my-tag-fatigue",
  sleep: "my-tag-sleep",
  digestion: "my-tag-digestion",
  immune: "my-tag-immune",
  skin: "my-tag-skin",
};

interface ConsultItem {
  id: string;
  pharmacist: string;
  pharmacy: string;
  date: string;
  symptoms: { label: string; category: SymptomCategory }[];
  status: "active" | "completed";
}
const CONSULTS: ConsultItem[] = [
  {
    id: "c-1",
    pharmacist: "김서연 약사",
    pharmacy: "그린약국",
    date: "2026.04.01",
    symptoms: [
      { label: "만성피로", category: "fatigue" },
      { label: "수면장애", category: "sleep" },
    ],
    status: "active",
  },
  {
    id: "c-2",
    pharmacist: "김서연 약사",
    pharmacy: "그린약국",
    date: "2026.03.15",
    symptoms: [{ label: "소화불량", category: "digestion" }],
    status: "completed",
  },
  {
    id: "c-3",
    pharmacist: "박민수 약사",
    pharmacy: "온누리약국",
    date: "2025.12.20",
    symptoms: [{ label: "비염", category: "immune" }],
    status: "completed",
  },
];

/* ══════════════════════════════════════════
   유틸
   ══════════════════════════════════════════ */
function calcAge(birth: string) {
  const today = new Date();
  const b = new Date(birth);
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

/* ══════════════════════════════════════════
   하트 SVG 컴포넌트
   ══════════════════════════════════════════ */
function HeartIcon({ filled, size = 20 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={filled ? "var(--color-sage-deep)" : "#D1D5D3"}
        style={{ transition: "fill 0.3s ease" }}
      />
    </svg>
  );
}

function HalfHeartIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="halfHeart">
          <stop offset="50%" stopColor="var(--color-sage-deep)" />
          <stop offset="50%" stopColor="#D1D5D3" />
        </linearGradient>
      </defs>
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill="url(#halfHeart)"
      />
    </svg>
  );
}

/* ══════════════════════════════════════════
   메인 컴포넌트
   ══════════════════════════════════════════ */
/* 빈 상태 공통 스타일 */
const emptyBox: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center", padding: "36px 20px", textAlign: "center",
};
const emptyEmoji: React.CSSProperties = { fontSize: 48, marginBottom: 12, lineHeight: 1 };
const emptyTitle: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: "#2C3630", marginBottom: 6 };
const emptyDesc: React.CSSProperties = { fontSize: 14, color: "#3D4A42", lineHeight: 1.6, marginBottom: 16 };
const emptyBtn: React.CSSProperties = {
  padding: "11px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700,
  background: "#4A6355", color: "#fff", border: "none", cursor: "pointer",
};
const emptyBtnOutline: React.CSSProperties = {
  ...emptyBtn, background: "#fff", color: "#4A6355",
  border: "1.5px solid #B3CCBE",
};

function MypageContent() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const showEmptyState = false;

  const doLogout = useCallback(async () => {
    await signOut();
    router.replace("/");
  }, [signOut, router]);

  /* ── 프로필 (DB) ── */
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profile, setProfile] = useState({
    name: FALLBACK_PROFILE.name,
    birth: FALLBACK_PROFILE.birth,
    phone: FALLBACK_PROFILE.phone,
    avatarUrl: FALLBACK_PROFILE.avatarUrl,
  });

  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBirth, setEditBirth] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  /* health_checks 로드 (가장 최신 2건이 변화 비교에 사용) */
  const [hcRows, setHcRows] = useState<HealthCheckRow[] | null>(null);

  /* consultations 로드 — 환자 본인의 모든 상담 (활성/종료) */
  const [dbConsults, setDbConsults] = useState<ConsultItem[] | null>(null);
  // 활성/종료 status 분류
  const ACTIVE_CONSULT_STATUSES = new Set([
    "pending", "matched", "accepted", "chatting",
    "visit_scheduled", "visited", "report_sent",
    "requested", "managing",
  ]);
  const CLOSED_CONSULT_STATUSES = new Set([
    "completed", "inactive", "cancelled", "rejected",
  ]);

  useEffect(() => {
    if (!user) {
      setHcRows([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("health_checks")
        .select(
          "id, patient_id, consultation_id, energy_score, sleep_score, digestion_score, mood_score, discomfort_score, memo, created_at",
        )
        .eq("patient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) {
        console.error("[mypage] health_checks load failed:", error);
        setHcRows([]);
        return;
      }
      setHcRows((data ?? []) as unknown as HealthCheckRow[]);
    })();
  }, [user]);

  /* ── DB 로드: 가장 가까운 다가오는 방문 예정 1건 ──
   *  visit_schedules + pharmacist_profiles + profiles 폴백.
   *  status="scheduled" + scheduled_date >= 오늘(KST). 0건이면 null. */
  type NextVisit = {
    id: string;
    scheduled_date: string;
    scheduled_time: string | null;
    note: string | null;
    pharmacist_name: string | null;
    pharmacy_name: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
    /** visit_schedules.status — 'scheduled' | 'completed'. cancelled 는 쿼리에서 제외. */
    status: "scheduled" | "completed";
    /** 약사가 [방문 완료] 누른 날(visit_schedules.visited_date). status='completed' 일 때만 채워짐. */
    visited_date: string | null;
  };
  const [upcomingVisits, setUpcomingVisits] = useState<NextVisit[]>([]);
  const [pastVisits, setPastVisits] = useState<NextVisit[]>([]);
  /** 다가오는 방문이 3건 이상일 때 첫 2건 외 나머지 펼침 여부. */
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  /** 지난 방문 영역 접힘/펼침. 기본 접힘. */
  const [showPast, setShowPast] = useState(false);
  const loadVisits = useCallback(async () => {
    if (!user) {
      setUpcomingVisits([]);
      setPastVisits([]);
      return;
    }
    // scheduled + completed 둘 다 한번에 — cancelled 만 DB 단계에서 제외.
    //   completed = 약사가 방문 확인한 row → 무조건 "지난 방문"으로 분기 (날짜 무관).
    const { data: vsData, error: vsErr } = await supabase
      .from("visit_schedules")
      .select("id, pharmacist_id, scheduled_date, scheduled_time, note, status, visited_date")
      .eq("patient_id", user.id)
      .in("status", ["scheduled", "completed"])
      .order("scheduled_date", { ascending: true });
    if (vsErr) {
      console.error("[mypage] visit_schedules load failed:", vsErr);
      setUpcomingVisits([]);
      setPastVisits([]);
      return;
    }
    const rows = (vsData ?? []) as unknown as Array<
      Pick<VisitScheduleRow, "id" | "pharmacist_id" | "scheduled_date" | "scheduled_time" | "note">
      & { status: string | null; visited_date: string | null }
    >;
    if (rows.length === 0) {
      setUpcomingVisits([]);
      setPastVisits([]);
      return;
    }
    // 약사/약국 정보 일괄 조회 — 등장 pharmacist_id 중복 제거 후 IN.
    //   기존 단건 .eq → 여러 건 .in 로 확장. 폴백 로직(license_name → profiles.name)은 동일.
    const pharmIds = Array.from(
      new Set(rows.map((r) => r.pharmacist_id).filter((id): id is string => !!id)),
    );
    type PharmInfo = {
      license_name: string | null;
      pharmacy_name: string | null;
      address: string | null;
      lat: number | null;
      lng: number | null;
    };
    const pharmInfoById = new Map<string, PharmInfo>();
    if (pharmIds.length > 0) {
      const { data: ppData, error: ppErr } = await supabase
        .from("pharmacist_profiles")
        .select("id, license_name, pharmacy_name, address, lat, lng")
        .in("id", pharmIds);
      if (ppErr) {
        console.error("[mypage] visits pharmacist_profiles fetch failed:", ppErr);
      } else {
        for (const pp of (ppData ?? []) as Array<{
          id: string;
          license_name: string | null;
          pharmacy_name: string | null;
          address: string | null;
          lat: number | string | null;
          lng: number | string | null;
        }>) {
          // DB numeric → 숫자 변환 (문자열로 올 수도 있어 Number() 후 isFinite 가드)
          const latNum = pp.lat != null ? Number(pp.lat) : NaN;
          const lngNum = pp.lng != null ? Number(pp.lng) : NaN;
          pharmInfoById.set(pp.id, {
            license_name: (pp.license_name && pp.license_name.trim()) || null,
            pharmacy_name: (pp.pharmacy_name && pp.pharmacy_name.trim()) || null,
            address: (pp.address && pp.address.trim()) || null,
            lat: Number.isFinite(latNum) ? latNum : null,
            lng: Number.isFinite(lngNum) ? lngNum : null,
          });
        }
      }
    }
    // profiles.name 폴백 — license_name 없는 약사만 보충 조회.
    const missingNameIds = pharmIds.filter((id) => !pharmInfoById.get(id)?.license_name);
    const profileNameById = new Map<string, string>();
    if (missingNameIds.length > 0) {
      const { data: profData, error: profErr } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", missingNameIds);
      if (profErr) {
        console.error("[mypage] visits profiles fallback failed:", profErr);
      } else {
        for (const p of (profData ?? []) as Array<{ id: string; name: string | null }>) {
          if (p.name && p.name.trim()) profileNameById.set(p.id, p.name.trim());
        }
      }
    }
    const mapped: NextVisit[] = rows.map((row) => {
      const pp = row.pharmacist_id ? pharmInfoById.get(row.pharmacist_id) : null;
      const pharmName =
        pp?.license_name
        ?? (row.pharmacist_id ? profileNameById.get(row.pharmacist_id) ?? null : null);
      return {
        id: row.id,
        scheduled_date: row.scheduled_date,
        scheduled_time: row.scheduled_time,
        note: row.note,
        pharmacist_name: pharmName,
        pharmacy_name: pp?.pharmacy_name ?? null,
        address: pp?.address ?? null,
        lat: pp?.lat ?? null,
        lng: pp?.lng ?? null,
        status: row.status === "completed" ? "completed" : "scheduled",
        visited_date: row.visited_date ?? null,
      };
    });
    // split — completed 는 무조건 past. scheduled 는 오늘(KST) 기준 분리.
    //   past 는 최근(scheduled_date 큰 값) 먼저. scheduled_date 는 YYYY-MM-DD 라 사전식 비교 안전.
    const todayIso = getTodayLocalISO();
    const upcoming = mapped.filter(
      (v) => v.status === "scheduled" && v.scheduled_date >= todayIso,
    );
    const past = mapped
      .filter((v) => v.status === "completed" || v.scheduled_date < todayIso)
      .sort((a, b) => (a.scheduled_date < b.scheduled_date ? 1 : a.scheduled_date > b.scheduled_date ? -1 : 0));
    setUpcomingVisits(upcoming);
    setPastVisits(past);
  }, [user]);
  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  /* consultations DB 로드 — 환자 본인의 상담 카드 (활성/종료) */
  useEffect(() => {
    if (!user) {
      setDbConsults(null);
      return;
    }
    let cancelled = false;
    (async () => {
      // 1) 본인이 patient_id 인 모든 consultation
      const { data: consData, error: consErr } = await supabase
        .from("consultations")
        .select("id, pharmacist_id, status, last_message_at, completed_at, created_at")
        .eq("patient_id", user.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (consErr) {
        console.error("[mypage] consultations load failed:", consErr);
        setDbConsults([]);
        return;
      }
      type ConsRow = {
        id: string;
        pharmacist_id: string | null;
        status: string;
        last_message_at: string | null;
        completed_at: string | null;
        created_at: string;
      };
      const rows = ((consData ?? []) as unknown) as ConsRow[];

      // 2) pharmacist_profiles IN 쿼리로 license_name + pharmacy_name 한꺼번에 조회
      const pharmIds = Array.from(
        new Set(rows.map((r) => r.pharmacist_id).filter((id): id is string => !!id)),
      );
      const pharmInfoById = new Map<string, { license_name: string | null; pharmacy_name: string | null }>();
      if (pharmIds.length > 0) {
        const { data: ppData, error: ppErr } = await supabase
          .from("pharmacist_profiles")
          .select("id, license_name, pharmacy_name")
          .in("id", pharmIds);
        if (cancelled) return;
        if (ppErr) {
          console.error("[mypage] pharmacist_profiles load failed:", ppErr);
        } else {
          for (const pp of (ppData ?? []) as { id: string; license_name: string | null; pharmacy_name: string | null }[]) {
            pharmInfoById.set(pp.id, {
              license_name: pp.license_name,
              pharmacy_name: pp.pharmacy_name,
            });
          }
        }
      }

      // 2.5) 약사 fallback 이름 — license_name 없으면 profiles.name
      const profileNameById = new Map<string, string>();
      if (pharmIds.length > 0) {
        const { data: profData, error: profErr } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", pharmIds);
        if (cancelled) return;
        if (profErr) {
          console.error("[mypage] pharmacist profiles fetch failed:", profErr);
        } else {
          for (const p of (profData ?? []) as { id: string; name: string | null }[]) {
            if (p.name && p.name.trim()) profileNameById.set(p.id, p.name.trim());
          }
        }
      }

      // 3) ConsultItem 형태로 매핑
      const fmtDate = (iso: string) => {
        const d = new Date(iso);
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
      };
      const built: ConsultItem[] = rows
        .map((r) => {
          const isActive = ACTIVE_CONSULT_STATUSES.has(r.status);
          const isClosed = CLOSED_CONSULT_STATUSES.has(r.status);
          if (!isActive && !isClosed) return null; // 미지의 status 는 표시 안 함
          const ppInfo = r.pharmacist_id ? pharmInfoById.get(r.pharmacist_id) : null;
          const profName = r.pharmacist_id ? profileNameById.get(r.pharmacist_id) : null;
          const baseName =
            ppInfo?.license_name?.trim() || profName || "약사";
          const pharmacistLabel = baseName === "약사" ? "약사" : `${baseName} 약사`;
          const pharmacy = ppInfo?.pharmacy_name?.trim() || "";
          const dateIso = r.last_message_at || r.completed_at || r.created_at;
          return {
            id: r.id,
            pharmacist: pharmacistLabel,
            pharmacy,
            date: fmtDate(dateIso),
            symptoms: [], // 차수별 ai_questionnaires 조인은 별도 작업으로 보류
            status: isActive ? "active" : "completed",
          } as ConsultItem;
        })
        .filter((x): x is ConsultItem => x !== null);

      setDbConsults(built);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* DB에서 프로필 로드 */
  useEffect(() => {
    let cancelled = false;
    if (!user) return;

    (async () => {
      setProfileLoading(true);
      setProfileError(null);

      const [profileRes, patientRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("name, phone, avatar_url")
          .eq("id", user.id)
          .maybeSingle<{ name: string; phone: string | null; avatar_url: string | null }>(),
        supabase
          .from("patient_profiles")
          .select("birth_year")
          .eq("id", user.id)
          .maybeSingle<{ birth_year: number | null }>(),
      ]);

      if (cancelled) return;

      if (profileRes.error) {
        setProfileError("프로필을 불러오지 못했어요.");
        setProfileLoading(false);
        return;
      }

      const p = profileRes.data;
      const birthYear = patientRes.data?.birth_year ?? null;
      setProfile({
        name: p?.name ?? FALLBACK_PROFILE.name,
        birth: birthYear ? `${birthYear}-01-01` : "",
        phone: p?.phone ?? "",
        avatarUrl: p?.avatar_url ?? "",
      });
      setEditName(p?.name ?? "");
      setEditBirth(birthYear ? `${birthYear}-01-01` : "");
      setProfileLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  /* ── 영양제 (날짜별 상태) ── */
  const today = new Date();
  const dayDates = [0, 1, 2].map((offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    return d;
  });
  const [dayOffset, setDayOffset] = useState(0); // 0=오늘, 1=어제, 2=그저께
  const dayLabels = ["오늘", "어제", "그저께"];

  const formatDate = (d: Date) =>
    d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

  const selectedDate = dayDates[dayOffset];
  const dateKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;

  // 날짜별 복약 상태: Record<dateKey, Record<supplementId, boolean[]>>
  const [checksByDate, setChecksByDate] = useState<Record<string, Record<string, boolean[]>>>({});

  const getChecks = (suppId: string, count: number): boolean[] => {
    return checksByDate[dateKey]?.[suppId] ?? new Array(count).fill(false);
  };

  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [supplementsLoaded, setSupplementsLoaded] = useState(false);
  const [dosageGuides, setDosageGuides] = useState<DosageGuide[]>([]);
  const [dosageGuidesLoaded, setDosageGuidesLoaded] = useState(false);
  const [addingFromGuideId, setAddingFromGuideId] = useState<string | null>(null);
  /* 마이페이지 토스트 — 영양제/가이드 DB 동작 결과 알림 (ChartClient 패턴 차용) */
  const [mypageToast, setMypageToast] = useState<string | null>(null);
  const mypageToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showMypageToast = useCallback((msg: string) => {
    setMypageToast(msg);
    if (mypageToastTimerRef.current) clearTimeout(mypageToastTimerRef.current);
    mypageToastTimerRef.current = setTimeout(() => setMypageToast(null), 3000);
  }, []);

  /* ── 이번 주 (월~일) 날짜 계산 — 실제 today 기준 ── */
  const fmtKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayKey = fmtKey(today);
  const weekDates = (() => {
    const dow = today.getDay(); // 0=일,1=월,...,6=토
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(today);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(today.getDate() + mondayOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  })();

  /* ── DB 로드: 본인 patient_supplements (전체) ── */
  const loadSupplements = useCallback(async () => {
    if (!user) {
      setSupplementsLoaded(true);
      return;
    }
    const { data, error } = await supabase
      .from("patient_supplements")
      .select("id, patient_id, name, time_slots, daily_count, source, source_dosage_guide_id, start_date, days, created_at, updated_at")
      .eq("patient_id", user.id)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[mypage] patient_supplements load failed:", error);
      showMypageToast("영양제를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      setSupplementsLoaded(true);
      return;
    }
    const rows = (data ?? []) as unknown as PatientSupplementRow[];
    setSupplements(rows.map(mapPatientSupplementRow));
    setSupplementsLoaded(true);
  }, [user, showMypageToast]);
  useEffect(() => {
    loadSupplements();
  }, [loadSupplements]);

  /* ── DB 로드: 본인 dosage_guides (활성 상태만) ──
   *  supplements jsonb 는 약속된 형식 [{ name, time_slots }] 으로 가정.
   *  레거시 형식({name, dosage, timing}) row 가 들어오면 time_slots 비어있게 안전 폴백. */
  const loadDosageGuides = useCallback(async () => {
    if (!user) {
      setDosageGuidesLoaded(true);
      return;
    }
    const { data, error } = await supabase
      .from("dosage_guides")
      .select("id, supplements, dosage_days, dosage_end_date, custom_guide, dosage_status, sent_at, created_at, pharmacist_id")
      .eq("patient_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[mypage] dosage_guides load failed:", error);
      showMypageToast("복용 가이드를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      setDosageGuidesLoaded(true);
      return;
    }
    type GuideRow = {
      id: string;
      supplements: unknown;
      dosage_days: number | null;
      dosage_end_date: string | null;
      custom_guide: string | null;
      dosage_status: "active" | "completed" | "stopped";
      sent_at: string | null;
      created_at: string;
      pharmacist_id: string | null;
    };
    const rows = (data ?? []) as unknown as GuideRow[];

    // pharmacist_profiles IN 조회 — L385-394 패턴 재사용
    const pharmIds = Array.from(
      new Set(rows.map((r) => r.pharmacist_id).filter((id): id is string => !!id)),
    );
    const pharmInfoById = new Map<string, { license_name: string | null; pharmacy_name: string | null }>();
    if (pharmIds.length > 0) {
      const { data: ppData, error: ppErr } = await supabase
        .from("pharmacist_profiles")
        .select("id, license_name, pharmacy_name")
        .in("id", pharmIds);
      if (ppErr) {
        console.error("[mypage] dosage_guides pharmacist_profiles load failed:", ppErr);
      } else {
        for (const pp of (ppData ?? []) as { id: string; license_name: string | null; pharmacy_name: string | null }[]) {
          pharmInfoById.set(pp.id, {
            license_name: pp.license_name,
            pharmacy_name: pp.pharmacy_name,
          });
        }
      }
    }

    // profiles.name 폴백 — license_name 없을 때 사용 (L400 패턴 재사용)
    const profileNameById = new Map<string, string>();
    if (pharmIds.length > 0) {
      const { data: profData, error: profErr } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", pharmIds);
      if (profErr) {
        console.error("[mypage] dosage_guides profiles fetch failed:", profErr);
      } else {
        for (const p of (profData ?? []) as { id: string; name: string | null }[]) {
          if (p.name && p.name.trim()) profileNameById.set(p.id, p.name.trim());
        }
      }
    }
    const parsed: DosageGuide[] = rows.map((r) => {
      const rawList = Array.isArray(r.supplements) ? r.supplements : [];
      type ParsedSupp = {
        name: string;
        time_slots: string[];
        daily_count?: number;
        dispense_type: "bottle" | "compounded";
        days: number | null;
        dosage: string;
        timing: string;
        etc_note: string;
        memo: string;
        package_note: boolean;
      };
      const supps = rawList
        .map((item): ParsedSupp | null => {
          if (typeof item !== "object" || item === null) return null;
          const obj = item as {
            name?: unknown;
            time_slots?: unknown;
            daily_count?: unknown;
            dispense_type?: unknown;
            days?: unknown;
            dosage?: unknown;
            timing?: unknown;
            etc_note?: unknown;
            memo?: unknown;
            package_note?: unknown;
          };
          const name = typeof obj.name === "string" ? obj.name : "";
          if (!name) return null;
          const ts = Array.isArray(obj.time_slots)
            ? obj.time_slots.filter((s): s is string => typeof s === "string")
            : [];
          const dc = typeof obj.daily_count === "number" && obj.daily_count > 0 ? obj.daily_count : undefined;
          const dispense: "bottle" | "compounded" = obj.dispense_type === "compounded" ? "compounded" : "bottle";
          const days = typeof obj.days === "number" ? obj.days : null;
          const dosage = typeof obj.dosage === "string" ? obj.dosage : "";
          const timing = typeof obj.timing === "string" ? obj.timing : "";
          const etcNote = typeof obj.etc_note === "string" ? obj.etc_note : "";
          const memo = typeof obj.memo === "string" ? obj.memo : "";
          // 레거시 row 에 package_note 없으면 true 간주 (소분약은 기본적으로 약포지 안내 노출)
          const pkgNote = typeof obj.package_note === "boolean" ? obj.package_note : true;
          return {
            name,
            time_slots: ts,
            daily_count: dc,
            dispense_type: dispense,
            days,
            dosage,
            timing,
            etc_note: etcNote,
            memo,
            package_note: pkgNote,
          };
        })
        .filter((s): s is ParsedSupp => s !== null);
      const ppInfo = r.pharmacist_id ? pharmInfoById.get(r.pharmacist_id) : null;
      const profName = r.pharmacist_id ? profileNameById.get(r.pharmacist_id) : null;
      const pharmacistName =
        (ppInfo?.license_name && ppInfo.license_name.trim()) || profName || null;
      const pharmacyName = (ppInfo?.pharmacy_name && ppInfo.pharmacy_name.trim()) || null;
      return {
        id: r.id,
        supplements: supps,
        dosage_days: r.dosage_days,
        dosage_end_date: r.dosage_end_date,
        custom_guide: r.custom_guide,
        dosage_status: r.dosage_status,
        sent_at: r.sent_at,
        created_at: r.created_at,
        pharmacist_id: r.pharmacist_id,
        pharmacist_name: pharmacistName,
        pharmacy_name: pharmacyName,
      };
    });
    setDosageGuides(parsed);
    setDosageGuidesLoaded(true);
  }, [user, showMypageToast]);
  useEffect(() => {
    loadDosageGuides();
  }, [loadDosageGuides]);

  /* ── Realtime 구독: 약사가 보낸 patient_supplements / visit_schedules / dosage_guides
   *  변화를 본인(patient_id) 한정으로 감지해 해당 load 함수만 재호출.
   *  payload.new 직접 병합 대신 refetch — pharmacist_profiles + profiles 폴백 JOIN 보존.
   *  채널 키에 user.id 포함 → 다른 환자 row 와 충돌 없음. */
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`mypage:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "patient_supplements",
          filter: `patient_id=eq.${user.id}`,
        },
        () => {
          loadSupplements();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "visit_schedules",
          filter: `patient_id=eq.${user.id}`,
        },
        () => {
          loadVisits();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dosage_guides",
          filter: `patient_id=eq.${user.id}`,
        },
        () => {
          loadDosageGuides();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadSupplements, loadVisits, loadDosageGuides]);

  /* ── DB 로드: 본인 medication_checks (이번 주 + 최근 3일) ── */
  useEffect(() => {
    if (!user) return;
    const fromDate = fmtKey(weekDates[0]);
    const toDate = fmtKey(weekDates[6]);
    (async () => {
      const { data, error } = await supabase
        .from("medication_checks")
        .select("supplement_name, dose_index, check_date, is_checked")
        .eq("patient_id", user.id)
        .gte("check_date", fromDate)
        .lte("check_date", toDate);
      if (error) {
        console.error("[mypage] medication_checks load failed:", error);
        return;
      }
      const rows = (data ?? []) as unknown as Pick<
        MedicationCheckRow,
        "supplement_name" | "dose_index" | "check_date" | "is_checked"
      >[];
      const nameToSupp = new Map(supplements.map((s) => [s.name, s] as const));

      setChecksByDate((prev) => {
        const next: Record<string, Record<string, boolean[]>> = { ...prev };
        for (const row of rows) {
          const supp = nameToSupp.get(row.supplement_name);
          if (!supp) continue;
          // dose_index 는 1-based. 0-based 배열 인덱스로 변환.
          // 과거 row 의 dose_index 가 supp.daily_count 보다 크면 화면에 안 그려짐(데이터 손실 아님, 표시 생략).
          const idx = row.dose_index - 1;
          if (idx < 0 || idx >= supp.daily_count) continue;
          const dateMap = { ...(next[row.check_date] ?? {}) };
          const arr = [...(dateMap[supp.id] ?? new Array(supp.daily_count).fill(false))];
          arr[idx] = !!row.is_checked;
          dateMap[supp.id] = arr;
          next[row.check_date] = dateMap;
        }
        return next;
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supplements.length]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTimes, setNewTimes] = useState<Set<TimeSlot>>(new Set());
  /** addSupplement 모달의 복용 시작일 (기본 오늘 YYYY-MM-DD) */
  const [addStartDate, setAddStartDate] = useState<string>(() => getTodayLocalISO());
  /** addSupplement 모달의 복용 일수 (선택). 빈 문자열이면 null 저장. */
  const [addDays, setAddDays] = useState<string>("");
  /** addSupplement 모달 안 일수 계산기 펼침 여부. */
  const [addCalcOpen, setAddCalcOpen] = useState<boolean>(false);
  /** updateSupplement 모달 안 일수 계산기 펼침 여부. */
  const [editCalcOpen, setEditCalcOpen] = useState<boolean>(false);
  /** 편집 모달 상태. editingId 가 null 이 아니면 열림. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSuppName, setEditSuppName] = useState<string>("");
  const [editTimes, setEditTimes] = useState<Set<TimeSlot>>(new Set());
  const [editStartDate, setEditStartDate] = useState<string>("");
  /** 일수 입력 — number input 이지만 빈 문자열도 허용(미지정 → null 로 저장). */
  const [editDays, setEditDays] = useState<string>("");
  /** "이대로 추가하기" 시작일 확인 미니 모달 상태. null 이면 닫힘. */
  const [guideStartModal, setGuideStartModal] = useState<{ guide: DosageGuide; date: string } | null>(null);
  const [swipedId, setSwipedId] = useState<string | null>(null);

  /* ── 지난 상담 복용 상태 (DB: medication_status) ── */
  type DoseStatus = "taking" | "completed" | "stopped";
  const [doseStatus, setDoseStatus] = useState<Record<string, DoseStatus>>({});
  const [doseLoaded, setDoseLoaded] = useState(false);
  const [statusModalId, setStatusModalId] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<DoseStatus>("completed");
  const [statusSaving, setStatusSaving] = useState(false);
  const getDoseStatus = (id: string): DoseStatus => doseStatus[id] ?? "completed";
  const openStatusModal = (id: string) => {
    setStatusDraft(getDoseStatus(id));
    setStatusModalId(id);
  };

  // DB 로드: 사용자별 medication_status 모두 조회 → doseStatus 맵으로 변환
  useEffect(() => {
    if (!user) {
      setDoseLoaded(true);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("medication_status")
        .select("consultation_key, status")
        .eq("patient_id", user.id);
      if (error) {
        console.error("[mypage] medication_status load failed:", error);
        setDoseLoaded(true);
        return;
      }
      const rows = (data ?? []) as unknown as Pick<MedicationStatusRow, "consultation_key" | "status">[];
      const map: Record<string, DoseStatus> = {};
      for (const r of rows) {
        map[r.consultation_key] = r.status;
      }
      setDoseStatus(map);
      setDoseLoaded(true);
    })();
  }, [user]);

  const saveStatus = async () => {
    if (!statusModalId || statusSaving) return;
    const targetId = statusModalId;
    const nextStatus = statusDraft;

    // 1) 즉시 UI 반영
    setDoseStatus((prev) => ({ ...prev, [targetId]: nextStatus }));
    setStatusModalId(null);

    // 2) DB upsert (로그인 사용자만)
    if (!user) return;
    setStatusSaving(true);
    const payload: MedicationStatusInsert = {
      patient_id: user.id,
      consultation_key: targetId,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };
    const { error } = await (supabase
      .from("medication_status") as unknown as {
        upsert: (
          p: MedicationStatusInsert,
          opts?: { onConflict?: string },
        ) => Promise<{ error: Error | null }>;
      })
      .upsert(payload, { onConflict: "patient_id,consultation_key" });
    setStatusSaving(false);
    if (error) {
      console.error("[mypage] medication_status save failed:", error);
    }
  };

  /* ── 복용 가이드 아코디언 (각각 독립 펼침/접힘) ── */
  const [expandedGuides, setExpandedGuides] = useState<Set<number>>(new Set([0]));
  const toggleGuide = (idx: number) => {
    setExpandedGuides((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  /* ── 설정 (알림 세분화) ── */
  const [notiChat, setNotiChat] = useState(true);
  const [notiMed, setNotiMed] = useState(true);
  const [notiHealth, setNotiHealth] = useState(true);
  const [notiVisit, setNotiVisit] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  /* ── 웹 푸시 구독 상태 (I-4 A 단계) ──
   *  pushStatus: unsupported(브라우저 미지원) / loading / unsubscribed / subscribed / denied / error
   *  pushBusy: enablePush 진행 중 — 버튼 disable 용 */
  type PushStatus = "unsupported" | "loading" | "unsubscribed" | "subscribed" | "denied" | "error";
  const [pushStatus, setPushStatus] = useState<PushStatus>("loading");
  const [pushBusy, setPushBusy] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) {
      setPushStatus("unsupported");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (Notification.permission === "denied") {
          if (!cancelled) setPushStatus("denied");
          return;
        }
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (cancelled) return;
        setPushStatus(sub ? "subscribed" : "unsubscribed");
      } catch (err) {
        console.error("[push] initial state check failed:", err);
        if (!cancelled) setPushStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const enablePush = useCallback(async () => {
    if (pushBusy) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) {
      setPushStatus("unsupported");
      return;
    }
    if (!user) {
      showMypageToast("로그인 후 이용해 주세요.");
      return;
    }
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.error("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY missing");
      setPushStatus("error");
      return;
    }
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPushStatus(perm === "denied" ? "denied" : "unsubscribed");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // TS lib 의 BufferSource 가 SharedArrayBuffer 분기를 좁게 정의해 Uint8Array<ArrayBufferLike> 와 불일치 — 안전 캐스팅.
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
      });
      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      const endpoint = json.endpoint ?? "";
      const p256dh = json.keys?.p256dh ?? "";
      const auth = json.keys?.auth ?? "";
      if (!endpoint || !p256dh || !auth) {
        console.error("[push] subscription missing fields", json);
        setPushStatus("error");
        return;
      }
      type PushSubInsert = {
        user_id: string;
        endpoint: string;
        p256dh: string;
        auth: string;
        user_agent: string | null;
      };
      const payload: PushSubInsert = {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      };
      const { error } = await (supabase
        .from("push_subscriptions") as unknown as {
          upsert: (
            p: PushSubInsert,
            opts?: { onConflict?: string },
          ) => Promise<{ error: { message: string; code?: string } | null }>;
        })
        .upsert(payload, { onConflict: "endpoint" });
      if (error) {
        console.error("[push] push_subscriptions upsert failed:", error);
        showMypageToast("알림 구독 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
        setPushStatus("error");
        return;
      }
      setPushStatus("subscribed");
      showMypageToast("브라우저 알림 구독이 등록되었어요");
    } catch (err) {
      console.error("[push] enablePush failed:", err);
      setPushStatus("error");
    } finally {
      setPushBusy(false);
    }
  }, [pushBusy, user, showMypageToast]);

  /* ── 알림 설정 영속화 (사이클 5) ──
   *  profiles.ui_preferences 에서 noti_chat / noti_med / noti_health / noti_visit 로드.
   *  키 없으면 위 useState 기본값 유지. 비로그인이면 SELECT 건너뜀.
   *  참조 패턴: ChatListClient.tsx L429-451 (hide_rejected_chats 로드). */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("ui_preferences")
        .eq("id", user.id)
        .maybeSingle<{
          ui_preferences: {
            noti_chat?: boolean;
            noti_med?: boolean;
            noti_health?: boolean;
            noti_visit?: boolean;
          } | null;
        }>();
      if (cancelled) return;
      if (error) {
        console.error("[mypage] ui_preferences fetch failed:", error);
        return;
      }
      const pref = data?.ui_preferences ?? null;
      if (pref?.noti_chat !== undefined) setNotiChat(pref.noti_chat === true);
      if (pref?.noti_med !== undefined) setNotiMed(pref.noti_med === true);
      if (pref?.noti_health !== undefined) setNotiHealth(pref.noti_health === true);
      if (pref?.noti_visit !== undefined) setNotiVisit(pref.noti_visit === true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  /* 알림 토글 공통 저장 헬퍼 — ChatListClient.tsx L453-482 (toggleHideRejected) 패턴 동일.
   *  SELECT 로 기존 ui_preferences 재조회 → 머지(다른 키 절대 덮어쓰기 금지) → UPDATE.
   *  실패 시 onError() 로 옵티미스틱 setState 롤백. 비로그인이면 무동작. */
  const updateNotiPref = async (
    key: "noti_chat" | "noti_med" | "noti_health" | "noti_visit",
    next: boolean,
    onError: () => void,
  ) => {
    if (!user) return;
    const { data: cur, error: getErr } = await supabase
      .from("profiles")
      .select("ui_preferences")
      .eq("id", user.id)
      .maybeSingle<{ ui_preferences: Record<string, unknown> | null }>();
    if (getErr) {
      console.error("[mypage] ui_preferences fetch (toggle) failed:", getErr);
      onError();
      return;
    }
    const merged = { ...(cur?.ui_preferences ?? {}), [key]: next };
    const { error: upErr } = await (supabase
      .from("profiles") as unknown as {
        update: (p: { ui_preferences: Record<string, unknown> }) => {
          eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
        };
      })
      .update({ ui_preferences: merged })
      .eq("id", user.id);
    if (upErr) {
      console.error("[mypage] ui_preferences UPDATE failed:", upErr);
      onError();
    }
  };

  /* 모달 backdrop 드래그-닫기 가드 ref — mousedown 시작 지점이 overlay 본체일 때만 닫기.
   *  3개 모달(추가/편집/미니)이 동시에 열리지 않으므로 ref 1개 공유. */
  const overlayDownRef = useRef(false);

  /* 추가 모달 닫힘 일괄 리셋 헬퍼 — 취소·backdrop·등록 성공 모든 경로에서 동일 사용. */
  const closeAddModal = useCallback(() => {
    setShowAddModal(false);
    setNewName("");
    setNewTimes(new Set());
    setAddStartDate(getTodayLocalISO());
    setAddDays("");
    setAddCalcOpen(false);
  }, []);

  /* I-4 임박 알람용 파생 데이터.
   *  nearMeds: 복용 종료가 D-MED_NEAR_THRESHOLD 이하로 남은 영양제. 시작 전(remain < 0) 제외.
   *  visitDaysLeft: 가장 가까운 다가오는 방문까지의 일수. upcomingVisits 비면 null. */
  const nearMeds = useMemo(() => {
    return supplements
      .map((s) => ({ s, remain: calcRemainingDays(s.start_date, s.days) }))
      .filter((x): x is { s: Supplement; remain: number } =>
        x.remain != null && x.remain >= 0 && x.remain <= MED_NEAR_THRESHOLD,
      )
      .sort((a, b) => a.remain - b.remain);
  }, [supplements]);
  const nextUpcomingVisit = upcomingVisits[0] ?? null;
  const visitDaysLeft = useMemo(
    () => (nextUpcomingVisit ? daysFromTodayLocal(nextUpcomingVisit.scheduled_date) : null),
    [nextUpcomingVisit],
  );

  const age = calcAge(editMode ? editBirth : profile.birth);

  /* 영양제 체크 토글 (날짜별) — 즉시 UI 반영 + DB upsert */
  /** doseIndex 는 0-based 하트 인덱스. DB 의 dose_index = doseIndex + 1 (1-based). */
  const toggleCheck = (id: string, doseIndex: number) => {
    const supp = supplements.find((s) => s.id === id);
    if (!supp) return;
    if (doseIndex < 0 || doseIndex >= supp.daily_count) return;
    // 시작일 전 영양제는 체크 불가 — 하트 disabled 의 안전망
    if (supp.start_date && supp.start_date > dateKey) return;
    // 라벨이 있으면 time_slot 에 보조 저장, 없으면 null. dose_index 가 unique key 라 라벨 없어도 OK.
    const slot = supp.time_slots[doseIndex] ?? null;
    const prevArr = checksByDate[dateKey]?.[id] ?? new Array(supp.daily_count).fill(false);
    const nextChecked = !prevArr[doseIndex];

    // 1) 즉시 UI 반영
    setChecksByDate((prev) => {
      const dayChecks = { ...(prev[dateKey] || {}) };
      const arr = [...(dayChecks[id] ?? new Array(supp.daily_count).fill(false))];
      arr[doseIndex] = nextChecked;
      dayChecks[id] = arr;
      return { ...prev, [dateKey]: dayChecks };
    });

    // 2) DB upsert (로그인 사용자만)
    if (!user) return;
    const payload: MedicationCheckInsert = {
      patient_id: user.id,
      dosage_guide_id: null,
      supplement_name: supp.name,
      dose_index: doseIndex + 1,
      time_slot: slot,
      check_date: dateKey,
      is_checked: nextChecked,
      updated_at: new Date().toISOString(),
    };
    (async () => {
      const { error } = await (supabase
        .from("medication_checks") as unknown as {
          upsert: (
            p: MedicationCheckInsert,
            opts?: { onConflict?: string },
          ) => Promise<{ error: Error | null }>;
        })
        .upsert(payload, {
          onConflict: "patient_id,supplement_name,check_date,dose_index",
        });
      if (error) {
        console.error("[mypage] medication_checks upsert failed:", error);
        // 실패 시 롤백
        setChecksByDate((prev) => {
          const dayChecks = { ...(prev[dateKey] || {}) };
          const arr = [...(dayChecks[id] ?? new Array(supp.daily_count).fill(false))];
          arr[doseIndex] = !nextChecked;
          dayChecks[id] = arr;
          return { ...prev, [dateKey]: dayChecks };
        });
      }
    })();
  };

  /* 영양제 삭제 — 옵티미스틱 + 롤백 */
  const deleteSupplement = async (id: string) => {
    setSwipedId(null);
    const target = supplements.find((s) => s.id === id);
    if (!target) return;
    const prevList = supplements;
    setSupplements((prev) => prev.filter((s) => s.id !== id));
    if (!user) return; // 비로그인 — 로컬만
    const { error } = await supabase
      .from("patient_supplements")
      .delete()
      .eq("id", id);
    if (error) {
      console.error("[mypage] patient_supplements delete failed:", error);
      setSupplements(prevList);
      showMypageToast("영양제 삭제에 실패했어요. 잠시 후 다시 시도해 주세요.");
    }
  };

  /** 복용 가이드의 모든 영양제를 한 번에 patient_supplements 에 등록.
   *  source='dosage_guide' + source_dosage_guide_id 로 중복 방지 표식.
   *  time_slots 가 빈 가이드 항목은 건너뜀(체크할 슬롯이 없으면 의미 없음).
   *  startDate: 시작일 확인 모달에서 받은 YYYY-MM-DD. */
  const addFromDosageGuide = async (guide: DosageGuide, startDate: string) => {
    if (!user) {
      showMypageToast("로그인 후 이용해 주세요.");
      return;
    }
    if (addingFromGuideId) return;
    const filtered = guide.supplements
      .filter((s) => s.name.trim())
      .map((s) => {
        const slots = s.time_slots.filter((slot): slot is TimeSlot => isValidTimeSlot(slot));
        return { name: s.name.trim(), time_slots: slots, daily_count: s.daily_count, days: s.days };
      })
      // 슬롯도 0이고 daily_count 도 없으면 의미 없으니 스킵, 둘 중 하나라도 있으면 통과
      .filter((s) => s.time_slots.length > 0 || (s.daily_count != null && s.daily_count > 0));
    if (filtered.length === 0) {
      showMypageToast("추가할 수 있는 영양제가 없어요.");
      return;
    }
    const rows: PatientSupplementInsert[] = filtered.map((s) => ({
      patient_id: user.id,
      name: s.name,
      time_slots: s.time_slots,
      // ChartClient 폴백 패턴: 직접값 > 슬롯수 > 1
      daily_count: (s.daily_count && s.daily_count > 0)
        ? s.daily_count
        : (s.time_slots.length > 0 ? s.time_slots.length : 1),
      source: "dosage_guide",
      source_dosage_guide_id: guide.id,
      start_date: startDate,
      days: (typeof s.days === "number" && s.days > 0) ? s.days : null,
    }));
    setAddingFromGuideId(guide.id);
    const { data, error } = await (supabase
      .from("patient_supplements") as unknown as {
        insert: (p: PatientSupplementInsert[]) => {
          select: (cols: string) => Promise<{
            data: PatientSupplementRow[] | null;
            error: { message: string; code?: string } | null;
          }>;
        };
      })
      .insert(rows)
      .select("id, patient_id, name, time_slots, daily_count, source, source_dosage_guide_id, start_date, days, created_at, updated_at");
    setAddingFromGuideId(null);
    if (error || !data) {
      console.error("[mypage] addFromDosageGuide insert failed:", error);
      showMypageToast("영양제 등록에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    const mapped = data.map(mapPatientSupplementRow);
    setSupplements((prev) => [...prev, ...mapped]);
    setGuideStartModal(null);
    showMypageToast(`영양제 ${mapped.length}개를 추가했어요`);
  };

  /* 영양제 추가 — patient_supplements INSERT 후 setState */
  const addSupplement = async () => {
    const trimmedName = newName.trim();
    if (!trimmedName || newTimes.size === 0) return;
    if (!user) {
      showMypageToast("로그인 후 이용해 주세요.");
      return;
    }
    const slots = sortSlots(Array.from(newTimes));
    // 슬롯 1개 이상이면 그 개수, 0개면 1. 환자 직접 등록은 슬롯을 1개 이상 강제하지만 안전한 폴백.
    const dailyCount = slots.length > 0 ? slots.length : 1;
    // days: 빈 문자열이면 null, 양수 정수만 저장 (updateSupplement 패턴 동일)
    let addDaysVal: number | null = null;
    const trimmedAddDays = addDays.trim();
    if (trimmedAddDays) {
      const parsed = parseInt(trimmedAddDays, 10);
      addDaysVal = (!Number.isNaN(parsed) && parsed > 0) ? parsed : null;
    }
    const payload: PatientSupplementInsert = {
      patient_id: user.id,
      name: trimmedName,
      time_slots: slots,
      daily_count: dailyCount,
      source: "manual",
      source_dosage_guide_id: null,
      start_date: addStartDate,
      days: addDaysVal,
    };
    const { data, error } = await (supabase
      .from("patient_supplements") as unknown as {
        insert: (p: PatientSupplementInsert) => {
          select: (cols: string) => {
            single: () => Promise<{
              data: PatientSupplementRow | null;
              error: { message: string; code?: string } | null;
            }>;
          };
        };
      })
      .insert(payload)
      .select("id, patient_id, name, time_slots, daily_count, source, source_dosage_guide_id, start_date, days, created_at, updated_at")
      .single();
    if (error || !data) {
      console.error("[mypage] patient_supplements insert failed:", error);
      showMypageToast("영양제 등록에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setSupplements((prev) => [...prev, mapPatientSupplementRow(data)]);
    closeAddModal();
  };

  /** 영양제 편집 모달 열기 — 현재 값 prefill, swipe 닫기. */
  const openEditSupplement = (s: Supplement) => {
    setEditingId(s.id);
    setEditSuppName(s.name);
    setEditTimes(new Set(s.time_slots));
    setEditStartDate(s.start_date ?? getTodayLocalISO());
    setEditDays(s.days != null ? String(s.days) : "");
    setEditCalcOpen(false);
    setSwipedId(null);
  };

  /* 영양제 수정 — patient_supplements UPDATE (행만; 약사 원본 가이드 미수정) */
  const updateSupplement = async () => {
    if (!editingId) return;
    const trimmedName = editSuppName.trim();
    if (!trimmedName) return;
    if (!user) {
      showMypageToast("로그인 후 이용해 주세요.");
      return;
    }
    const slots = sortSlots(Array.from(editTimes));
    const dailyCount = slots.length > 0 ? slots.length : 1;
    let daysVal: number | null = null;
    const trimmedDays = editDays.trim();
    if (trimmedDays) {
      const parsed = parseInt(trimmedDays, 10);
      daysVal = (!Number.isNaN(parsed) && parsed > 0) ? parsed : null;
    }
    const patch: PatientSupplementUpdate = {
      name: trimmedName,
      time_slots: slots,
      daily_count: dailyCount,
      start_date: editStartDate || null,
      days: daysVal,
    };
    const { data, error } = await (supabase
      .from("patient_supplements") as unknown as {
        update: (p: PatientSupplementUpdate) => {
          eq: (col: string, val: string) => {
            select: (cols: string) => {
              single: () => Promise<{
                data: PatientSupplementRow | null;
                error: { message: string; code?: string } | null;
              }>;
            };
          };
        };
      })
      .update(patch)
      .eq("id", editingId)
      .select("id, patient_id, name, time_slots, daily_count, source, source_dosage_guide_id, start_date, days, created_at, updated_at")
      .single();
    if (error || !data) {
      console.error("[mypage] patient_supplements update failed:", error);
      showMypageToast("영양제 수정에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    const updatedRow = data;
    setSupplements((prev) => prev.map((x) => x.id === editingId ? mapPatientSupplementRow(updatedRow) : x));
    setEditingId(null);
  };

  /* 프로필 저장 — supabase.profiles UPDATE */
  const saveProfile = useCallback(async () => {
    if (!user) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setProfileError("이름을 입력해주세요.");
      return;
    }
    setSavingProfile(true);
    setProfileError(null);

    const update: ProfileUpdate = { name: trimmed };
    const { error } = await (supabase
      .from("profiles") as unknown as {
        update: (p: ProfileUpdate) => {
          eq: (col: string, val: string) => Promise<{ error: Error | null }>;
        };
      })
      .update(update)
      .eq("id", user.id);

    if (error) {
      setProfileError("이름을 저장하지 못했어요.");
      setSavingProfile(false);
      return;
    }

    setProfile((prev) => ({ ...prev, name: trimmed, birth: editBirth }));
    setEditMode(false);
    setSavingProfile(false);
  }, [user, editName, editBirth]);

  const checkedCount = supplements.reduce((acc, s) => acc + getChecks(s.id, s.daily_count).filter(Boolean).length, 0);

  return (
    <div className="my-page">
      {/* 마이페이지 토스트 — 영양제/가이드 DB 동작 결과 알림 */}
      {mypageToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: 70,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 300,
            fontSize: 14,
            color: "#2C3630",
            background: "#EDF4F0",
            border: "1px solid #B3CCBE",
            padding: "10px 16px",
            borderRadius: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            maxWidth: 360,
            fontFamily: "'Noto Sans KR', sans-serif",
          }}
        >
          {mypageToast}
        </div>
      )}

      {/* 네비게이션 */}
      <nav>
        <button className="nav-back" onClick={() => router.back()} aria-label="뒤로가기">
          ←
        </button>
        <div className="nav-title">내 정보</div>
        <div style={{ width: 32 }} />
      </nav>

      <div className="my-container">
        {/* ═══════ 1. 프로필 ═══════ */}
        <section className="my-profile-card">
          <div className="my-avatar-wrap">
            <div className="my-avatar">
              {profile.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={profile.avatarUrl}
                  alt={`${profile.name} 프로필 사진`}
                  style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" fill="var(--color-sage-light)" />
                  <path d="M4 20c0-3.31 3.58-6 8-6s8 2.69 8 6" fill="var(--color-sage-light)" />
                </svg>
              )}
            </div>
            {editMode && (
              <button className="my-avatar-edit" type="button">사진 변경</button>
            )}
          </div>

          {profileLoading ? (
            <div className="my-profile-info">
              <div style={{ fontSize: 14, color: "#3D4A42", padding: "8px 0" }}>
                불러오는 중...
              </div>
            </div>
          ) : !editMode ? (
            <div className="my-profile-info">
              <div className="my-profile-name">{profile.name}</div>
              {profile.birth && <div className="my-profile-meta">만 {age}세</div>}
              {profile.phone && <div className="my-profile-phone">{profile.phone}</div>}
              {profileError && (
                <div role="alert" style={{ fontSize: 14, color: "#993C1D", marginTop: 6 }}>
                  {profileError}
                </div>
              )}
              <button
                className="my-profile-edit-btn"
                onClick={() => {
                  setEditName(profile.name);
                  setEditBirth(profile.birth);
                  setProfileError(null);
                  setEditMode(true);
                }}
                type="button"
              >
                프로필 수정
              </button>
            </div>
          ) : (
            <div className="my-profile-edit-form">
              <label className="my-edit-label">
                이름
                <input
                  type="text"
                  className="my-edit-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={savingProfile}
                />
              </label>
              <label className="my-edit-label">
                생년월일
                <input
                  type="date"
                  className="my-edit-input"
                  value={editBirth}
                  onChange={(e) => setEditBirth(e.target.value)}
                  disabled={savingProfile}
                />
              </label>
              <div className="my-edit-phone-notice">
                휴대폰 번호 변경은 재인증이 필요합니다
              </div>
              {profileError && (
                <div role="alert" style={{ fontSize: 14, color: "#993C1D", marginTop: 4 }}>
                  {profileError}
                </div>
              )}
              <div className="my-edit-actions">
                <button
                  className="my-btn secondary"
                  onClick={() => {
                    setEditMode(false);
                    setProfileError(null);
                  }}
                  type="button"
                  disabled={savingProfile}
                >
                  취소
                </button>
                <button
                  className="my-btn primary"
                  onClick={saveProfile}
                  type="button"
                  disabled={savingProfile || !editName.trim()}
                >
                  {savingProfile ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ═══════ 1-A. 임박 알람 (I-4) — 인앱 배너, 읽기 전용 ═══════ */}
        {(() => {
          const showVisitBanner =
            notiVisit && visitDaysLeft != null &&
            visitDaysLeft >= 0 && visitDaysLeft <= VISIT_NEAR_THRESHOLD;
          const showMedBanner = notiMed && nearMeds.length > 0;
          if (!showVisitBanner && !showMedBanner) return null;
          // 방문 배너용 라벨 — "M월 D일"
          const visitDateLabel = nextUpcomingVisit
            ? (() => {
                const m = nextUpcomingVisit.scheduled_date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (!m) return nextUpcomingVisit.scheduled_date;
                return `${Number(m[2])}월 ${Number(m[3])}일`;
              })()
            : "";
          return (
            <section className="my-section">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {showVisitBanner && visitDaysLeft != null && (
                  <div style={{
                    padding: "12px 14px", borderRadius: 12,
                    background: "#E8F0F5",
                    border: "1.5px solid #B3D1E0",
                    display: "flex", alignItems: "flex-start", gap: 10,
                  }}>
                    <span style={{ fontSize: 20, lineHeight: 1.2, flexShrink: 0 }}>📅</span>
                    <div style={{ fontSize: 14, color: "#3D4A42", lineHeight: 1.5, fontWeight: 600 }}>
                      {visitDaysLeft === 0
                        ? "오늘 약국 방문 예정이에요"
                        : `약국 방문 D-${visitDaysLeft} — ${visitDateLabel} 예정이에요`}
                    </div>
                  </div>
                )}
                {showMedBanner && (
                  <div style={{
                    padding: "12px 14px", borderRadius: 12,
                    background: "#FBF5F1",
                    border: "1.5px solid #F5E6DC",
                    display: "flex", alignItems: "flex-start", gap: 10,
                  }}>
                    <span style={{ fontSize: 20, lineHeight: 1.2, flexShrink: 0 }}>💊</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {nearMeds.length === 1 ? (
                        <div style={{ fontSize: 14, color: "#3D4A42", lineHeight: 1.5, fontWeight: 600 }}>
                          {nearMeds[0].s.name} 복용이 {nearMeds[0].remain === 0 ? "오늘까지예요" : `D-${nearMeds[0].remain} 남았어요`}
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: 14, color: "#3D4A42", lineHeight: 1.5, fontWeight: 700, marginBottom: 6 }}>
                            복용 종료가 임박한 영양제 {nearMeds.length}종이 있어요
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 2 }}>
                            {nearMeds.map(({ s, remain }) => (
                              <li key={s.id} style={{ fontSize: 14, color: "#3D4A42", lineHeight: 1.5 }}>
                                {s.name} — {remain === 0 ? "오늘까지" : `D-${remain}`}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })()}

        {/* ═══════ 1-1. 방문 일정 ═══════ */}
        {(upcomingVisits.length > 0 || pastVisits.length > 0) && (() => {
          const WEEKDAY_KR = ["일", "월", "화", "수", "목", "금", "토"] as const;
          // 로컬 날짜 파싱 — toISOString 금지(UTC 어긋남). YYYY-MM-DD 정규식만 사용.
          const parseLocalDate = (iso: string): Date | null => {
            const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!m) return null;
            const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
            return Number.isNaN(dt.getTime()) ? null : dt;
          };
          const fmtDateWithDow = (iso: string): string => {
            const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!m) return iso;
            const mo = Number(m[2]); const d = Number(m[3]);
            const dt = parseLocalDate(iso);
            const head = `${mo}월 ${d}일`;
            return dt ? `${head} (${WEEKDAY_KR[dt.getDay()]})` : head;
          };
          const visibleUpcoming = showAllUpcoming ? upcomingVisits : upcomingVisits.slice(0, 2);
          const hiddenUpcomingCount = Math.max(upcomingVisits.length - 2, 0);
          return (
            <section className="my-section">
              <h2 className="my-section-title">방문 일정</h2>

              {/* 다가오는 방문 */}
              {upcomingVisits.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {visibleUpcoming.map((v) => {
                    const dateLabel = fmtDateWithDow(v.scheduled_date);
                    const timeLabel = v.scheduled_time ?? "";
                    const headline = timeLabel ? `${dateLabel} ${timeLabel}` : dateLabel;
                    const placeParts: string[] = [];
                    if (v.pharmacy_name) placeParts.push(v.pharmacy_name);
                    if (v.pharmacist_name) placeParts.push(`${v.pharmacist_name} 약사`);
                    const placeLine = placeParts.join(" · ");
                    const hasFooter = !!(v.note || v.address);
                    return (
                      <div key={v.id} style={{
                        borderRadius: 14, overflow: "hidden",
                        border: "1.5px solid #B3D1E0", background: "#fff",
                      }}>
                        <div style={{
                          padding: "14px 16px", background: "#E8F0F5",
                          display: "flex", alignItems: "center", gap: 10,
                        }}>
                          <span style={{ fontSize: 22 }}>📅</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#2C3630" }}>{headline}</div>
                            {placeLine && (
                              <div style={{ fontSize: 14, color: "#3D4A42", marginTop: 2 }}>{placeLine}</div>
                            )}
                          </div>
                        </div>
                        {hasFooter && (
                          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                            {v.address && (
                              <div style={{ fontSize: 13, color: "#5E7D6C", lineHeight: 1.5 }}>
                                {v.address}
                              </div>
                            )}
                            {(v.address || (v.lat != null && v.lng != null)) && (
                              <button
                                type="button"
                                onClick={() => {
                                  // "약국명 + 도로명"이면 우리 약국이 정확히 1순위로 잡힌다. 번지·상세주소·구는 제외.
                                  // 도로명 = 한글/숫자로 끝나는 "OO로" 또는 "OO길" (대로/소로 모두 "로"에 포함, lookahead 로 뒤 한글 차단).
                                  const name = (v.pharmacy_name ?? "").trim();
                                  const addr = (v.address ?? "").trim();
                                  const roadMatch = addr.match(/[가-힣0-9]+(?:로|길)(?![가-힣])/);
                                  const road = roadMatch ? roadMatch[0] : "";
                                  const query = [name, road].filter(Boolean).join(" ");
                                  let url: string | null = null;
                                  if (query) {
                                    url = "https://map.kakao.com/?q=" + encodeURIComponent(query);
                                  } else {
                                    const lat = v.lat;
                                    const lng = v.lng;
                                    if (lat != null && lng != null) {
                                      url = "https://map.kakao.com/link/map/"
                                        + encodeURIComponent(name || "약국")
                                        + "," + lat + "," + lng;
                                    }
                                  }
                                  if (!url) return;
                                  window.open(url, "_blank");
                                }}
                                style={{
                                  alignSelf: "flex-start",
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  padding: "6px 12px", borderRadius: 8,
                                  background: "#fff",
                                  border: "1px solid #B3D1E0",
                                  color: "#5A8BA8",
                                  fontSize: 13, fontWeight: 600,
                                  cursor: "pointer",
                                  fontFamily: "'Noto Sans KR', sans-serif",
                                  minHeight: 36,
                                }}
                              >
                                📍 위치 보기
                              </button>
                            )}
                            {v.note && (
                              <div style={{ fontSize: 14, color: "#3D4A42", lineHeight: 1.5 }}>
                                메모: {v.note}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {hiddenUpcomingCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllUpcoming((v) => !v)}
                      style={{
                        alignSelf: "stretch",
                        padding: "10px 14px", borderRadius: 10,
                        background: "#F8F9F7",
                        border: "1.5px solid rgba(94, 125, 108, 0.14)",
                        color: "#4A6355",
                        fontSize: 14, fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "'Noto Sans KR', sans-serif",
                        minHeight: 44,
                      }}
                    >
                      {showAllUpcoming ? "접기" : `방문 예정 ${hiddenUpcomingCount}건 더 보기`}
                    </button>
                  )}
                </div>
              )}

              {/* 지난 방문 — 접이식 */}
              {pastVisits.length > 0 && (
                <div style={{ marginTop: upcomingVisits.length > 0 ? 16 : 0 }}>
                  <button
                    type="button"
                    onClick={() => setShowPast((v) => !v)}
                    style={{
                      width: "100%",
                      padding: "10px 14px", borderRadius: 10,
                      background: "#F8F9F7",
                      border: "1.5px solid rgba(94, 125, 108, 0.14)",
                      color: "#4A6355",
                      fontSize: 14, fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'Noto Sans KR', sans-serif",
                      minHeight: 44,
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    }}
                  >
                    <span>지난 방문 {pastVisits.length}건</span>
                    <span style={{ fontSize: 12, color: "#7FA48E" }}>{showPast ? "▲" : "▼"}</span>
                  </button>
                  {showPast && (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                      {pastVisits.map((v) => {
                        // 노쇼 = scheduled 인데 예정일이 지나서 past 로 분류된 row.
                        //   환자 부담 최소화 정책으로 배지/문구 없이 카드 자체만 흐리게 처리(ChatClient cancelled 카드 톤 참고).
                        const isNoShow = v.status !== "completed";
                        return (
                        <div key={v.id} style={{
                          padding: "10px 14px", borderRadius: 10,
                          border: "1px solid rgba(94, 125, 108, 0.14)",
                          background: "#fff",
                          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                          opacity: isNoShow ? 0.55 : 1,
                        }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#2C3630" }}>
                              {fmtDateWithDow(
                                v.status === "completed" && v.visited_date
                                  ? v.visited_date
                                  : v.scheduled_date,
                              )}
                            </div>
                            {v.pharmacy_name ? (
                              <div style={{ fontSize: 14, color: "#3D4A42", marginTop: 2 }}>{v.pharmacy_name}</div>
                            ) : v.pharmacist_name ? (
                              <div style={{ fontSize: 14, color: "#3D4A42", marginTop: 2 }}>{v.pharmacist_name} 약사</div>
                            ) : null}
                          </div>
                          {v.status === "completed" && (
                            <span style={{
                              fontSize: 12, fontWeight: 600,
                              color: "#4A6355",
                              background: "#EDF4F0",
                              padding: "4px 10px", borderRadius: 999,
                              flexShrink: 0,
                              whiteSpace: "nowrap",
                            }}>방문 완료</span>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })()}

        {/* ═══════ 2. 내 영양제 관리 ═══════ */}
        <section className="my-section">
          <h2 className="my-section-title">내 영양제 관리</h2>

          {supplementsLoaded && supplements.length === 0 ? (
            <div style={emptyBox}>
              <div style={emptyEmoji}>💊</div>
              <div style={emptyTitle}>아직 등록된 영양제가 없어요</div>
              <div style={emptyDesc}>영양제를 등록하면 복약 체크를 할 수 있어요</div>
              <button type="button" style={emptyBtn} onClick={() => { setAddStartDate(getTodayLocalISO()); setAddDays(""); setAddCalcOpen(false); setShowAddModal(true); }}>+ 영양제 추가</button>
            </div>
          ) : (
          <>
          {/* 날짜 네비게이션 */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 0", marginBottom: 8,
          }}>
            <button
              type="button"
              onClick={() => setDayOffset((v) => Math.min(v + 1, 2))}
              disabled={dayOffset >= 2}
              style={{
                width: 36, height: 36, borderRadius: "50%",
                border: "1.5px solid var(--border, rgba(94,125,108,0.14))",
                background: dayOffset >= 2 ? "#f5f5f5" : "#fff",
                color: dayOffset >= 2 ? "#ccc" : "var(--text-dark, #2C3630)",
                fontSize: 18, fontWeight: 700, cursor: dayOffset >= 2 ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              &lt;
            </button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-dark, #2C3630)" }}>
                {formatDate(selectedDate)}
                {dayOffset > 0 && (
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#3D4A42", marginLeft: 6 }}>
                    ({dayLabels[dayOffset]})
                  </span>
                )}
              </div>
              {dayOffset === 0 && (
                <div style={{ fontSize: 13, color: "var(--sage-mid, #5E7D6C)", fontWeight: 500, marginTop: 2 }}>
                  오늘도 건강을 챙겨볼까요?
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDayOffset((v) => Math.max(v - 1, 0))}
              disabled={dayOffset <= 0}
              style={{
                width: 36, height: 36, borderRadius: "50%",
                border: "1.5px solid var(--border, rgba(94,125,108,0.14))",
                background: dayOffset <= 0 ? "#f5f5f5" : "#fff",
                color: dayOffset <= 0 ? "#ccc" : "var(--text-dark, #2C3630)",
                fontSize: 18, fontWeight: 700, cursor: dayOffset <= 0 ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              &gt;
            </button>
          </div>

          <div className="my-supplement-list">
            {supplements.map((s) => {
              // 시작일 전 판정 — dateKey(선택 날짜) 와 start_date 문자열 사전식 비교
              const notStarted = !!s.start_date && s.start_date > dateKey;
              const isTodayView = dayOffset === 0;
              // 과거 날짜에서 아직 시작 전인 영양제는 카드 자체 숨김
              if (notStarted && !isTodayView) return null;
              const checks = getChecks(s.id, s.daily_count);

              // "곧 시작" 비활성 카드 — 오늘 화면에서 미래 시작 영양제
              if (notStarted && isTodayView) {
                let upcomingPharmacy: string | null = null;
                if (s.source === "dosage_guide" && s.source_dosage_guide_id) {
                  const g = dosageGuides.find((x) => x.id === s.source_dosage_guide_id);
                  upcomingPharmacy = g?.pharmacy_name ?? null;
                }
                const upcomingStartLabel = formatStartLabel(s.start_date);
                return (
                  <div
                    key={s.id}
                    className={`my-supplement-card${swipedId === s.id ? " swiped" : ""}`}
                  >
                    <div
                      className="my-supplement-content"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSwipedId(swipedId === s.id ? null : s.id);
                      }}
                      style={{ display: "flex", flexDirection: "column", gap: 0, alignItems: "stretch", textAlign: "left", transform: swipedId === s.id ? "translateX(-140px)" : undefined }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0, flex: 1 }}>
                          <span className="my-supplement-name">{s.name}</span>
                          {upcomingPharmacy && (
                            <span style={{
                              fontSize: 13,
                              fontWeight: 400,
                              color: "#5E7D6C",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}>{upcomingPharmacy}</span>
                          )}
                        </div>
                        <div style={{
                          display: "flex", gap: 10, alignItems: "center", flexShrink: 0,
                          opacity: 0.35, pointerEvents: "none",
                        }}>
                          {Array.from({ length: s.daily_count }).map((_, ti) => {
                            const label = s.time_slots[ti] ?? `${ti + 1}회`;
                            return (
                              <button
                                key={ti}
                                type="button"
                                disabled
                                aria-label={`${s.name} ${label} 시작 전`}
                                style={{
                                  display: "flex", alignItems: "center", gap: 4,
                                  background: "none", border: "none", cursor: "default", padding: 0,
                                }}
                              >
                                <HeartIcon filled={false} size={20} />
                                <span style={{ fontSize: 13, fontWeight: 500, color: "#3D4A42" }}>{label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {upcomingStartLabel && (
                        <span style={{
                          display: "block",
                          marginTop: 2,
                          fontSize: 13,
                          fontWeight: 500,
                          color: "#5E7D6C",
                          textAlign: "left",
                        }}>
                          곧 시작 · {upcomingStartLabel}부터
                        </span>
                      )}
                    </div>
                    {/* 스와이프 액션 */}
                    <div className="my-supplement-actions">
                      <button
                        className="my-swipe-btn"
                        style={{ background: "#5E7D6C", color: "#fff" }}
                        onClick={() => openEditSupplement(s)}
                        type="button"
                      >
                        수정
                      </button>
                      <button
                        className="my-swipe-btn delete"
                        onClick={() => deleteSupplement(s.id)}
                        type="button"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={s.id}
                  className={`my-supplement-card${swipedId === s.id ? " swiped" : ""}`}
                >
                  <div
                    className="my-supplement-content"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSwipedId(swipedId === s.id ? null : s.id);
                    }}
                    style={{ display: "flex", flexDirection: "column", gap: 0, alignItems: "stretch", textAlign: "left", transform: swipedId === s.id ? "translateX(-140px)" : undefined }}
                  >
                    {(() => {
                      const remain = calcRemainingDays(s.start_date, s.days);
                      let remainText: string | null = null;
                      let remainEnded = false;
                      if (remain != null) {
                        if (remain > 0) remainText = `${remain}일분 남음`;
                        else if (remain === 0) remainText = "오늘까지";
                        else { remainText = "복용 기간 종료"; remainEnded = true; }
                      }
                      // 약국명: dosage_guide 출처일 때만 매칭 (전체 dosageGuides 에서 find — 비활성 가이드도 잡힘). manual 은 null.
                      let pharmacyName: string | null = null;
                      if (s.source === "dosage_guide" && s.source_dosage_guide_id) {
                        const g = dosageGuides.find((x) => x.id === s.source_dosage_guide_id);
                        pharmacyName = g?.pharmacy_name ?? null;
                      }
                      const startLabel = formatStartLabel(s.start_date);
                      return (
                        <>
                          {/* 상단행: 이름 + 약국명 / 하트 */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0, flex: 1 }}>
                              <span className="my-supplement-name">{s.name}</span>
                              {pharmacyName && (
                                <span style={{
                                  fontSize: 13,
                                  fontWeight: 400,
                                  color: "#5E7D6C",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}>{pharmacyName}</span>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                              {Array.from({ length: s.daily_count }).map((_, ti) => {
                                const isChecked = checks[ti] ?? false;
                                // 슬롯이 있으면 그 라벨, 없으면 "N회"(1-based)
                                const label = s.time_slots[ti] ?? `${ti + 1}회`;
                                return (
                                  <button
                                    key={ti}
                                    type="button"
                                    onClick={() => toggleCheck(s.id, ti)}
                                    aria-label={`${s.name} ${label} ${isChecked ? "복용 완료" : "복용 체크"}`}
                                    style={{
                                      display: "flex", alignItems: "center", gap: 4,
                                      background: "none", border: "none", cursor: "pointer", padding: 0,
                                    }}
                                  >
                                    <HeartIcon filled={isChecked} size={20} />
                                    <span style={{ fontSize: 13, fontWeight: 500, color: isChecked ? "#4A6355" : "#3D4A42" }}>{label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          {/* 하단 보조줄: 전체폭 — 하트 폭에 안 눌림 */}
                          {(remainText || startLabel) && (
                            <span style={{
                              display: "block",
                              marginTop: 2,
                              lineHeight: 1.4,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              textAlign: "left",
                            }}>
                              {remainText && (
                                <span style={{
                                  fontSize: 14,
                                  fontWeight: 700,
                                  color: remainEnded ? "#3D4A42" : "#4A6355",
                                }}>{remainText}</span>
                              )}
                              {remainText && startLabel && (
                                <span style={{ fontSize: 13, fontWeight: 400, color: "#5E7D6C" }}>{" · "}</span>
                              )}
                              {startLabel && (
                                <span style={{ fontSize: 13, fontWeight: 400, color: "#5E7D6C" }}>{startLabel} 시작</span>
                              )}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  {/* 스와이프 액션 */}
                  <div className="my-supplement-actions">
                    <button
                      className="my-swipe-btn"
                      style={{ background: "#5E7D6C", color: "#fff" }}
                      onClick={() => openEditSupplement(s)}
                      type="button"
                    >
                      수정
                    </button>
                    <button
                      className="my-swipe-btn delete"
                      onClick={() => deleteSupplement(s.id)}
                      type="button"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 복약 달력 — 실제 today 기준 월~일 + DB 체크 기반 하트 */}
          <div className="my-week-calendar">
            <div className="my-week-label">이번 주 복약</div>
            <div className="my-week-row">
              {weekDates.map((d, i) => {
                const dayKey = fmtKey(d);
                const isToday = dayKey === todayKey;
                // 해당 날짜에 모든 영양제·시간슬롯의 체크 비율 계산
                // 단, 그 요일에 아직 시작 전인 영양제는 분모에서 제외 (start_date > dayKey)
                const allFlags = supplements.flatMap((s) => {
                  if (s.start_date && s.start_date > dayKey) return [];
                  const arr = checksByDate[dayKey]?.[s.id]
                    ?? new Array(s.daily_count).fill(false);
                  return arr;
                });
                const total = allFlags.length;
                const checked = allFlags.filter(Boolean).length;
                let status: HeartStatus;
                if (total === 0) status = "empty";
                else if (checked === total) status = "full";
                else if (checked > 0) status = "half";
                else status = "empty";

                return (
                  <div
                    key={dayKey}
                    className={`my-week-cell${isToday ? " today" : ""}`}
                  >
                    <span className="my-week-day">{WEEK_DAYS[i]}</span>
                    <span className="my-week-heart">
                      {status === "full" && <HeartIcon filled size={16} />}
                      {status === "half" && <HalfHeartIcon size={16} />}
                      {status === "empty" && <HeartIcon filled={false} size={16} />}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            className="my-add-supplement-btn"
            onClick={() => { setAddStartDate(getTodayLocalISO()); setAddDays(""); setAddCalcOpen(false); setShowAddModal(true); }}
            type="button"
          >
            + 영양제 추가
          </button>
          </>
          )}
        </section>

        {/* ═══════ 2-1. 내 복용 가이드 ═══════ */}
        <section className="my-section">
          <h2 className="my-section-title">내 복용 가이드</h2>

          {(() => {
            // active 가이드만 카드 목록에 노출. 비활성(completed/stopped) 은 영양제 출처 매칭용으로만 사용.
            const activeGuides = dosageGuides.filter((g) => g.dosage_status === "active");
            if (dosageGuidesLoaded && activeGuides.length === 0) {
              return (
                <div style={{
                  padding: "16px 18px", borderRadius: 12,
                  background: "#F8F9F7", border: "1px solid rgba(94,125,108,0.14)",
                  fontSize: 14, color: "#3D4A42", lineHeight: 1.5,
                }}>
                  아직 받은 복용 가이드가 없어요. 약사님 상담 후 가이드가 이곳에 표시돼요.
                </div>
              );
            }
            return activeGuides.map((guide, gi) => {
              const isGuideOpen = expandedGuides.has(gi);
              const sentDate = (() => {
                const iso = guide.sent_at || guide.created_at;
                if (!iso) return "";
                const d = new Date(iso);
                return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
              })();
              const alreadyAdded = supplements.some(
                (s) => s.source_dosage_guide_id === guide.id,
              );
              const isAdding = addingFromGuideId === guide.id;
              return (
                <div
                  key={guide.id}
                  style={{
                    borderRadius: 14,
                    border: gi === 0 ? "1.5px solid #F0D9CC" : "1px solid rgba(94,125,108,0.14)",
                    marginBottom: 12,
                    overflow: "hidden",
                    fontStyle: "normal",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleGuide(gi)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      width: "100%", padding: 16,
                      background: gi === 0 ? "#FDF5F2" : "#F4F6F3",
                      border: "none",
                      cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "var(--sage-pale, #EDF4F0)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="8" r="4" fill="var(--sage-mid, #5E7D6C)" />
                          <path d="M4 20c0-3.31 3.58-6 8-6s8 2.69 8 6" fill="var(--sage-mid, #5E7D6C)" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#2C3630" }}>
                          {guide.pharmacist_name ? `${guide.pharmacist_name} 약사님 복용 가이드` : "약사님 복용 가이드"}
                        </div>
                        <div style={{ fontSize: 14, color: "#3D4A42" }}>
                          {sentDate}
                          {guide.dosage_days ? ` · ${guide.dosage_days}일치` : ""}
                          {guide.pharmacy_name ? ` · ${guide.pharmacy_name}` : ""}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {!isGuideOpen && (
                        <span style={{ fontSize: 14, color: "#3D4A42", fontWeight: 500 }}>{guide.supplements.length}개 영양제</span>
                      )}
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5E7D6C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{ transition: "transform 0.2s", transform: isGuideOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </button>

                  {isGuideOpen && (
                    <div style={{ padding: "12px 16px 16px", background: "#fff", borderTop: "1px solid rgba(94,125,108,0.12)" }}>
                      {guide.supplements.map((item, ii) => {
                        const isCompound = item.dispense_type === "compounded";
                        // 하루 횟수 폴백: 직접값 > 슬롯수 > 1 (ChartClient 동일 패턴)
                        const dc = item.daily_count && item.daily_count > 0
                          ? item.daily_count
                          : (item.time_slots.length > 0 ? item.time_slots.length : 1);
                        // "기타" 슬롯에 etc_note 괄호 병기
                        const slotsDisplay = item.time_slots.map((slot) =>
                          slot === "기타" && item.etc_note ? `기타(${item.etc_note})` : slot,
                        );
                        // 메타 줄 1: [용량씩] · [하루 N회] · [슬롯들] · [부가설명] 순서.
                        // 슬롯들은 내부 ", " 로 묶어 하나의 항목으로(메타 구분자 " · " 와 시각 분리).
                        // 일수는 별도 줄로 분리.
                        const slotsStr = slotsDisplay.length > 0 ? slotsDisplay.join(", ") : "";
                        const metaParts: string[] = [];
                        if (item.dosage) metaParts.push(`${item.dosage}씩`);
                        metaParts.push(`하루 ${dc}회`);
                        if (slotsStr) metaParts.push(slotsStr);
                        if (item.timing) metaParts.push(item.timing);
                        return (
                        <div
                          key={ii}
                          style={{
                            padding: 12,
                            borderRadius: 10,
                            background: "var(--sage-pale, #EDF4F0)",
                            marginBottom: 8,
                          }}
                        >
                          {/* (a) 헤더 — 통약/소분 배지 + 이름 */}
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700,
                              padding: "1px 7px", borderRadius: 100,
                              background: isCompound ? "var(--terra-pale, #FBF5F1)" : "var(--sage-pale, #EDF4F0)",
                              color: isCompound ? "#C06B45" : "#4A6355",
                              border: isCompound
                                ? "1px solid var(--terra-light, #F5E6DC)"
                                : "1px solid rgba(94,125,108,0.2)",
                            }}>
                              {isCompound ? "소분 조제약" : "통약"}
                            </span>
                            <span style={{ fontSize: 15, fontWeight: 600, color: "#2C3630" }}>{item.name}</span>
                          </div>

                          {/* (b) 메타 줄 1 — 용량씩 · 하루 N회 · 슬롯 · 부가설명 */}
                          <div style={{ fontSize: 14, fontWeight: 500, color: "#3D4A42", marginTop: 4, lineHeight: 1.5 }}>
                            {metaParts.join(" · ")}
                          </div>

                          {/* (b') 메타 줄 2 — 일수 별도 줄. days 가 null 이면 그리지 않음 */}
                          {item.days != null && (
                            <div style={{ fontSize: 14, fontWeight: 500, color: "#3D4A42", marginTop: 2, lineHeight: 1.5 }}>
                              {item.days}일분
                            </div>
                          )}

                          {/* (c) 메모 */}
                          {item.memo && (
                            <div style={{ fontSize: 14, fontWeight: 500, color: "#3D4A42", marginTop: 6, lineHeight: 1.5 }}>
                              📝 {item.memo}
                            </div>
                          )}

                          {/* (d) 약포지 안내 — 소분 + package_note=true 일 때만 */}
                          {isCompound && item.package_note && (
                            <div style={{
                              marginTop: 8,
                              padding: "7px 10px",
                              borderRadius: 8,
                              background: "var(--terra-pale, #FBF5F1)",
                              border: "1px solid var(--terra-light, #F5E6DC)",
                              fontSize: 14,
                              fontWeight: 500,
                              color: "#C06B45",
                            }}>
                              약포지에 표시된 대로 복용하세요
                            </div>
                          )}
                        </div>
                        );
                      })}

                      {guide.custom_guide && (
                        <div style={{
                          padding: 12,
                          borderRadius: 10,
                          background: "var(--terra-pale, #FBF5F1)",
                          border: "1px solid var(--terra-light, #F5E6DC)",
                          marginBottom: 10,
                        }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#2C3630", marginBottom: 4 }}>생활 가이드</div>
                          <div style={{ fontSize: 15, color: "#3D4A42", lineHeight: 1.6 }}>{guide.custom_guide}</div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setGuideStartModal({ guide, date: getTodayLocalISO() })}
                        disabled={alreadyAdded || isAdding}
                        style={{
                          width: "100%",
                          padding: "12px 0",
                          borderRadius: 10,
                          fontSize: 14,
                          fontWeight: 700,
                          background: alreadyAdded ? "#F4F6F3" : "#4A6355",
                          color: alreadyAdded ? "#7A8A80" : "#fff",
                          border: alreadyAdded ? "1px solid rgba(94,125,108,0.18)" : "none",
                          cursor: (alreadyAdded || isAdding) ? "default" : "pointer",
                          opacity: isAdding ? 0.7 : 1,
                          fontFamily: "'Noto Sans KR', sans-serif",
                        }}
                      >
                        {alreadyAdded ? "추가 완료" : isAdding ? "추가 중..." : "이대로 추가하기"}
                      </button>
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </section>

        {/* ═══════ 다음 몸 상태 체크 카드 ═══════ */}
        {!showEmptyState && (() => {
          const nextCheckDate = new Date(2026, 3, 27); // 2026.04.27
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          nextCheckDate.setHours(0, 0, 0, 0);
          const diffDays = Math.round((nextCheckDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const isPast = diffDays <= 0;
          return (
            <section className="my-section" style={{ paddingBottom: 0 }}>
              <div style={{
                padding: "16px 18px", borderRadius: 14,
                background: isPast ? "#FBF5F1" : "#EDF4F0",
                border: `1px solid ${isPast ? "#F5E6DC" : "#B3CCBE"}`,
                display: "flex", alignItems: "center", gap: 14,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: isPast ? "#F5E6DC" : "#D4E8DB",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, flexShrink: 0,
                }}>
                  {isPast ? "⏰" : "📊"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#2C3630", marginBottom: 2, fontFamily: "'Noto Sans KR', sans-serif" }}>
                    {isPast ? "체크할 시간이에요!" : "다음 체크 예정"}
                  </div>
                  <div style={{ fontSize: 14, color: isPast ? "#C06B45" : "#4A6355", fontWeight: 600 }}>
                    {isPast ? "밀린 체크를 지금 해보세요" : `4월 27일 · D-${diffDays}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/health-check")}
                  style={{
                    padding: "8px 16px", borderRadius: 10,
                    fontSize: 13, fontWeight: 700,
                    background: "#4A6355", color: "#fff",
                    border: "none", cursor: "pointer",
                    flexShrink: 0, whiteSpace: "nowrap",
                  }}
                >
                  체크하러 가기
                </button>
              </div>
            </section>
          );
        })()}

        {/* ═══════ 3. 내 건강 변화 ═══════ */}
        <section className="my-section">
          <h2 className="my-section-title">내 건강 변화</h2>
          {(() => {
            // hcRows: 최신순. [0] = current, [1] = previous (있으면 비교)
            const fmt = (iso: string) => {
              const d = new Date(iso);
              return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
            };

            // DB 데이터가 아직 로딩 중이거나(null) 비어있으면 빈 상태 또는 Mock 폴백
            const dbReady = hcRows !== null;
            const hasDbData = dbReady && hcRows.length > 0;

            if (!hasDbData) {
              // DB 비어있을 때: 기존 Mock 데이터 폴백 (showEmptyState 토글로 빈 상태도 노출 가능)
              return (
                <HealthIndicatorComparison
                  emptyState={showEmptyState || (dbReady && hcRows.length === 0)}
                  onEmptyCheckClick={() => router.push("/health-check")}
                  previousDate="2026.03.15"
                  currentDate="2026.04.05"
                  summaryHeadline="처음보다 에너지가 40% 좋아졌어요!"
                  items={HEALTH_SCORES.map((h) => ({
                    label: h.label,
                    before: h.before,
                    after: h.after,
                    lowerIsBetter: h.lowerIsBetter,
                  }))}
                  onCheckClick={() => router.push("/health-check")}
                />
              );
            }

            // hcRows 는 created_at desc 정렬 → [0]=가장 최근, [last]=가장 처음
            // first vs latest 비교 (직전 vs 최신이 아니라, 처음 기록 vs 최신 기록)
            const current = hcRows[0];
            const previous = hcRows.length >= 2 ? hcRows[hcRows.length - 1] : null;
            const items = [
              { label: "에너지/활력", key: "energy_score" as const, lowerIsBetter: false },
              { label: "수면", key: "sleep_score" as const, lowerIsBetter: false },
              { label: "소화", key: "digestion_score" as const, lowerIsBetter: false },
              { label: "기분", key: "mood_score" as const, lowerIsBetter: false },
              { label: "증상 불편도", key: "discomfort_score" as const, lowerIsBetter: true },
            ].map((m) => ({
              label: m.label,
              before: previous ? (previous[m.key] as number) : undefined,
              after: current[m.key] as number,
              lowerIsBetter: m.lowerIsBetter,
            }));

            return (
              <HealthIndicatorComparison
                previousDate={previous ? fmt(previous.created_at) : undefined}
                currentDate={fmt(current.created_at)}
                items={items}
                onCheckClick={() => router.push("/health-check")}
              />
            );
          })()}
        </section>

        {/* ═══════ 4. 약국 방문 도장 ═══════ */}
        <section className="my-section">
          <h2 className="my-section-title">약국 방문</h2>

          {showEmptyState ? (
            <div style={emptyBox}>
              <div style={emptyEmoji}>🏥</div>
              <div style={emptyTitle}>아직 약국 방문 기록이 없어요</div>
              <div style={emptyDesc}>약사 선생님과 상담을 시작해보세요</div>
              <button type="button" style={emptyBtn} onClick={() => router.push("/match")}>약사 찾아보기</button>
            </div>
          ) : (
          <>
          <div className="my-stamp-count">
            방문 <strong>{STAMPS.filter((s) => s.filled).length}회</strong>
          </div>

          <div className="my-stamp-grid">
            {STAMPS.map((st, i) => (
              <div key={i} className={`my-stamp${st.filled ? " filled" : ""}`}>
                {st.filled ? (
                  <>
                    <span className="my-stamp-check">✓</span>
                    <span className="my-stamp-date">{st.date}</span>
                  </>
                ) : (
                  <span className="my-stamp-empty" />
                )}
              </div>
            ))}
          </div>
          <div className="my-stamp-msg">꾸준한 관리가 건강의 시작이에요!</div>
          </>
          )}
        </section>

        {/* ═══════ 5. 내 상담 ═══════ */}
        <section className="my-section">
          <h2 className="my-section-title">내 상담</h2>

          {showEmptyState ? (
            <div style={emptyBox}>
              <div style={emptyEmoji}>💬</div>
              <div style={emptyTitle}>아직 상담 내역이 없어요</div>
              <div style={emptyDesc}>3분이면 증상 분석이 끝나요</div>
              <button type="button" style={emptyBtn} onClick={() => router.push("/questionnaire")}>무료 상담 시작하기</button>
            </div>
          ) : (
          <>
          {/* 진행 중 — 로그인 사용자는 DB 결과, 비로그인은 mock 폴백 */}
          {(() => {
            const useDb = !!user && dbConsults !== null;
            const sourceList = useDb ? dbConsults! : CONSULTS;
            return sourceList.filter((c) => c.status === "active").map((c) => (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              className="my-consult-card active"
              style={{
                background: "#EDF4F0",
                borderRadius: 12,
                padding: 16,
                borderLeft: "none",
              }}
            >
              <div className="my-consult-top">
                <span className="my-consult-pharm">
                  {c.pharmacist}{c.pharmacy ? ` · ${c.pharmacy}` : ""}
                </span>
                <span className="my-consult-status active">상담 중</span>
              </div>
              {c.symptoms.length > 0 && (
                <div className="my-consult-tags">
                  {c.symptoms.map((s) => (
                    <span key={s.label} className={`my-tag ${TAG_CLASS[s.category]}`}>
                      {s.label}
                    </span>
                  ))}
                </div>
              )}
            </Link>
            ));
          })()}

          {/* 지난 상담 */}
          <div className="my-consult-past-label">지난 상담</div>
          {(() => {
            const useDb = !!user && dbConsults !== null;
            const sourceList = useDb ? dbConsults! : CONSULTS;
            const past = sourceList.filter((c) => c.status === "completed");
            // 로그인 사용자가 DB 로드 완료 후, mock 상담도 비어있고 doseStatus 도 비어있으면 빈 상태
            if (past.length === 0 && doseLoaded && Object.keys(doseStatus).length === 0) {
              return (
                <div
                  style={{
                    padding: "32px 16px",
                    textAlign: "center",
                    fontSize: 14,
                    color: "#3D4A42",
                    background: "#F8F9F7",
                    borderRadius: 12,
                  }}
                >
                  아직 복약 기록이 없어요
                </div>
              );
            }
            return past.map((c) => {
            const st = getDoseStatus(c.id);
            const stLabel = st === "taking" ? "복용 중" : st === "completed" ? "복용 완료" : "복용 중단";
            const stTheme =
              st === "taking"
                ? { bg: "#EDF4F0", color: "#4A6355", border: "#B3CCBE" }
                : st === "stopped"
                  ? { bg: "#FAECE7", color: "#993C1D", border: "#E8C9BD" }
                  : { bg: "#F0F0F0", color: "#3D4A42", border: "#D6D6D6" };
            const cardBg =
              st === "stopped" ? "#FBF5F1" :
              st === "completed" ? "#F5F5F5" :
              "#EDF4F0";
            return (
              <div
                key={c.id}
                className="my-consult-card past"
                style={{
                  background: cardBg,
                  borderRadius: 12,
                  padding: 16,
                  borderLeft: "none",
                }}
              >
                <div className="my-consult-top">
                  <span className="my-consult-pharm">{c.pharmacist}</span>
                  <span className="my-consult-date">{c.date}</span>
                </div>
                <div className="my-consult-bottom">
                  <div className="my-consult-tags">
                    {c.symptoms.map((s) => (
                      <span key={s.label} className={`my-tag ${TAG_CLASS[s.category]}`}>
                        {s.label}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => openStatusModal(c.id)}
                    aria-label={`복용 상태 변경 — 현재 ${stLabel}`}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: stTheme.bg,
                      color: stTheme.color,
                      border: `1px solid ${stTheme.border}`,
                      borderRadius: 100,
                      padding: "6px 12px",
                      minHeight: 32,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'Noto Sans KR', sans-serif",
                      whiteSpace: "nowrap",
                      transition: "opacity 0.15s",
                    }}
                  >
                    {stLabel}
                    <svg width="8" height="8" viewBox="0 0 10 6" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                      <path d="M1 1 L5 5 L9 1" stroke={stTheme.color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          });
          })()}
          </>
          )}
        </section>

        {/* ═══════ 6. 설정 ═══════ */}
        <section className="my-section my-settings">
          <h2 className="my-section-title">설정</h2>

          <div style={{ fontSize: 14, fontWeight: 600, color: "#3D4A42", marginBottom: 8 }}>알림 설정</div>

          {/* 브라우저 푸시 구독 (I-4 A 단계) — 실제 표시는 다음 단계, 여기선 구독 등록만. */}
          {pushStatus !== "unsupported" && (
            <div className="my-setting-row" style={{ alignItems: "center" }}>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                <span>🔔 브라우저 알림</span>
                <span style={{ fontSize: 13, color: "#5E7D6C", fontWeight: 500 }}>
                  {pushStatus === "loading" && "확인 중..."}
                  {pushStatus === "unsubscribed" && "이 기기에서 알림을 받으려면 구독하세요"}
                  {pushStatus === "subscribed" && "이 기기에서 알림을 받고 있어요"}
                  {pushStatus === "denied" && "권한이 거부됐어요. 브라우저 설정에서 허용해 주세요"}
                  {pushStatus === "error" && "구독 처리 중 문제가 발생했어요"}
                </span>
              </span>
              {pushStatus === "subscribed" ? (
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  minHeight: 36, padding: "0 12px", borderRadius: 10,
                  background: "#EDF4F0", color: "#4A6355",
                  fontSize: 14, fontWeight: 700, flexShrink: 0,
                }}>
                  구독됨
                </span>
              ) : (
                <button
                  type="button"
                  onClick={enablePush}
                  disabled={pushBusy || pushStatus === "denied" || pushStatus === "loading"}
                  style={{
                    minHeight: 48, padding: "0 16px", borderRadius: 10,
                    background: (pushBusy || pushStatus === "denied" || pushStatus === "loading") ? "#B3CCBE" : "#4A6355",
                    color: "#fff",
                    border: "none",
                    fontSize: 14, fontWeight: 700,
                    cursor: (pushBusy || pushStatus === "denied" || pushStatus === "loading") ? "default" : "pointer",
                    fontFamily: "'Noto Sans KR', sans-serif",
                    whiteSpace: "nowrap", flexShrink: 0,
                  }}
                >
                  {pushBusy ? "등록 중..." : "브라우저 알림 받기"}
                </button>
              )}
            </div>
          )}

          <div className="my-setting-row">
            <span>💬 채팅 알림</span>
            <button
              className={`my-toggle${notiChat ? " on" : ""}`}
              onClick={() => {
                const prev = notiChat;
                const next = !prev;
                setNotiChat(next);
                void updateNotiPref("noti_chat", next, () => setNotiChat(prev));
              }}
              type="button"
              aria-label="채팅 알림 토글"
            >
              <span className="my-toggle-knob" />
            </button>
          </div>
          {/* 복약 알림 — 보조 문구를 row 안 column flex 로 넣어 "브라우저 알림" 과 동일한 간격 적용 */}
          <div className="my-setting-row" style={{ alignItems: "center" }}>
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
              <span>💊 복약 알림</span>
              {notiMed && pushStatus !== "subscribed" && (
                <span style={{ fontSize: 14, color: "#C06B45", fontWeight: 500 }}>
                  브라우저 알림을 먼저 켜야 이 알림을 받을 수 있어요
                </span>
              )}
              {notiMed && pushStatus === "subscribed" && (
                <span style={{ fontSize: 13, color: "#5E7D6C", fontWeight: 500 }}>
                  복용 종료가 가까워지면 알려드려요
                </span>
              )}
            </span>
            <button
              className={`my-toggle${notiMed ? " on" : ""}`}
              onClick={() => {
                const prev = notiMed;
                const next = !prev;
                setNotiMed(next);
                void updateNotiPref("noti_med", next, () => setNotiMed(prev));
              }}
              type="button"
              aria-label="복약 알림 토글"
            >
              <span className="my-toggle-knob" />
            </button>
          </div>
          <div className="my-setting-row">
            <span>📊 몸 상태 체크 알림</span>
            <button
              className={`my-toggle${notiHealth ? " on" : ""}`}
              onClick={() => {
                const prev = notiHealth;
                const next = !prev;
                setNotiHealth(next);
                void updateNotiPref("noti_health", next, () => setNotiHealth(prev));
              }}
              type="button"
              aria-label="몸 상태 체크 알림 토글"
            >
              <span className="my-toggle-knob" />
            </button>
          </div>
          {/* 방문 알림 — 보조 문구를 row 안 column flex 로 넣어 "브라우저 알림" 과 동일한 간격 적용 */}
          <div className="my-setting-row" style={{ alignItems: "center" }}>
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
              <span>🏥 약국 방문 알림</span>
              {notiVisit && pushStatus !== "subscribed" && (
                <span style={{ fontSize: 14, color: "#C06B45", fontWeight: 500 }}>
                  브라우저 알림을 먼저 켜야 이 알림을 받을 수 있어요
                </span>
              )}
              {notiVisit && pushStatus === "subscribed" && (
                <span style={{ fontSize: 13, color: "#5E7D6C", fontWeight: 500 }}>
                  방문 예정이 가까워지면 알려드려요
                </span>
              )}
            </span>
            <button
              className={`my-toggle${notiVisit ? " on" : ""}`}
              onClick={() => {
                const prev = notiVisit;
                const next = !prev;
                setNotiVisit(next);
                void updateNotiPref("noti_visit", next, () => setNotiVisit(prev));
              }}
              type="button"
              aria-label="방문 예약 알림 토글"
            >
              <span className="my-toggle-knob" />
            </button>
          </div>
          <div className="my-setting-row clickable">
            <span>이용약관</span>
            <span className="my-setting-arrow">›</span>
          </div>
          <div className="my-setting-row clickable">
            <span>개인정보처리방침</span>
            <span className="my-setting-arrow">›</span>
          </div>
          <div className="my-setting-row clickable" onClick={() => setShowLogout(true)}>
            <span>로그아웃</span>
            <span className="my-setting-arrow">›</span>
          </div>
          <div className="my-setting-row clickable" onClick={() => setShowWithdraw(true)}>
            <span className="my-setting-danger">회원 탈퇴</span>
            <span className="my-setting-arrow">›</span>
          </div>

          <div className="my-version">v1.0.0</div>
        </section>

        <div style={{ height: 80 }} />
      </div>

      {/* ═══════ 영양제 추가 모달 ═══════ */}
      {showAddModal && (
        <div
          className="my-modal-overlay"
          onMouseDown={(e) => { overlayDownRef.current = e.target === e.currentTarget; }}
          onMouseUp={(e) => {
            if (overlayDownRef.current && e.target === e.currentTarget) closeAddModal();
            overlayDownRef.current = false;
          }}
        >
          <div className="my-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="my-modal-title">영양제 추가</h3>

            <label className="my-edit-label">
              영양제 이름
              <input
                type="text"
                className="my-edit-input"
                placeholder="예: 오메가3"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>

            <div className="my-modal-time-label">복용 시간 (다중 선택)</div>
            <div className="my-modal-time-grid">
              {(["아침", "점심", "저녁", "취침 전"] as TimeSlot[]).map((t) => (
                <button
                  key={t}
                  className={`my-time-chip${newTimes.has(t) ? " selected" : ""}`}
                  onClick={() =>
                    setNewTimes((prev) => {
                      const next = new Set(prev);
                      if (next.has(t)) next.delete(t);
                      else next.add(t);
                      return next;
                    })
                  }
                  type="button"
                >
                  {t}
                </button>
              ))}
            </div>

            <label className="my-edit-label" style={{ marginTop: 14 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                복용 시작일
                {addStartDate === getTodayLocalISO() && <TodayBadge />}
              </span>
              <input
                type="date"
                className="my-edit-input"
                value={addStartDate}
                onChange={(e) => setAddStartDate(e.target.value)}
              />
            </label>

            <div style={{ marginBottom: 16 }}>
              <label className="my-edit-label" style={{ marginTop: 14 }}>
                복용 일수 (선택)
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <input
                    type="number"
                    className="my-edit-input"
                    min={1}
                    placeholder="예: 60"
                    value={addDays}
                    onChange={(e) => setAddDays(e.target.value)}
                    style={{ width: 100, textAlign: "right" }}
                  />
                  <button
                    type="button"
                    onClick={() => setAddCalcOpen((v) => !v)}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(94,125,108,0.22)",
                      background: "#fff",
                      color: "#4A6355",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'Noto Sans KR', sans-serif",
                    }}
                    aria-expanded={addCalcOpen}
                  >
                    {addCalcOpen ? "복용일수 계산기 닫기" : "복용일수 계산기 열기"}
                  </button>
                </div>
                <span style={{ display: "block", marginTop: 4, fontSize: 13, color: "#5E7D6C" }}>
                  남은 일수를 알려드릴 때 쓰여요. 비워두면 기간 없이 계속 챙겨요.
                </span>
              </label>
              {addCalcOpen && (
                <DayCalculator
                  dailyCount={newTimes.size}
                  onApply={(d) => { setAddDays(String(d)); setAddCalcOpen(false); }}
                />
              )}
            </div>

            <div className="my-modal-actions">
              <button className="my-btn secondary" onClick={closeAddModal} type="button">
                취소
              </button>
              <button
                className="my-btn primary"
                onClick={addSupplement}
                disabled={!newName.trim() || newTimes.size === 0 || !addStartDate}
                type="button"
              >
                등록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ 영양제 수정 모달 ═══════ */}
      {editingId !== null && (
        <div
          className="my-modal-overlay"
          onMouseDown={(e) => { overlayDownRef.current = e.target === e.currentTarget; }}
          onMouseUp={(e) => {
            if (overlayDownRef.current && e.target === e.currentTarget) setEditingId(null);
            overlayDownRef.current = false;
          }}
        >
          <div className="my-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="my-modal-title">영양제 수정</h3>

            <label className="my-edit-label">
              영양제 이름
              <input
                type="text"
                className="my-edit-input"
                placeholder="예: 오메가3"
                value={editSuppName}
                onChange={(e) => setEditSuppName(e.target.value)}
              />
            </label>

            <div className="my-modal-time-label">복용 시간 (다중 선택)</div>
            <div className="my-modal-time-grid">
              {(["아침", "점심", "저녁", "취침 전"] as TimeSlot[]).map((t) => (
                <button
                  key={t}
                  className={`my-time-chip${editTimes.has(t) ? " selected" : ""}`}
                  onClick={() =>
                    setEditTimes((prev) => {
                      const next = new Set(prev);
                      if (next.has(t)) next.delete(t);
                      else next.add(t);
                      return next;
                    })
                  }
                  type="button"
                >
                  {t}
                </button>
              ))}
            </div>

            <label className="my-edit-label" style={{ marginTop: 14 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                복용 시작일
                {editStartDate === getTodayLocalISO() && <TodayBadge />}
              </span>
              <input
                type="date"
                className="my-edit-input"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
              />
            </label>

            <div style={{ marginBottom: 16 }}>
              <label className="my-edit-label" style={{ marginTop: 14 }}>
                복용 일수 (선택)
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <input
                    type="number"
                    className="my-edit-input"
                    min={1}
                    placeholder="예: 60"
                    value={editDays}
                    onChange={(e) => setEditDays(e.target.value)}
                    style={{ width: 100, textAlign: "right" }}
                  />
                  <button
                    type="button"
                    onClick={() => setEditCalcOpen((v) => !v)}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(94,125,108,0.22)",
                      background: "#fff",
                      color: "#4A6355",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'Noto Sans KR', sans-serif",
                    }}
                    aria-expanded={editCalcOpen}
                  >
                    {editCalcOpen ? "복용일수 계산기 닫기" : "복용일수 계산기 열기"}
                  </button>
                </div>
                <span style={{ display: "block", marginTop: 4, fontSize: 13, color: "#5E7D6C" }}>
                  남은 일수를 알려드릴 때 쓰여요. 비워두면 기간 없이 계속 챙겨요.
                </span>
              </label>
              {editCalcOpen && (
                <DayCalculator
                  dailyCount={editTimes.size}
                  onApply={(d) => { setEditDays(String(d)); setEditCalcOpen(false); }}
                />
              )}
            </div>

            <div className="my-modal-actions">
              <button className="my-btn secondary" onClick={() => setEditingId(null)} type="button">
                취소
              </button>
              <button
                className="my-btn primary"
                onClick={updateSupplement}
                disabled={!editSuppName.trim() || !editStartDate}
                type="button"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ "이대로 추가하기" 시작일 확인 미니 모달 ═══════ */}
      {guideStartModal && (
        <div
          className="my-modal-overlay"
          onMouseDown={(e) => { overlayDownRef.current = e.target === e.currentTarget; }}
          onMouseUp={(e) => {
            if (overlayDownRef.current && e.target === e.currentTarget) setGuideStartModal(null);
            overlayDownRef.current = false;
          }}
        >
          <div className="my-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="my-modal-title">오늘부터 복용하나요?</h3>
            <div style={{ fontSize: 15, color: "#3D4A42", lineHeight: 1.6, marginBottom: 14 }}>
              복용을 시작하는 날짜를 선택하세요. 종료 예정일 계산에 사용됩니다. 기본은 오늘이에요. 다른 날부터면 날짜를 바꿔주세요.
            </div>

            <label className="my-edit-label">
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                복용 시작일
                {guideStartModal.date === getTodayLocalISO() && <TodayBadge />}
              </span>
              <input
                type="date"
                className="my-edit-input"
                value={guideStartModal.date}
                onChange={(e) =>
                  setGuideStartModal((prev) => (prev ? { ...prev, date: e.target.value } : prev))
                }
              />
            </label>

            <div className="my-modal-actions">
              <button
                className="my-btn secondary"
                onClick={() => setGuideStartModal(null)}
                type="button"
                disabled={addingFromGuideId === guideStartModal.guide.id}
              >
                취소
              </button>
              <button
                className="my-btn primary"
                onClick={() => addFromDosageGuide(guideStartModal.guide, guideStartModal.date)}
                disabled={!guideStartModal.date || addingFromGuideId === guideStartModal.guide.id}
                type="button"
              >
                {addingFromGuideId === guideStartModal.guide.id ? "추가 중..." : "추가하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ 로그아웃 확인 ═══════ */}
      {showLogout && (
        <div className="my-modal-overlay" onClick={() => setShowLogout(false)}>
          <div className="my-confirm" onClick={(e) => e.stopPropagation()}>
            <h3 className="my-confirm-title">로그아웃 하시겠어요?</h3>
            <div className="my-confirm-actions">
              <button className="my-btn secondary" onClick={() => setShowLogout(false)} type="button">
                취소
              </button>
              <button className="my-btn primary" onClick={doLogout} type="button">
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ 복용 상태 변경 모달 ═══════ */}
      {statusModalId && (
        <div
          onClick={() => setStatusModalId(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "24px 20px 20px",
              width: "100%",
              maxWidth: 360,
              boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#2C3630", margin: "0 0 14px", textAlign: "center", fontFamily: "'Gothic A1', sans-serif" }}>
              복용 상태를 변경할까요?
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              {([
                { key: "taking", label: "복용 중" },
                { key: "completed", label: "복용 완료" },
                { key: "stopped", label: "복용 중단" },
              ] as const).map((opt) => {
                const active = statusDraft === opt.key;
                return (
                  <label
                    key={opt.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      minHeight: 48,
                      borderRadius: 10,
                      border: active ? "1.5px solid #4A6355" : "1px solid rgba(94,125,108,0.2)",
                      background: active ? "#EDF4F0" : "#fff",
                      cursor: "pointer",
                      fontSize: 15,
                      fontWeight: active ? 600 : 500,
                      color: "#2C3630",
                    }}
                  >
                    <input
                      type="radio"
                      name="dose-status"
                      checked={active}
                      onChange={() => setStatusDraft(opt.key)}
                      style={{ width: 18, height: 18, accentColor: "#4A6355", margin: 0 }}
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
            {statusDraft === "stopped" && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "#FAECE7",
                  color: "#993C1D",
                  fontSize: 14,
                  lineHeight: 1.5,
                  marginBottom: 14,
                }}
              >
                중단 이유를 약사님에게 채팅으로 알려주시면 더 나은 가이드를 받을 수 있어요
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setStatusModalId(null)}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  minHeight: 48,
                  borderRadius: 10,
                  background: "#F8F9F7",
                  color: "#3D4A42",
                  fontSize: 15,
                  fontWeight: 600,
                  border: "1px solid rgba(94,125,108,0.2)",
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveStatus}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  minHeight: 48,
                  borderRadius: 10,
                  background: "#4A6355",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                변경하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ 회원탈퇴 확인 ═══════ */}
      {showWithdraw && (
        <div className="my-modal-overlay" onClick={() => setShowWithdraw(false)}>
          <div className="my-confirm" onClick={(e) => e.stopPropagation()}>
            <h3 className="my-confirm-title">정말 탈퇴하시겠어요?</h3>
            <p className="my-confirm-desc">모든 데이터가 삭제되며 복구할 수 없습니다.</p>
            <div className="my-confirm-actions">
              <button className="my-btn secondary" onClick={() => setShowWithdraw(false)} type="button">
                취소
              </button>
              <button className="my-btn danger" onClick={() => setShowWithdraw(false)} type="button">
                탈퇴하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MypageClient() {
  return (
    <Suspense>
      <MypageContent />
    </Suspense>
  );
}
