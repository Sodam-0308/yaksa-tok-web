"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

/* ══════════════════════════════════════════
   컬러 (약사 페이지 공통 톤)
   ══════════════════════════════════════════ */
const C = {
  sageBg: "#F8F9F7", sagePale: "#EDF4F0", sageLight: "#B3CCBE",
  sageMid: "#5E7D6C", sageDeep: "#4A6355",
  terra: "#C06B45", terraDark: "#A35A39", terraLight: "#F5E6DC", terraPale: "#FBF5F1",
  textDark: "#2C3630", textMid: "#3D4A42",
  border: "rgba(94, 125, 108, 0.14)", white: "#fff", error: "#D4544C",
};

/* 공통 인라인 스타일 */
const card: React.CSSProperties = { background: C.white, borderRadius: 16, boxShadow: "0 2px 12px rgba(74,99,85,0.07)", padding: 20, marginBottom: 16 };
const secTitle: React.CSSProperties = { fontSize: 17, fontWeight: 700, color: C.textDark, marginBottom: 6, fontFamily: "'Gothic A1', sans-serif" };
const secDesc: React.CSSProperties = { fontSize: 14, color: C.textMid, lineHeight: 1.6, marginBottom: 16 };
const inp: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 15, color: C.textDark, background: C.white, outline: "none", fontFamily: "'Noto Sans KR', sans-serif" };
const btnS: React.CSSProperties = { padding: "12px 0", borderRadius: 12, fontSize: 15, fontWeight: 700, background: C.white, color: C.sageDeep, border: `1.5px solid ${C.sageLight}`, cursor: "pointer", width: "100%" };
const btnP: React.CSSProperties = { padding: "14px 0", borderRadius: 12, fontSize: 15, fontWeight: 700, background: C.sageDeep, color: C.white, border: "none", cursor: "pointer", width: "100%" };

/* ══════════════════════════════════════════
   타입 & 기본값
   ══════════════════════════════════════════ */
const DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

interface TimeRange { start: string; end: string }
type ScheduleHours = Record<string, { on: boolean; ranges: TimeRange[] }>;

/* 시간 선택 옵션 — 00:00 ~ 23:30 30분 단위 (48개). value/라벨 모두 "HH:MM" 24시간제 */
const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

const INITIAL_SCHEDULE: ScheduleHours = {
  월: { on: true, ranges: [{ start: "10:00", end: "18:00" }] },
  화: { on: true, ranges: [{ start: "10:00", end: "18:00" }] },
  수: { on: true, ranges: [{ start: "10:00", end: "18:00" }] },
  목: { on: true, ranges: [{ start: "10:00", end: "18:00" }] },
  금: { on: true, ranges: [{ start: "10:00", end: "18:00" }] },
  토: { on: false, ranges: [] },
  일: { on: false, ranges: [] },
};

interface BlockedDate { id: number; start: string; end: string; reason: string }

/* "2026-05-01" → "2026.05.01" 표시용 */
const fmtDate = (d: string) => d.replace(/-/g, ".");

/* DB 로드값 정규화 — 화면 자료구조와 동일한 한글 키 JSON 그대로 사용 */
function normalizeSchedule(raw: unknown): ScheduleHours {
  if (!raw || typeof raw !== "object") return INITIAL_SCHEDULE;
  const obj = raw as Record<string, unknown>;
  const next: ScheduleHours = {};
  for (const day of DAYS) {
    const v = obj[day] as { on?: boolean; ranges?: TimeRange[] } | undefined;
    next[day] = {
      on: !!v?.on,
      ranges: Array.isArray(v?.ranges)
        ? v!.ranges.map((r) => ({ start: String(r.start ?? ""), end: String(r.end ?? "") }))
        : [],
    };
  }
  return next;
}

function normalizeBlocked(raw: unknown): BlockedDate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b, i) => {
      const o = b as Record<string, unknown>;
      return {
        id: typeof o.id === "number" ? o.id : i + 1,
        start: String(o.start ?? ""),
        end: String(o.end ?? ""),
        reason: String(o.reason ?? ""),
      };
    })
    .filter((b) => b.start && b.end);
}

/* ══════════════════════════════════════════
   메인
   ══════════════════════════════════════════ */
export default function ScheduleClient() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleHours>(INITIAL_SCHEDULE);
  const [blocked, setBlocked] = useState<BlockedDate[]>([]);

  /* 불가 날짜 입력 보조 state */
  const [bStart, setBStart] = useState("");
  const [bEnd, setBEnd] = useState("");
  const [bReason, setBReason] = useState("");

  /* 저장 상태 */
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  /* 저장 안 된 변경사항 여부 */
  const [isDirty, setIsDirty] = useState(false);
  /* 이탈 확인 커스텀 모달 */
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  /* ── 로드 ── */
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("pharmacist_profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error || !data) { setSchedule(INITIAL_SCHEDULE); setBlocked([]); setIsDirty(false); return; }
        const r = data as Record<string, unknown>;
        setSchedule(r.schedule_hours ? normalizeSchedule(r.schedule_hours) : INITIAL_SCHEDULE);
        setBlocked(normalizeBlocked(r.blocked_dates));
        setIsDirty(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  /* ── 스케줄 핸들러 (변경 시 dirty 표시) ── */
  const toggleDay = (d: string) => {
    setSchedule({ ...schedule, [d]: { ...schedule[d], on: !schedule[d].on, ranges: schedule[d].on ? [] : [{ start: "10:00", end: "18:00" }] } });
    setIsDirty(true);
  };
  const updateRange = (d: string, i: number, field: "start" | "end", val: string) => {
    const ranges = [...schedule[d].ranges];
    ranges[i] = { ...ranges[i], [field]: val };
    setSchedule({ ...schedule, [d]: { ...schedule[d], ranges } });
    setIsDirty(true);
  };
  const addRange = (d: string) => {
    setSchedule({ ...schedule, [d]: { ...schedule[d], ranges: [...schedule[d].ranges, { start: "14:00", end: "18:00" }] } });
    setIsDirty(true);
  };
  const removeRange = (d: string, i: number) => {
    const ranges = schedule[d].ranges.filter((_, idx) => idx !== i);
    setSchedule({ ...schedule, [d]: { ...schedule[d], ranges, on: ranges.length > 0 } });
    setIsDirty(true);
  };

  /* ── 불가 날짜 핸들러 ── */
  const addBlocked = () => {
    if (!bStart || !bEnd) return;
    setBlocked([...blocked, { id: Date.now(), start: bStart, end: bEnd, reason: bReason.trim() }]);
    setBStart(""); setBEnd(""); setBReason("");
    setIsDirty(true);
  };
  const removeBlocked = (id: number) => {
    setBlocked(blocked.filter((b) => b.id !== id));
    setIsDirty(true);
  };

  /* ── 이탈 경고 (저장 안 한 변경사항 있을 때 브라우저 닫기/새로고침/주소 이동) ── */
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  /* 앱 내 뒤로가기 — dirty면 커스텀 모달, 아니면 바로 진행 */
  const handleBack = () => {
    if (isDirty) { setShowLeaveModal(true); return; }
    router.back();
  };

  /* ── 저장 ── */
  const handleSave = async () => {
    if (saving || !user) return;
    setSaving(true);
    setSaveError(null);
    // 화면 자료구조를 그대로 JSON 컬럼에 저장 (키 매핑/변환 없음)
    const payload = {
      schedule_hours: schedule,
      blocked_dates: blocked,
    };
    const { error } = await (supabase
      .from("pharmacist_profiles") as unknown as {
        update: (p: Record<string, unknown>) => {
          eq: (col: string, val: string) => Promise<{ error: Error | null }>;
        };
      })
      .update(payload)
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      console.error("[schedule] pharmacist_profiles update failed:", error);
      setSaveError("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    setIsDirty(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  return (
    <>
      <style>{`
        .sch-page { min-height: 100dvh; background: ${C.sageBg}; padding-bottom: 40px; }
        .sch-page nav {
          position: sticky; top: 0; z-index: 50;
          padding: 0 24px; height: 60px;
          display: flex; align-items: center; gap: 8px;
          background: rgba(248,249,247,0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid ${C.border};
        }
        .sch-c { max-width: 560px; margin: 0 auto; padding: 20px 16px; }
      `}</style>

      <div className="sch-page">
        <nav>
          <button
            type="button"
            onClick={handleBack}
            aria-label="뒤로가기"
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.textDark, padding: 6, lineHeight: 1 }}
          >←</button>
          <div style={{ flex: 1, textAlign: "center", fontFamily: "'Gothic A1', sans-serif", fontSize: 16, fontWeight: 700, color: C.textDark, marginRight: 36 }}>
            상담 스케줄
          </div>
        </nav>

        <div className="sch-c">
          {loading ? (
            <div style={{ minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: C.textMid }}>
              불러오는 중이에요…
            </div>
          ) : (
            <>
              <div style={card}>
                <div style={secTitle}>상담 스케줄 설정</div>
                <div style={secDesc}>새 상담이 배정되는 시간을 설정합니다. 진행 중인 채팅은 언제든 답변할 수 있어요.</div>

                {/* 요일별 */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {DAYS.map((day) => {
                    const s = schedule[day];
                    return (
                      <div key={day} style={{ padding: "12px 14px", borderRadius: 12, background: s.on ? C.sagePale : C.sageBg, border: `1px solid ${s.on ? C.sageLight : C.border}`, transition: "all 0.15s" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: s.on && s.ranges.length > 0 ? 10 : 0 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: s.on ? C.sageDeep : C.sageMid, width: 24 }}>{day}</span>
                          <Toggle checked={s.on} onChange={() => toggleDay(day)} />
                          {!s.on && <span style={{ fontSize: 14, color: C.sageMid }}>휴무</span>}
                        </div>
                        {s.on && s.ranges.map((r, ri) => (
                          <div key={ri} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                            <select value={r.start} onChange={(e) => updateRange(day, ri, "start", e.target.value)} style={{ ...inp, padding: "6px 8px", fontSize: 14, flex: 1, minWidth: 0 }}>
                              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <span style={{ fontSize: 14, color: C.textMid }}>~</span>
                            <select value={r.end} onChange={(e) => updateRange(day, ri, "end", e.target.value)} style={{ ...inp, padding: "6px 8px", fontSize: 14, flex: 1, minWidth: 0 }}>
                              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <button type="button" onClick={() => removeRange(day, ri)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.sageMid, padding: 4, flexShrink: 0 }}>&times;</button>
                          </div>
                        ))}
                        {s.on && (
                          <button type="button" onClick={() => addRange(day)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.sageMid, padding: "4px 0" }}>+ 시간대 추가</button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 상담 불가 날짜 */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.textDark, marginBottom: 4 }}>상담 불가 날짜</div>
                  <div style={{ ...secDesc, marginBottom: 12 }}>휴가 등으로 상담을 받지 못하는 날짜를 설정해주세요.</div>

                  {blocked.map((b) => (
                    <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: C.terraPale, border: `1px solid ${C.terraLight}`, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark }}>{fmtDate(b.start)} ~ {fmtDate(b.end)}</div>
                        {b.reason && <div style={{ fontSize: 13, color: C.textMid, marginTop: 2 }}>{b.reason}</div>}
                      </div>
                      <button type="button" onClick={() => removeBlocked(b.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.sageMid }}>&times;</button>
                    </div>
                  ))}

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", borderRadius: 10, background: C.sageBg, border: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="date" value={bStart} onChange={(e) => setBStart(e.target.value)} style={{ ...inp, padding: "8px 10px", fontSize: 14, flex: 1, minWidth: 0 }} />
                      <span style={{ fontSize: 14, color: C.textMid }}>~</span>
                      <input type="date" value={bEnd} onChange={(e) => setBEnd(e.target.value)} style={{ ...inp, padding: "8px 10px", fontSize: 14, flex: 1, minWidth: 0 }} />
                    </div>
                    <input placeholder="사유 (선택) 예: 연차 휴가" value={bReason} onChange={(e) => setBReason(e.target.value)} style={{ ...inp, padding: "8px 10px", fontSize: 14 }} />
                    <div style={{ fontSize: 13, color: C.sageMid, marginTop: 2 }}>💡 입력한 사유는 환자에게 표시됩니다</div>
                    <button type="button" onClick={addBlocked} style={{ ...btnS, padding: "8px 0", fontSize: 14, opacity: (!bStart || !bEnd) ? 0.5 : 1 }}>+ 불가 날짜 추가</button>
                  </div>
                </div>
              </div>

              {/* 저장 */}
              {saveError && (
                <div role="alert" style={{ fontSize: 14, color: "#A35A39", background: "#FBF5F1", border: "1px solid #F5E6DC", padding: "10px 14px", borderRadius: 12, marginBottom: 12, lineHeight: 1.5 }}>
                  {saveError}
                </div>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  ...btnP,
                  background: isDirty ? C.terra : C.sageLight,
                  color: C.white,
                  opacity: saving ? 0.7 : 1,
                  cursor: saving ? "not-allowed" : "pointer",
                  boxShadow: isDirty ? "0 4px 14px rgba(192,107,69,0.35)" : "none",
                  transition: "background 0.15s, box-shadow 0.15s",
                }}
              >
                {saving ? "저장 중..." : isDirty ? "• 변경사항 저장" : "저장됨"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 저장 완료 토스트 — 화면 정중앙 */}
      {savedToast && (
        <div
          role="status"
          style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            background: C.sageDeep, color: C.white, padding: "14px 24px", borderRadius: 12,
            fontSize: 15, fontWeight: 700, boxShadow: "0 8px 28px rgba(0,0,0,0.28)", zIndex: 1000,
            fontFamily: "'Noto Sans KR', sans-serif", whiteSpace: "nowrap",
          }}
        >
          스케줄이 저장됐어요 ✓
        </div>
      )}

      {/* 이탈 확인 모달 (저장 안 한 변경사항 있을 때 뒤로가기) */}
      {showLeaveModal && (
        <div
          onClick={() => setShowLeaveModal(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 400,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.white, borderRadius: 16,
              padding: "24px 22px", maxWidth: 320, width: "100%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
              textAlign: "center", fontFamily: "'Noto Sans KR', sans-serif",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark, marginBottom: 6 }}>
              저장하지 않은 변경사항이 있어요
            </div>
            <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6, marginBottom: 16 }}>
              지금 나가면 변경한 내용이 사라져요.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 10,
                  fontSize: 14, fontWeight: 600,
                  background: C.sageBg, color: C.textMid,
                  border: `1px solid ${C.border}`, cursor: "pointer",
                }}
              >취소</button>
              <button
                type="button"
                onClick={() => { setShowLeaveModal(false); router.back(); }}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 10,
                  fontSize: 14, fontWeight: 700,
                  background: C.error, color: C.white,
                  border: "none", cursor: "pointer",
                }}
              >나가기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════
   서브 컴포넌트
   ══════════════════════════════════════════ */
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  const w = 44, h = 24, dot = 20, off = 2;
  return (
    <button type="button" onClick={onChange} style={{ position: "relative", width: w, height: h, borderRadius: h / 2, background: checked ? C.sageDeep : "#D1D5D3", border: "none", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}>
      <div style={{ position: "absolute", top: off, left: checked ? w - dot - off : off, width: dot, height: dot, borderRadius: "50%", background: C.white, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
    </button>
  );
}
