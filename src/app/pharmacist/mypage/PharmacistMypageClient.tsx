"use client";

import { useState, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";

/* ══════════════════════════════════════════
   더미 데이터 & 상수
   ══════════════════════════════════════════ */

const PROFILE = {
  name: "김서연",
  pharmacy: "그린약국",
  license: "제 12345호",
  joinDate: "2026.03.01",
  address: "서울특별시 강남구 테헤란로 123",
};

const ALL_SPECIALTIES = [
  "만성피로", "소화장애", "불면", "비염", "두통",
  "생리통", "여드름", "아토피", "우울·불안", "안구건조",
  "수족냉증", "붓기", "난임·임신준비", "아이성장", "갱년기",
] as const;

const INITIAL_EXPERT = new Set(["만성피로", "불면", "소화장애"]);

const DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

interface TimeRange { start: string; end: string }

const INITIAL_SCHEDULE: Record<string, { on: boolean; ranges: TimeRange[] }> = {
  월: { on: true, ranges: [{ start: "10:00", end: "12:00" }, { start: "14:00", end: "18:00" }] },
  화: { on: true, ranges: [{ start: "10:00", end: "12:00" }, { start: "14:00", end: "18:00" }] },
  수: { on: true, ranges: [{ start: "10:00", end: "18:00" }] },
  목: { on: true, ranges: [{ start: "10:00", end: "12:00" }, { start: "14:00", end: "18:00" }] },
  금: { on: true, ranges: [{ start: "10:00", end: "17:00" }] },
  토: { on: false, ranges: [] },
  일: { on: false, ranges: [] },
};

interface BlockedDate { id: number; start: string; end: string; reason: string }

const INITIAL_BLOCKED: BlockedDate[] = [
  { id: 1, start: "2026-05-01", end: "2026-05-05", reason: "연차 휴가" },
];

interface Template { id: number; title: string; content: string }

const INITIAL_TEMPLATES: Template[] = [
  { id: 1, title: "첫 인사", content: "안녕하세요, 그린약국 김서연 약사입니다. 문답 내용 잘 확인했어요. 궁금한 점 편하게 물어봐 주세요!" },
  { id: 2, title: "방문 안내", content: "약국 방문하시면 더 정확한 상담이 가능해요. 영업시간은 평일 10시~7시입니다." },
];

const STATS = { total: 28, completed: 23, avgTime: "2시간 30분", improved: 12, badge: "개선 확인", nextBadge: "종합 건강관리까지 개선 확인 3개 분야 필요" };

/* ── 개별 문답 세트 ── */
interface QuestionSetSummary {
  id: string;
  name: string;
  questionCount: number;
  isDefault: boolean;
}

const INITIAL_QUESTION_SETS: QuestionSetSummary[] = [
  { id: "set-1", name: "소화 문제용", questionCount: 5, isDefault: true },
  { id: "set-2", name: "수면 문제용", questionCount: 3, isDefault: false },
  { id: "set-3", name: "피로·무기력용", questionCount: 4, isDefault: false },
];

/* ══════════════════════════════════════════
   컬러
   ══════════════════════════════════════════ */

const C = {
  sageBg: "#F8F9F7", sagePale: "#EDF4F0", sageLight: "#B3CCBE",
  sageMid: "#5E7D6C", sageDeep: "#4A6355",
  terra: "#C06B45", terraDark: "#A35A39", terraLight: "#F5E6DC", terraPale: "#FBF5F1",
  textDark: "#2C3630", textMid: "#3D4A42",
  border: "rgba(94, 125, 108, 0.14)", white: "#fff", error: "#D4544C",
};

/* ══════════════════════════════════════════
   공통 인라인 스타일
   ══════════════════════════════════════════ */

const card: React.CSSProperties = { background: C.white, borderRadius: 16, boxShadow: "0 2px 12px rgba(74,99,85,0.07)", padding: 20, marginBottom: 16 };
const secTitle: React.CSSProperties = { fontSize: 17, fontWeight: 700, color: C.textDark, marginBottom: 6, fontFamily: "'Gothic A1', sans-serif" };
const secDesc: React.CSSProperties = { fontSize: 14, color: C.textMid, lineHeight: 1.6, marginBottom: 16 };
const chipBase: React.CSSProperties = { padding: "7px 14px", borderRadius: 100, fontSize: 14, fontWeight: 500, border: `1px solid ${C.border}`, background: C.white, color: C.textMid, cursor: "pointer", transition: "all 0.15s" };
const btnP: React.CSSProperties = { padding: "12px 0", borderRadius: 12, fontSize: 15, fontWeight: 700, background: C.sageDeep, color: C.white, border: "none", cursor: "pointer", width: "100%" };
const btnS: React.CSSProperties = { padding: "12px 0", borderRadius: 12, fontSize: 15, fontWeight: 700, background: C.white, color: C.sageDeep, border: `1.5px solid ${C.sageLight}`, cursor: "pointer", width: "100%" };
const inp: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 15, color: C.textDark, background: C.white, outline: "none", fontFamily: "'Noto Sans KR', sans-serif" };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 };
const modal: React.CSSProperties = { background: C.white, borderRadius: "20px 20px 0 0", padding: "24px 20px", width: "100%", maxWidth: 560, maxHeight: "80dvh", overflowY: "auto" };

/* ══════════════════════════════════════════
   메인 컴포넌트
   ══════════════════════════════════════════ */

function Content() {
  const router = useRouter();
  const showEmptyState = false;

  /* ── 프로필 ── */
  const [editMode, setEditMode] = useState(false);
  const [pName, setPName] = useState(PROFILE.name);
  const [pPharmacy, setPPharmacy] = useState(PROFILE.pharmacy);
  const [pAddress, setPAddress] = useState(PROFILE.address);
  const [saved, setSaved] = useState({ name: PROFILE.name, pharmacy: PROFILE.pharmacy, address: PROFILE.address });
  const cancelEdit = () => { setPName(saved.name); setPPharmacy(saved.pharmacy); setPAddress(saved.address); setEditMode(false); };
  const saveEdit = () => { setSaved({ name: pName, pharmacy: pPharmacy, address: pAddress }); setEditMode(false); };

  /* ── 약국 사진 ── */
  const [pharmacyPhotos, setPharmacyPhotos] = useState<{ file: File; url: string }[]>([]);
  const pGalleryRef = useRef<HTMLInputElement>(null);
  const pCameraRef = useRef<HTMLInputElement>(null);
  const PHARMACY_MAX_PHOTOS = 3;

  const addPharmacyPhotos = (files: FileList | null) => {
    if (!files) return;
    const remaining = PHARMACY_MAX_PHOTOS - pharmacyPhotos.length;
    const newPhotos = Array.from(files).slice(0, remaining).map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setPharmacyPhotos((prev) => [...prev, ...newPhotos]);
  };
  const removePharmacyPhoto = (idx: number) => {
    setPharmacyPhotos((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  /* ── 전문 분야 ── */
  const [expert, setExpert] = useState<Set<string>>(new Set(INITIAL_EXPERT));
  const [available, setAvailable] = useState<Set<string>>(new Set(ALL_SPECIALTIES));

  const toggleExpert = (s: string) => {
    setExpert((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : (n.size < 3 && n.add(s)); return n; });
  };
  const toggleAvailable = (s: string) => {
    setAvailable((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  };
  const allSelected = available.size === ALL_SPECIALTIES.length;
  const toggleAll = () => setAvailable(allSelected ? new Set() : new Set(ALL_SPECIALTIES));

  /* ── 스케줄 ── */
  const [schedule, setSchedule] = useState(INITIAL_SCHEDULE);
  const [blocked, setBlocked] = useState<BlockedDate[]>(INITIAL_BLOCKED);
  const [maxConcurrent, setMaxConcurrent] = useState(5);
  const [bStart, setBStart] = useState("");
  const [bEnd, setBEnd] = useState("");
  const [bReason, setBReason] = useState("");

  const toggleDay = (d: string) => {
    setSchedule({ ...schedule, [d]: { ...schedule[d], on: !schedule[d].on, ranges: schedule[d].on ? [] : [{ start: "10:00", end: "18:00" }] } });
  };
  const updateRange = (d: string, i: number, field: "start" | "end", val: string) => {
    const ranges = [...schedule[d].ranges];
    ranges[i] = { ...ranges[i], [field]: val };
    setSchedule({ ...schedule, [d]: { ...schedule[d], ranges } });
  };
  const addRange = (d: string) => {
    setSchedule({ ...schedule, [d]: { ...schedule[d], ranges: [...schedule[d].ranges, { start: "14:00", end: "18:00" }] } });
  };
  const removeRange = (d: string, i: number) => {
    const ranges = schedule[d].ranges.filter((_, idx) => idx !== i);
    setSchedule({ ...schedule, [d]: { ...schedule[d], ranges, on: ranges.length > 0 } });
  };
  const addBlocked = () => {
    if (!bStart || !bEnd) return;
    setBlocked([...blocked, { id: Date.now(), start: bStart, end: bEnd, reason: bReason.trim() }]);
    setBStart(""); setBEnd(""); setBReason("");
  };
  const removeBlocked = (id: number) => setBlocked(blocked.filter((b) => b.id !== id));

  /* ── 템플릿 (개수만 표시, 관리 페이지로 이동) ── */
  const [templates] = useState<Template[]>(INITIAL_TEMPLATES);

  /* ── 설정 ── */
  const [remoteOn, setRemoteOn] = useState(false);
  const [notiOn, setNotiOn] = useState(true);
  const [showLogout, setShowLogout] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  /* ── 개별 문답 세트 ── */
  const [questionSets, setQuestionSets] = useState<QuestionSetSummary[]>(INITIAL_QUESTION_SETS);
  const [deleteSetId, setDeleteSetId] = useState<string | null>(null);

  const duplicateSet = (id: string) => {
    const src = questionSets.find((s) => s.id === id);
    if (!src) return;
    const newSet: QuestionSetSummary = {
      id: `set-${Date.now()}`,
      name: `복사본 - ${src.name}`,
      questionCount: src.questionCount,
      isDefault: false,
    };
    setQuestionSets((prev) => [...prev, newSet]);
  };

  const confirmDeleteSet = () => {
    if (!deleteSetId) return;
    setQuestionSets((prev) => prev.filter((s) => s.id !== deleteSetId));
    setDeleteSetId(null);
  };

  /* ── 날짜 포맷 ── */
  const fmtDate = (d: string) => d.replace(/-/g, ".");

  return (
    <>
      <style>{`
        .pm-page { min-height:100dvh; background:${C.sageBg}; padding-bottom:24px; }
        .pm-page nav { position:sticky; top:0; z-index:50; padding:0 24px; height:60px; display:flex; align-items:center; background:rgba(248,249,247,0.95); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border-bottom:1px solid ${C.border}; }
        .pm-c { max-width:560px; margin:0 auto; padding:20px 16px; }
        .pm-g { display:flex; flex-direction:column; gap:0; }
        @media(min-width:1200px){
          .pm-c { max-width:960px; padding:28px 24px; }
          .pm-g { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
          .pm-g>*{ min-width:0; }
        }
      `}</style>

      <div className="pm-page" style={{ paddingBottom: 80 }}>
        {/* ── 1. 헤더 ── */}
        <nav>
          <button className="nav-back" onClick={() => router.back()} aria-label="뒤로가기">←</button>
          <div style={{ flex: 1, textAlign: "center", fontFamily: "'Gothic A1', sans-serif", fontSize: 16, fontWeight: 700, color: C.textDark, marginRight: 36 }}>내 정보</div>
        </nav>

        <div className="pm-c">
          {/* ── 2. 프로필 ── */}
          <div style={card}>
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
              <div style={{ width: 80, height: 80, borderRadius: "50%", background: C.sagePale, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 700, color: C.sageDeep, flexShrink: 0 }}>
                {saved.name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                {!editMode ? (
                  <>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.sageDeep, fontFamily: "'Gothic A1', sans-serif", marginBottom: 2 }}>{saved.name} 약사</div>
                    <div style={{ fontSize: 15, color: C.textMid, marginBottom: 2 }}>{saved.pharmacy}</div>
                    <div style={{ fontSize: 14, color: C.textMid }}>면허번호 {PROFILE.license}</div>
                    <div style={{ fontSize: 13, color: C.sageMid, marginTop: 4 }}>가입일 {PROFILE.joinDate}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.sageDeep }}>프로필 수정 중</div>
                )}
              </div>
            </div>
            {editMode ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Field label="이름" value={pName} onChange={setPName} />
                <Field label="약국명" value={pPharmacy} onChange={setPPharmacy} />
                <Field label="약국 주소" value={pAddress} onChange={setPAddress} />
                <div style={{ fontSize: 14, color: C.textMid, padding: "10px 14px", background: C.sagePale, borderRadius: 8 }}>면허번호: {PROFILE.license}</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" style={btnS} onClick={cancelEdit}>취소</button>
                  <button type="button" style={btnP} onClick={saveEdit}>저장</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 14, color: C.textMid, marginBottom: 12 }}><span style={{ color: C.sageMid }}>주소</span> {saved.address}</div>
                <button type="button" onClick={() => setEditMode(true)} style={{ ...btnS, padding: "10px 0" }}>프로필 수정</button>
              </>
            )}
          </div>

          {/* ── 약국 사진 ── */}
          <div style={card}>
            <div style={secTitle}>약국 사진</div>
            <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.6, marginBottom: 14 }}>
              환자가 약국 분위기를 미리 볼 수 있어요 (최대 {PHARMACY_MAX_PHOTOS}장)
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => pGalleryRef.current?.click()}
                disabled={pharmacyPhotos.length >= PHARMACY_MAX_PHOTOS}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  background: C.sagePale,
                  color: C.sageDeep,
                  border: "none",
                  cursor: pharmacyPhotos.length >= PHARMACY_MAX_PHOTOS ? "not-allowed" : "pointer",
                  opacity: pharmacyPhotos.length >= PHARMACY_MAX_PHOTOS ? 0.5 : 1,
                }}
              >
                🖼 갤러리
              </button>
              <button
                type="button"
                onClick={() => pCameraRef.current?.click()}
                disabled={pharmacyPhotos.length >= PHARMACY_MAX_PHOTOS}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  background: C.sagePale,
                  color: C.sageDeep,
                  border: "none",
                  cursor: pharmacyPhotos.length >= PHARMACY_MAX_PHOTOS ? "not-allowed" : "pointer",
                  opacity: pharmacyPhotos.length >= PHARMACY_MAX_PHOTOS ? 0.5 : 1,
                }}
              >
                📸 카메라
              </button>
            </div>

            <input
              ref={pGalleryRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => { addPharmacyPhotos(e.target.files); e.target.value = ""; }}
            />
            <input
              ref={pCameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => { addPharmacyPhotos(e.target.files); e.target.value = ""; }}
            />

            {pharmacyPhotos.length > 0 && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                {pharmacyPhotos.map((p, i) => (
                  <div key={i} style={{ position: "relative", width: 90, height: 90, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}` }}>
                    <img src={p.url} alt={`약국 사진 ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button
                      type="button"
                      onClick={() => removePharmacyPhoto(i)}
                      style={{
                        position: "absolute", top: 4, right: 4,
                        width: 22, height: 22, borderRadius: "50%",
                        background: "rgba(0,0,0,0.55)", color: "#fff",
                        border: "none", fontSize: 13, lineHeight: "22px",
                        textAlign: "center", cursor: "pointer", padding: 0,
                      }}
                      aria-label={`약국 사진 ${i + 1} 삭제`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: 13, color: C.sageMid }}>
              {pharmacyPhotos.length}/{PHARMACY_MAX_PHOTOS}장
            </div>
          </div>

          {/* ── 내 실적 (약국 사진 아래, 전문 분야 위) ── */}
          <div style={card}>
            <div style={secTitle}>내 실적</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <StatBox label="총 상담" value={`${STATS.total}건`} />
              <StatBox label="완료" value={`${STATS.completed}건`} />
              <StatBox label="평균 답변 시간" value={STATS.avgTime} />
              <StatBox label="개선 확인" value={`${STATS.improved}건`} accent />
            </div>
            <div style={{ padding: "14px 16px", borderRadius: 12, background: `linear-gradient(135deg, ${C.terraPale} 0%, ${C.white} 100%)`, border: `1px solid ${C.terraLight}`, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>&#11088;</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.terraDark }}>현재 뱃지: {STATS.badge}</span>
              </div>
              <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.5 }}>다음 목표: {STATS.nextBadge}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <button
                type="button"
                onClick={() => router.push("/pharmacist/performance")}
                style={{
                  background: "none", border: "none",
                  padding: "4px 0",
                  fontSize: 14, fontWeight: 600,
                  color: C.sageMid,
                  cursor: "pointer",
                  fontFamily: "'Noto Sans KR', sans-serif",
                }}
              >
                상세 보기 →
              </button>
            </div>
          </div>

          {/* ═══ 2열 그리드 ═══ */}
          <div className="pm-g">
            {/* ── 좌측 ── */}
            <div>
              {/* ── 3. 전문 분야 ── */}
              <div style={card}>
                <div style={secTitle}>전문 분야 설정</div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.textDark, marginBottom: 4 }}>전문 분야 <span style={{ fontSize: 13, color: C.terra, fontWeight: 500 }}>최대 3개</span></div>
                  <div style={secDesc}>특히 자신 있는 분야를 선택해주세요. 환자 카드에 &#10022; 전문 표시됩니다.</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {ALL_SPECIALTIES.map((s) => {
                      const sel = expert.has(s);
                      return <button key={s} type="button" onClick={() => toggleExpert(s)} style={{ ...chipBase, ...(sel ? { background: C.terra, color: C.white, border: `1px solid ${C.terra}` } : {}) }}>{sel && "✦ "}{s}</button>;
                    })}
                  </div>
                  {expert.size >= 3 && <div style={{ fontSize: 13, color: C.terra, marginTop: 8 }}>전문 분야는 최대 3개까지 선택할 수 있어요</div>}
                </div>

                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.textDark, marginBottom: 4 }}>상담 가능 분야</div>
                  <div style={secDesc}>상담할 수 있는 모든 분야를 선택해주세요. 매칭에 반영됩니다.</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button type="button" onClick={toggleAll} style={{ ...chipBase, fontWeight: 700, ...(allSelected ? { background: C.sageDeep, color: C.white, border: `1px solid ${C.sageDeep}` } : {}) }}>전체</button>
                    {ALL_SPECIALTIES.map((s) => {
                      const sel = available.has(s);
                      return <button key={s} type="button" onClick={() => toggleAvailable(s)} style={{ ...chipBase, ...(sel ? { background: C.sagePale, color: C.sageDeep, border: `1px solid ${C.sageLight}`, fontWeight: 600 } : {}) }}>{s}</button>;
                    })}
                  </div>
                </div>
              </div>

              {/* ── 4. 맞춤 추가 문답 (세트 기반) ── */}
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
                  <div style={secTitle}>맞춤 추가 문답</div>
                  {questionSets.length > 0 && (
                    <button
                      type="button"
                      onClick={() => router.push("/pharmacist/questionnaire/new")}
                      style={{
                        padding: "8px 14px", borderRadius: 10,
                        fontSize: 14, fontWeight: 700,
                        background: C.sageDeep, color: C.white,
                        border: "none", cursor: "pointer",
                      }}
                    >
                      + 새 세트 만들기
                    </button>
                  )}
                </div>
                <div style={{ ...secDesc, marginBottom: 14 }}>
                  자주 묻는 문답을 세트로 만들어 환자에게 보낼 수 있어요. ★ 기본 세트는 매칭 수락 후 자동 전송돼요.
                </div>

                {questionSets.length === 0 ? (
                  <div style={{
                    padding: "28px 20px", borderRadius: 12,
                    background: C.sageBg, border: `1px dashed ${C.sageLight}`,
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark, marginBottom: 4 }}>
                      아직 만든 문답 세트가 없어요
                    </div>
                    <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.6, marginBottom: 14 }}>
                      자주 묻는 문답을 세트로 만들어 환자에게 보낼 수 있어요
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push("/pharmacist/questionnaire/new")}
                      style={{
                        padding: "10px 18px", borderRadius: 10,
                        fontSize: 14, fontWeight: 700,
                        background: C.sageDeep, color: C.white,
                        border: "none", cursor: "pointer",
                      }}
                    >
                      + 새 세트 만들기
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {questionSets.map((s) => (
                      <div key={s.id} style={{
                        background: C.white, border: `1px solid ${C.border}`,
                        borderRadius: 16, padding: 16,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>{s.name}</span>
                          {s.isDefault && (
                            <span style={{
                              padding: "2px 8px", borderRadius: 8,
                              fontSize: 13, fontWeight: 700,
                              background: "#FFF8E1", color: "#F59E0B",
                              display: "inline-flex", alignItems: "center", gap: 3,
                            }}>
                              ★ 기본 세트
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 14, color: C.textMid, marginBottom: 12 }}>
                          문답 {s.questionCount}개
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => router.push(`/pharmacist/questionnaire/${s.id}`)}
                            style={{
                              padding: "6px 14px", borderRadius: 8,
                              fontSize: 14, fontWeight: 600,
                              background: C.sagePale, color: C.sageMid,
                              border: `1px solid ${C.sageLight}`, cursor: "pointer",
                            }}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateSet(s.id)}
                            style={{
                              padding: "6px 14px", borderRadius: 8,
                              fontSize: 14, fontWeight: 600,
                              background: C.white, color: C.sageMid,
                              border: `1px solid ${C.border}`, cursor: "pointer",
                            }}
                          >
                            복제
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteSetId(s.id)}
                            style={{
                              padding: "6px 14px", borderRadius: 8,
                              fontSize: 14, fontWeight: 600,
                              background: C.white, color: C.error,
                              border: `1px solid ${C.border}`, cursor: "pointer",
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── 답변 템플릿 (맞춤 추가 문답 아래, 좌측 열) ── */}
              <div style={card}>
                <div style={secTitle}>답변 템플릿</div>
                <div style={{ ...secDesc, marginBottom: 12 }}>
                  자주 쓰는 답변을 미리 저장해두세요.
                </div>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 10, flexWrap: "wrap",
                  padding: "12px 14px",
                  background: C.sageBg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>💬</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.textDark }}>
                      {templates.length}개 저장됨
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/pharmacist/templates")}
                    style={{
                      padding: "7px 14px", borderRadius: 8,
                      fontSize: 14, fontWeight: 600,
                      background: C.sagePale, color: C.sageDeep,
                      border: `1px solid ${C.sageLight}`, cursor: "pointer",
                      fontFamily: "'Noto Sans KR', sans-serif",
                    }}
                  >
                    템플릿 관리 →
                  </button>
                </div>
              </div>
            </div>

            {/* ── 우측 ── */}
            <div>
              {/* ── 5. 상담 스케줄 ── */}
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
                            <input type="time" value={r.start} onChange={(e) => updateRange(day, ri, "start", e.target.value)} style={{ ...inp, padding: "6px 8px", fontSize: 14, flex: 1, minWidth: 0 }} />
                            <span style={{ fontSize: 14, color: C.textMid }}>~</span>
                            <input type="time" value={r.end} onChange={(e) => updateRange(day, ri, "end", e.target.value)} style={{ ...inp, padding: "6px 8px", fontSize: 14, flex: 1, minWidth: 0 }} />
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

                {/* 최대 동시 상담 */}
                <div style={{ padding: "14px 16px", borderRadius: 12, background: C.sageBg, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, marginBottom: 4 }}>최대 동시 상담 수</div>
                  <div style={{ fontSize: 14, color: C.textMid, marginBottom: 10 }}>한 번에 진행할 수 있는 상담 수를 제한합니다</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <RoundBtn label="−" onClick={() => setMaxConcurrent(Math.max(1, maxConcurrent - 1))} />
                    <span style={{ fontSize: 22, fontWeight: 800, color: C.sageDeep, minWidth: 32, textAlign: "center" }}>{maxConcurrent}</span>
                    <RoundBtn label="+" onClick={() => setMaxConcurrent(Math.min(10, maxConcurrent + 1))} />
                    <span style={{ fontSize: 14, color: C.textMid }}>건</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
          {/* ═══ 그리드 끝 ═══ */}

          {/* ── 8. 설정 ── */}
          <div style={card}>
            <div style={secTitle}>설정</div>
            <SettingToggle label="원격 상담" sub="Phase 2에서 오픈 예정" checked={remoteOn} onChange={() => setRemoteOn(!remoteOn)} disabled />
            <SettingToggle label="알림 설정" checked={notiOn} onChange={() => setNotiOn(!notiOn)} />
            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 12 }}>
              <SettingLink label="이용약관" />
              <SettingLink label="개인정보처리방침" />
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 12 }}>
              <button type="button" onClick={() => setShowLogout(true)} style={{ width: "100%", textAlign: "left", padding: "12px 0", background: "none", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 600, color: C.textDark }}>로그아웃</button>
              <button type="button" onClick={() => setShowWithdraw(true)} style={{ width: "100%", textAlign: "left", padding: "12px 0", background: "none", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 600, color: C.error }}>회원 탈퇴</button>
            </div>
            <div style={{ fontSize: 13, color: C.sageMid, textAlign: "center", marginTop: 12 }}>약사톡 v0.1.0</div>
          </div>
        </div>
      </div>

      {/* ═══ 확인 모달 ═══ */}
      {deleteSetId && <ConfirmModal title="이 세트를 삭제하시겠습니까?" desc="삭제된 세트는 복구할 수 없어요." onCancel={() => setDeleteSetId(null)} onConfirm={confirmDeleteSet} confirmLabel="삭제" danger />}
      {showLogout && <ConfirmModal title="로그아웃 하시겠습니까?" desc="다시 로그인하면 이용할 수 있어요." onCancel={() => setShowLogout(false)} onConfirm={() => { setShowLogout(false); router.push("/"); }} confirmLabel="로그아웃" />}
      {showWithdraw && <ConfirmModal title="정말 탈퇴하시겠습니까?" desc="탈퇴 시 모든 상담 기록과 데이터가 영구 삭제되며 복구할 수 없습니다." onCancel={() => setShowWithdraw(false)} onConfirm={() => { setShowWithdraw(false); router.push("/"); }} confirmLabel="탈퇴하기" danger />}
    </>
  );
}

/* ══════════════════════════════════════════
   서브 컴포넌트
   ══════════════════════════════════════════ */

function Toggle({ checked, onChange, size }: { checked: boolean; onChange: () => void; size?: "small" }) {
  const w = size === "small" ? 36 : 44;
  const h = size === "small" ? 20 : 24;
  const dot = size === "small" ? 16 : 20;
  const off = 2;
  return (
    <button type="button" onClick={onChange} style={{ position: "relative", width: w, height: h, borderRadius: h / 2, background: checked ? C.sageDeep : "#D1D5D3", border: "none", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}>
      <div style={{ position: "absolute", top: off, left: checked ? w - dot - off : off, width: dot, height: dot, borderRadius: "50%", background: C.white, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
    </button>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: C.textMid, display: "block", marginBottom: 4 }}>{label}</label>
      <input style={inp} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ padding: "14px 16px", borderRadius: 12, background: accent ? C.sagePale : C.sageBg, border: `1px solid ${accent ? C.sageLight : C.border}` }}>
      <div style={{ fontSize: 13, color: C.sageMid, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent ? C.sageDeep : C.textDark }}>{value}</div>
    </div>
  );
}

function RoundBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ width: 36, height: 36, borderRadius: "50%", border: `1.5px solid ${C.sageLight}`, background: C.white, cursor: "pointer", fontSize: 18, fontWeight: 700, color: C.sageDeep, display: "flex", alignItems: "center", justifyContent: "center" }}>{label}</button>
  );
}

function SettingToggle({ label, sub, checked, onChange, disabled }: { label: string; sub?: string; checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 500, color: disabled ? C.sageMid : C.textDark }}>{label}</div>
        {sub && <div style={{ fontSize: 13, color: C.sageMid, marginTop: 2 }}>{sub}</div>}
      </div>
      <button type="button" onClick={disabled ? undefined : onChange} style={{ position: "relative", width: 44, height: 24, borderRadius: 12, background: checked ? C.sageDeep : "#D1D5D3", border: "none", cursor: disabled ? "not-allowed" : "pointer", flexShrink: 0, transition: "background 0.2s", opacity: disabled ? 0.5 : 1 }}>
        <div style={{ position: "absolute", top: 2, left: checked ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: C.white, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
      </button>
    </div>
  );
}

function SettingLink({ label }: { label: string }) {
  return (
    <button type="button" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", background: "none", border: "none", cursor: "pointer" }}>
      <span style={{ fontSize: 15, color: C.textDark }}>{label}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.sageMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
    </button>
  );
}

function ConfirmModal({ title, desc, onCancel, onConfirm, confirmLabel, danger }: { title: string; desc: string; onCancel: () => void; onConfirm: () => void; confirmLabel: string; danger?: boolean }) {
  return (
    <div style={overlay} onClick={onCancel}>
      <div style={{ ...modal, borderRadius: 20, textAlign: "center", padding: "32px 24px" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 17, fontWeight: 700, color: danger ? C.error : C.textDark, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 14, color: C.textMid, marginBottom: 20, lineHeight: 1.6 }}>{desc}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" style={btnS} onClick={onCancel}>취소</button>
          <button type="button" style={{ ...btnP, ...(danger ? { background: C.error } : {}) }} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   Export
   ══════════════════════════════════════════ */

export default function PharmacistMypageClient() {
  return <Suspense><Content /></Suspense>;
}
