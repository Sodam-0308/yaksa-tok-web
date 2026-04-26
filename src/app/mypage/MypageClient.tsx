"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import HealthIndicatorComparison from "@/components/HealthIndicatorComparison";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type HealthCheckRow = Database["public"]["Tables"]["health_checks"]["Row"];

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
  times: { slot: TimeSlot; checked: boolean }[];
}

const INITIAL_SUPPLEMENTS: Supplement[] = [
  { id: "s1", name: "비타민D 1000IU", times: [{ slot: "아침", checked: true }, { slot: "저녁", checked: false }] },
  { id: "s2", name: "유산균", times: [{ slot: "아침", checked: false }] },
  { id: "s3", name: "마그네슘", times: [{ slot: "취침 전", checked: false }] },
];

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
  const [checksByDate, setChecksByDate] = useState<Record<string, Record<string, boolean[]>>>(() => {
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return {
      [todayKey]: Object.fromEntries(
        INITIAL_SUPPLEMENTS.map((s) => [s.id, s.times.map((t) => t.checked)])
      ),
    };
  });

  const getChecks = (suppId: string, timesLen: number): boolean[] => {
    return checksByDate[dateKey]?.[suppId] ?? new Array(timesLen).fill(false);
  };

  const [supplements, setSupplements] = useState<Supplement[]>(INITIAL_SUPPLEMENTS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTimes, setNewTimes] = useState<Set<TimeSlot>>(new Set());
  const [swipedId, setSwipedId] = useState<string | null>(null);

  /* ── 지난 상담 복용 상태 ── */
  type DoseStatus = "taking" | "completed" | "stopped";
  const [doseStatus, setDoseStatus] = useState<Record<string, DoseStatus>>({});
  const [statusModalId, setStatusModalId] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<DoseStatus>("completed");
  const getDoseStatus = (id: string): DoseStatus => doseStatus[id] ?? "completed";
  const openStatusModal = (id: string) => {
    setStatusDraft(getDoseStatus(id));
    setStatusModalId(id);
  };
  const saveStatus = () => {
    if (!statusModalId) return;
    setDoseStatus((prev) => ({ ...prev, [statusModalId]: statusDraft }));
    setStatusModalId(null);
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

  const age = calcAge(editMode ? editBirth : profile.birth);

  /* 영양제 체크 토글 (날짜별) */
  const toggleCheck = (id: string, timeIndex: number) => {
    setChecksByDate((prev) => {
      const dayChecks = { ...(prev[dateKey] || {}) };
      const supp = supplements.find((s) => s.id === id);
      const arr = [...(dayChecks[id] ?? new Array(supp?.times.length ?? 0).fill(false))];
      arr[timeIndex] = !arr[timeIndex];
      dayChecks[id] = arr;
      return { ...prev, [dateKey]: dayChecks };
    });
  };

  /* 영양제 삭제 */
  const deleteSupplement = (id: string) => {
    setSupplements((prev) => prev.filter((s) => s.id !== id));
    setSwipedId(null);
  };

  /* 영양제 추가 */
  const addSupplement = () => {
    if (!newName.trim() || newTimes.size === 0) return;
    const newItem: Supplement = {
      id: `s-new-${Date.now()}`,
      name: newName.trim(),
      times: Array.from(newTimes).map((slot) => ({ slot, checked: false })),
    };
    setSupplements((prev) => [...prev, newItem]);
    setNewName("");
    setNewTimes(new Set());
    setShowAddModal(false);
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

  const checkedCount = supplements.reduce((acc, s) => acc + getChecks(s.id, s.times.length).filter(Boolean).length, 0);

  return (
    <div className="my-page">
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

        {/* ═══════ 1-1. 다음 방문 예정 ═══════ */}
        <section className="my-section">
          <h2 className="my-section-title">다음 방문 예정</h2>
          <div style={{
            borderRadius: 14, overflow: "hidden",
            border: "1.5px solid #B3D1E0", background: "#fff",
          }}>
            <div style={{
              padding: "14px 16px", background: "#E8F0F5",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 22 }}>📅</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#2C3630" }}>4월 12일 (토) 오전</div>
                <div style={{ fontSize: 14, color: "#3D4A42", marginTop: 2 }}>초록숲 약국 · 김서연 약사</div>
              </div>
            </div>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 13, color: "#5A8BA8", fontWeight: 600,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5A8BA8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                전날 + 당일 알림 예정
              </div>
              <div style={{ fontSize: 13, color: "#3D4A42" }}>
                메모: 9시-10시가 한가해요
              </div>
            </div>
          </div>
        </section>

        {/* ═══════ 2. 내 영양제 관리 ═══════ */}
        <section className="my-section">
          <h2 className="my-section-title">내 영양제 관리</h2>

          {showEmptyState ? (
            <div style={emptyBox}>
              <div style={emptyEmoji}>💊</div>
              <div style={emptyTitle}>아직 등록된 영양제가 없어요</div>
              <div style={emptyDesc}>영양제를 등록하면 복약 체크를 할 수 있어요</div>
              <button type="button" style={emptyBtn} onClick={() => setShowAddModal(true)}>+ 영양제 추가</button>
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
              const checks = getChecks(s.id, s.times.length);
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
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
                  >
                    <span className="my-supplement-name">{s.name}</span>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                      {s.times.map((t, ti) => {
                        const isChecked = checks[ti] ?? false;
                        return (
                          <button
                            key={ti}
                            type="button"
                            onClick={() => toggleCheck(s.id, ti)}
                            aria-label={`${s.name} ${t.slot} ${isChecked ? "복용 완료" : "복용 체크"}`}
                            style={{
                              display: "flex", alignItems: "center", gap: 4,
                              background: "none", border: "none", cursor: "pointer", padding: 0,
                            }}
                          >
                            <HeartIcon filled={isChecked} size={20} />
                            <span style={{ fontSize: 13, fontWeight: 500, color: isChecked ? "#4A6355" : "#3D4A42" }}>{t.slot}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* 스와이프 액션 */}
                  <div className="my-supplement-actions">
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

          {/* 복약 달력 */}
          <div className="my-week-calendar">
            <div className="my-week-label">이번 주 복약</div>
            <div className="my-week-row">
              {WEEK_DAYS.map((day, i) => {
                const status = WEEK_HEARTS[i];
                return (
                  <div
                    key={day}
                    className={`my-week-cell${status === "today" ? " today" : ""}`}
                  >
                    <span className="my-week-day">{day}</span>
                    <span className="my-week-heart">
                      {status === "full" && <HeartIcon filled size={16} />}
                      {status === "half" && <HalfHeartIcon size={16} />}
                      {(status === "empty" || status === "today") && (
                        <HeartIcon filled={false} size={16} />
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            className="my-add-supplement-btn"
            onClick={() => setShowAddModal(true)}
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

          {/* 가이드 카드 */}
          {([
            {
              pharmacist: "김서연 약사",
              pharmacy: "그린약국",
              date: "2026.04.07",
              items: [
                { name: "비타민B군", dosage: "1알 씩", timing: "아침 식후", memo: "피로 개선 목적, 2주 후 경과 확인" },
                { name: "마그네슘", dosage: "1알 씩", timing: "취침 전", memo: "수면 질 개선, 근육 이완 도움" },
              ],
              lifestyle: "카페인 하루 2잔 이하로 줄이기, 취침 30분 전 스마트폰 금지",
            },
            {
              pharmacist: "김서연 약사",
              pharmacy: "그린약국",
              date: "2026.03.27",
              items: [
                { name: "마그네슘", dosage: "1알 씩", timing: "취침 전", memo: "수면 보조" },
                { name: "유산균", dosage: "1포 씩", timing: "아침 공복", memo: "장 건강 개선" },
              ],
              lifestyle: "저녁 9시 이후 야식 줄이기",
            },
          ] as const).map((guide, gi) => {
            const isGuideOpen = expandedGuides.has(gi);
            return (
            <div
              key={gi}
              style={{
                borderRadius: 14,
                border: gi === 0 ? "1.5px solid #F0D9CC" : "1px solid rgba(94,125,108,0.14)",
                marginBottom: 12,
                overflow: "hidden",
                fontStyle: "normal",
              }}
            >
              {/* 클릭 가능한 헤더 */}
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
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#2C3630" }}>{guide.pharmacist}</div>
                    <div style={{ fontSize: 14, color: "#3D4A42" }}>
                      {guide.pharmacy} · {guide.date}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {!isGuideOpen && (
                    <span style={{ fontSize: 14, color: "#3D4A42", fontWeight: 500 }}>{guide.items.length}개 영양제</span>
                  )}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5E7D6C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transition: "transform 0.2s", transform: isGuideOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {/* 펼쳐진 내용 */}
              {isGuideOpen && (
                <div style={{ padding: "12px 16px 16px", background: "#fff", borderTop: "1px solid rgba(94,125,108,0.12)" }}>
                  {/* 영양제 목록 */}
                  {guide.items.map((item, ii) => (
                    <div
                      key={ii}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        background: "var(--sage-pale, #EDF4F0)",
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: "#2C3630" }}>{item.name}</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#2C3630" }}>{item.dosage}</span>
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#2C3630" }}>{item.timing}</span>
                      </div>
                      {item.memo && (
                        <div style={{ fontSize: 14, color: "#3D4A42", lineHeight: 1.5, fontStyle: "normal" }}>
                          {item.memo}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* 생활 가이드 */}
                  {guide.lifestyle && (
                    <div style={{
                      padding: 12,
                      borderRadius: 10,
                      background: "var(--terra-pale, #FBF5F1)",
                      border: "1px solid var(--terra-light, #F5E6DC)",
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#2C3630", marginBottom: 4 }}>생활 가이드</div>
                      <div style={{ fontSize: 15, color: "#3D4A42", lineHeight: 1.6 }}>{guide.lifestyle}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })}
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

            const current = hcRows[0];
            const previous = hcRows.length >= 2 ? hcRows[1] : null;
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
          {/* 진행 중 */}
          {CONSULTS.filter((c) => c.status === "active").map((c) => (
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
                  {c.pharmacist} · {c.pharmacy}
                </span>
                <span className="my-consult-status active">상담 중</span>
              </div>
              <div className="my-consult-tags">
                {c.symptoms.map((s) => (
                  <span key={s.label} className={`my-tag ${TAG_CLASS[s.category]}`}>
                    {s.label}
                  </span>
                ))}
              </div>
            </Link>
          ))}

          {/* 지난 상담 */}
          <div className="my-consult-past-label">지난 상담</div>
          {CONSULTS.filter((c) => c.status === "completed").map((c) => {
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
          })}
          </>
          )}
        </section>

        {/* ═══════ 6. 설정 ═══════ */}
        <section className="my-section my-settings">
          <h2 className="my-section-title">설정</h2>

          <div style={{ fontSize: 14, fontWeight: 600, color: "#3D4A42", marginBottom: 8 }}>알림 설정</div>
          <div className="my-setting-row">
            <span>💬 채팅 알림</span>
            <button className={`my-toggle${notiChat ? " on" : ""}`} onClick={() => setNotiChat(!notiChat)} type="button" aria-label="채팅 알림 토글">
              <span className="my-toggle-knob" />
            </button>
          </div>
          <div className="my-setting-row">
            <span>💊 복약 알림</span>
            <button className={`my-toggle${notiMed ? " on" : ""}`} onClick={() => setNotiMed(!notiMed)} type="button" aria-label="복약 알림 토글">
              <span className="my-toggle-knob" />
            </button>
          </div>
          <div className="my-setting-row">
            <span>📊 몸 상태 체크 알림</span>
            <button className={`my-toggle${notiHealth ? " on" : ""}`} onClick={() => setNotiHealth(!notiHealth)} type="button" aria-label="몸 상태 체크 알림 토글">
              <span className="my-toggle-knob" />
            </button>
          </div>
          <div className="my-setting-row">
            <span>🏥 약국 방문 알림</span>
            <button className={`my-toggle${notiVisit ? " on" : ""}`} onClick={() => setNotiVisit(!notiVisit)} type="button" aria-label="방문 예약 알림 토글">
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
        <div className="my-modal-overlay" onClick={() => setShowAddModal(false)}>
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

            <div className="my-modal-actions">
              <button className="my-btn secondary" onClick={() => setShowAddModal(false)} type="button">
                취소
              </button>
              <button
                className="my-btn primary"
                onClick={addSupplement}
                disabled={!newName.trim() || newTimes.size === 0}
                type="button"
              >
                등록
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
