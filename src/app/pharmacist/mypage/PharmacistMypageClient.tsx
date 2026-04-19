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

interface CustomQuestion {
  id: number;
  text: string;
  type: "주관식" | "객관식";
  choices?: string[];
  enabled: boolean;
}

const INITIAL_QUESTIONS: CustomQuestion[] = [
  { id: 1, text: "현재 복용 중인 영양제가 있나요?", type: "주관식", enabled: true },
  { id: 2, text: "하루 평균 카페인 섭취량은?", type: "객관식", choices: ["안 마심", "1~2잔", "3잔 이상"], enabled: true },
  { id: 3, text: "식사는 주로 어떻게 하시나요?", type: "객관식", choices: ["직접 요리", "외식 위주", "배달 위주", "불규칙"], enabled: true },
];

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

  /* ── 맞춤 질문 ── */
  const [qGlobal, setQGlobal] = useState(true);
  const [questions, setQuestions] = useState<CustomQuestion[]>(INITIAL_QUESTIONS);
  const [showQModal, setShowQModal] = useState(false);
  const [qText, setQText] = useState("");
  const [qType, setQType] = useState<"주관식" | "객관식">("주관식");
  const [qChoices, setQChoices] = useState<string[]>(["", ""]);

  const toggleQEnabled = (id: number) => setQuestions(questions.map((q) => q.id === id ? { ...q, enabled: !q.enabled } : q));
  const removeQ = (id: number) => setQuestions(questions.filter((q) => q.id !== id));
  const addQ = () => {
    if (!qText.trim() || questions.length >= 5) return;
    setQuestions([...questions, { id: Date.now(), text: qText.trim(), type: qType, ...(qType === "객관식" ? { choices: qChoices.filter((c) => c.trim()) } : {}), enabled: true }]);
    setQText(""); setQType("주관식"); setQChoices(["", ""]); setShowQModal(false);
  };

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

  /* ── 템플릿 ── */
  const [templates, setTemplates] = useState<Template[]>(INITIAL_TEMPLATES);
  const [showTModal, setShowTModal] = useState(false);
  const [tTitle, setTTitle] = useState("");
  const [tContent, setTContent] = useState("");
  const addT = () => {
    if (!tTitle.trim() || !tContent.trim()) return;
    setTemplates([...templates, { id: Date.now(), title: tTitle.trim(), content: tContent.trim() }]);
    setTTitle(""); setTContent(""); setShowTModal(false);
  };

  /* ── 설정 ── */
  const [remoteOn, setRemoteOn] = useState(false);
  const [notiOn, setNotiOn] = useState(true);
  const [showLogout, setShowLogout] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

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

              {/* ── 4. 맞춤 추가 질문 ── */}
              <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={secTitle}>맞춤 추가 질문</div>
                  <Toggle checked={qGlobal} onChange={() => setQGlobal(!qGlobal)} />
                </div>
                <div style={{ fontSize: 14, color: C.textMid, marginBottom: 14 }}>매칭 수락 시 환자에게 추가 질문 보내기</div>

                {qGlobal && (
                  showEmptyState ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 20px", textAlign: "center" }}>
                      <div style={{ fontSize: 48, marginBottom: 12, lineHeight: 1 }}>❓</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark, marginBottom: 6 }}>아직 추가 질문이 없어요</div>
                      <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.6, marginBottom: 16 }}>환자에게 미리 물어볼 질문을 설정해보세요</div>
                      <button type="button" onClick={() => setShowQModal(true)} style={{ padding: "11px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700, background: C.sageDeep, color: C.white, border: "none", cursor: "pointer" }}>+ 질문 추가</button>
                    </div>
                  ) : (
                  <>
                    <div style={{ ...secDesc, marginBottom: 12 }}>최대 5개까지 설정할 수 있어요.</div>
                    {questions.map((q) => (
                      <div key={q.id} style={{ padding: "14px 16px", borderRadius: 12, background: q.enabled ? C.sageBg : "#f3f3f2", marginBottom: 10, border: `1px solid ${C.border}`, opacity: q.enabled ? 1 : 0.6, transition: "opacity 0.15s" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, color: C.textDark, fontWeight: 500, lineHeight: 1.5, marginBottom: 6 }}>{q.text}</div>
                            <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 13, fontWeight: 600, background: q.type === "주관식" ? C.terraPale : C.sagePale, color: q.type === "주관식" ? C.terraDark : C.sageDeep }}>{q.type}</span>
                            {q.choices && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                                {q.choices.map((ch, ci) => <span key={ci} style={{ fontSize: 13, color: C.textMid, padding: "3px 10px", borderRadius: 6, background: C.white, border: `1px solid ${C.border}` }}>{ch}</span>)}
                              </div>
                            )}
                          </div>
                          <Toggle checked={q.enabled} onChange={() => toggleQEnabled(q.id)} size="small" />
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                          <button type="button" onClick={() => removeQ(q.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.sageMid, padding: "4px 8px" }}>삭제</button>
                        </div>
                      </div>
                    ))}
                    {questions.length < 5 ? (
                      <button type="button" onClick={() => setShowQModal(true)} style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: `1.5px dashed ${C.sageLight}`, background: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, color: C.sageMid }}>+ 질문 추가</button>
                    ) : (
                      <div style={{ fontSize: 13, color: C.terra, textAlign: "center", padding: 8 }}>질문은 최대 5개까지 등록할 수 있어요</div>
                    )}
                  </>
                  )
                )}
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

              {/* ── 6. 답변 템플릿 ── */}
              <div style={card}>
                <div style={secTitle}>답변 템플릿</div>
                <div style={secDesc}>자주 쓰는 답변을 미리 저장해두세요. 채팅에서 빠르게 불러올 수 있습니다.</div>
                {showEmptyState ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 12, lineHeight: 1 }}>💬</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark, marginBottom: 6 }}>아직 저장된 템플릿이 없어요</div>
                    <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.6, marginBottom: 16 }}>자주 쓰는 답변을 저장하면 상담이 빨라져요</div>
                    <button type="button" onClick={() => setShowTModal(true)} style={{ padding: "11px 24px", borderRadius: 12, fontSize: 14, fontWeight: 700, background: C.sageDeep, color: C.white, border: "none", cursor: "pointer" }}>+ 템플릿 추가</button>
                  </div>
                ) : (
                  <>
                    {templates.map((t) => (
                      <div key={t.id} style={{ padding: "14px 16px", borderRadius: 12, background: C.sageBg, marginBottom: 10, border: `1px solid ${C.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: C.textDark, marginBottom: 4 }}>{t.title}</div>
                            <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>{t.content}</div>
                          </div>
                          <button type="button" onClick={() => setTemplates(templates.filter((x) => x.id !== t.id))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: C.sageMid, padding: 4, flexShrink: 0 }}>&times;</button>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => setShowTModal(true)} style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: `1.5px dashed ${C.sageLight}`, background: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, color: C.sageMid }}>+ 템플릿 추가</button>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* ═══ 그리드 끝 ═══ */}

          {/* ── 7. 내 실적 ── */}
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
          </div>

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

      {/* ═══ 모달: 질문 추가 ═══ */}
      {showQModal && (
        <div style={overlay} onClick={() => setShowQModal(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.textDark, marginBottom: 16, fontFamily: "'Gothic A1', sans-serif" }}>추가 질문 등록</div>
            <Field label="질문 내용" value={qText} onChange={setQText} placeholder="예: 평소 운동은 얼마나 하시나요?" />
            <div style={{ height: 14 }} />
            <label style={{ fontSize: 13, fontWeight: 600, color: C.textMid, display: "block", marginBottom: 6 }}>질문 형태</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {(["주관식", "객관식"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setQType(t)} style={{ ...chipBase, flex: 1, textAlign: "center", ...(qType === t ? { background: C.sageDeep, color: C.white, border: `1px solid ${C.sageDeep}` } : {}) }}>{t}</button>
              ))}
            </div>
            {qType === "객관식" && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.textMid, display: "block", marginBottom: 6 }}>선택지 (최소 2개)</label>
                {qChoices.map((ch, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                    <input style={{ ...inp, flex: 1 }} placeholder={`선택지 ${i + 1}`} value={ch} onChange={(e) => { const arr = [...qChoices]; arr[i] = e.target.value; setQChoices(arr); }} />
                    {qChoices.length > 2 && <button type="button" onClick={() => setQChoices(qChoices.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: C.sageMid }}>&times;</button>}
                  </div>
                ))}
                <button type="button" onClick={() => setQChoices([...qChoices, ""])} style={{ fontSize: 14, fontWeight: 600, color: C.sageMid, background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>+ 선택지 추가</button>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" style={btnS} onClick={() => setShowQModal(false)}>취소</button>
              <button type="button" style={{ ...btnP, opacity: qText.trim().length === 0 ? 0.5 : 1 }} onClick={addQ}>등록</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 모달: 템플릿 추가 ═══ */}
      {showTModal && (
        <div style={overlay} onClick={() => setShowTModal(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.textDark, marginBottom: 16, fontFamily: "'Gothic A1', sans-serif" }}>템플릿 추가</div>
            <Field label="제목" value={tTitle} onChange={setTTitle} placeholder="예: 영양제 안내" />
            <div style={{ height: 14 }} />
            <label style={{ fontSize: 13, fontWeight: 600, color: C.textMid, display: "block", marginBottom: 4 }}>내용</label>
            <textarea style={{ ...inp, resize: "vertical", lineHeight: 1.6, minHeight: 100 }} placeholder="템플릿 내용을 입력하세요..." value={tContent} onChange={(e) => setTContent(e.target.value)} rows={4} />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button type="button" style={btnS} onClick={() => setShowTModal(false)}>취소</button>
              <button type="button" style={{ ...btnP, opacity: (!tTitle.trim() || !tContent.trim()) ? 0.5 : 1 }} onClick={addT}>등록</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 확인 모달 ═══ */}
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
