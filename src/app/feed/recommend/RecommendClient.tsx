"use client";

import { useState, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";

/* ════════════��═════════════════════════════
   상수 & 더미
   ═════════════��════════════════════════════ */

const PHARMACIST = { name: "김서연", pharmacy: "그린약국", career: "15년차" };

type TagVariant = "sage" | "terra" | "lavender" | "rose" | "blue" | "muted";

interface SymptomOption { label: string; variant: TagVariant }

const SYMPTOM_OPTIONS: SymptomOption[] = [
  { label: "만성피로", variant: "terra" },
  { label: "소화장애", variant: "sage" },
  { label: "불면", variant: "lavender" },
  { label: "비염", variant: "blue" },
  { label: "두통", variant: "terra" },
  { label: "생리통", variant: "rose" },
  { label: "여드름", variant: "rose" },
  { label: "아토피", variant: "rose" },
  { label: "우울·불안", variant: "lavender" },
  { label: "안구건조", variant: "blue" },
  { label: "수족냉증", variant: "blue" },
  { label: "붓기", variant: "sage" },
  { label: "관절통", variant: "blue" },
  { label: "난임", variant: "rose" },
  { label: "집중력 저하", variant: "terra" },
  { label: "기타", variant: "muted" },
];

const GENDERS = ["남성", "여성"] as const;
const AGE_GROUPS = ["10대", "20대", "30대", "40대", "50대", "60대 이상"] as const;
const DURATION_OPTIONS = ["2주 이내", "2~4주", "1~2개월", "2~3개월", "3~6개월", "6개월 이상"] as const;

const MAX_TITLE = 50;
const MIN_BODY = 100;
const MAX_PHOTOS = 5;
const MAX_CHANGES = 3;

interface Change { before: string; after: string }

const C = {
  sageBg: "#F8F9F7", sagePale: "#EDF4F0", sageLight: "#B3CCBE",
  sageMid: "#5E7D6C", sageDeep: "#4A6355",
  terra: "#C06B45", terraLight: "#F5E6DC", terraPale: "#FBF5F1",
  textDark: "#2C3630", textMid: "#3D4A42",
  border: "rgba(94, 125, 108, 0.14)", white: "#fff",
};

/* ═════���════════════════════════════════════
   메인 ��포넌트
   ════��══════════════════════��══════════════ */

function RecommendContent() {
  const router = useRouter();

  /* 대상 */
  const [targetType, setTargetType] = useState<"self" | "family" | "">("");
  const [familyAge, setFamilyAge] = useState("");
  const [familyGender, setFamilyGender] = useState("");

  /* 증상 */
  const [symptoms, setSymptoms] = useState<Set<string>>(new Set());
  const toggleSymptom = (label: string) => {
    setSymptoms((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : (next.size < 3 && next.add(label));
      return next;
    });
  };

  /* 제목 & ���문 */
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  /* 전/후 변화 */
  const [changes, setChanges] = useState<Change[]>([{ before: "", after: "" }]);
  const updateChange = (idx: number, field: "before" | "after", val: string) => {
    setChanges((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  };
  const addChange = () => {
    if (changes.length < MAX_CHANGES) setChanges((prev) => [...prev, { before: "", after: "" }]);
  };
  const removeChange = (idx: number) => {
    if (changes.length > 1) setChanges((prev) => prev.filter((_, i) => i !== idx));
  };

  /* 기간 */
  const [duration, setDuration] = useState("");

  /* 경력 */
  const [career, setCareer] = useState(PHARMACIST.career + " 약사");

  /* 사진 */
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_PHOTOS - photos.length;
    const newPhotos = Array.from(files).slice(0, remaining).map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
  };
  const removePhoto = (idx: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  /* UI */
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleSubmit = () => {
    setShowConfirm(false);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      router.push("/feed");
    }, 2000);
  };

  /* 대상 텍스트 */
  const targetText = targetType === "self"
    ? "약사 본인"
    : targetType === "family"
      ? `약사 가족${familyAge || familyGender ? ` (${[familyAge, familyGender].filter(Boolean).join(" ")})` : ""}`
      : "";

  /* 선택된 증상 데이터 */
  const selectedSymptomData = SYMPTOM_OPTIONS.filter((s) => symptoms.has(s.label));

  return (
    <>
      {/* 데스크톱 반응형 */}
      <style>{`
        @media (min-width: 1200px) {
          .fn-container { max-width: 960px !important; }
          .fn-bottom-inner { max-width: 960px !important; }
          .rc-preview-photos {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
      `}</style>

      <div className="fn-page">
        {/* ── 1. 헤더 ── */}
        <nav>
          <button className="nav-back" onClick={() => router.back()} aria-label="뒤로가기">
            ←
          </button>
          <div className="nav-title">약사의 이야기 작성</div>
        </nav>

        <div className="fn-container">
          {/* ── 2. 안내 카드 ── */}
          <div className="fn-guide-card">
            <div className="fn-guide-title">💊 약사로서 경험한 개선 이야기를 공유해주세요</div>
            <p className="fn-guide-desc">
              본인이나 가족의 실제 개선 경험을 작성해주세요.
            </p>
            <p className="fn-guide-warn">
              구체적인 제품명 대신 성분 방향으로 작성해주세요.
            </p>
          </div>

          {/* ─��� 3. 대상 선택 ── */}
          <section className="fn-section">
            <h2 className="fn-section-title">
              대상 <span className="fn-required">*</span>
            </h2>
            <p className="fn-field-hint">누구의 이야기인가요?</p>
            <div className="fn-chip-row">
              <button
                type="button"
                className={`fn-chip${targetType === "self" ? " selected" : ""}`}
                onClick={() => setTargetType("self")}
              >
                본인
              </button>
              <button
                type="button"
                className={`fn-chip${targetType === "family" ? " selected" : ""}`}
                onClick={() => setTargetType("family")}
              >
                가족
              </button>
            </div>

            {targetType === "family" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
                {/* 연령대 */}
                <div>
                  <div className="fn-field-label">연령대</div>
                  <div className="fn-chip-row wrap">
                    {AGE_GROUPS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        className={`fn-chip${familyAge === a ? " selected" : ""}`}
                        onClick={() => setFamilyAge(a)}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                {/* 성별 */}
                <div>
                  <div className="fn-field-label">���별</div>
                  <div className="fn-chip-row">
                    {GENDERS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        className={`fn-chip${familyGender === g ? " selected" : ""}`}
                        onClick={() => setFamilyGender(g)}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ── 4. 증상 태그 ── */}
          <section className="fn-section">
            <h2 className="fn-section-title">
              주요 증상 <span className="fn-required">*</span>
            </h2>
            <p className="fn-field-hint">최대 3개까지 선택할 수 있어요</p>
            <div className="fn-chip-row wrap">
              {SYMPTOM_OPTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className={`fn-symptom-chip${symptoms.has(s.label) ? ` active-${s.variant}` : ""}`}
                  onClick={() => toggleSymptom(s.label)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          {/* ── 5. 글 제목 ── */}
          <section className="fn-section">
            <h2 className="fn-section-title">
              글 제목 <span className="fn-required">*</span>
            </h2>
            <input
              type="text"
              className="fn-input"
              placeholder="예: 태어날 때부터 아토피였던 딸, 6개월 만에 연고를 끊었어요"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
            />
            <div className="fn-char-count">{title.length}/{MAX_TITLE}</div>
          </section>

          {/* ── 6. 전/후 변화 ── */}
          <section className="fn-section">
            <h2 className="fn-section-title">
              전/후 변화 <span className="fn-required">*</span>
            </h2>
            <p className="fn-field-hint">핵심 변화를 한 줄로 요약해주세요 (최대 {MAX_CHANGES}개)</p>

            {changes.map((ch, i) => (
              <div
                key={i}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: C.sagePale,
                  marginBottom: 10,
                  position: "relative",
                }}
              >
                {changes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeChange(i)}
                    style={{
                      position: "absolute", top: 8, right: 8,
                      width: 22, height: 22, borderRadius: "50%",
                      background: "rgba(0,0,0,0.12)", color: C.textMid,
                      border: "none", fontSize: 13, lineHeight: "22px",
                      textAlign: "center", cursor: "pointer", padding: 0,
                    }}
                    aria-label={`변화 ${i + 1} 삭제`}
                  >
                    ✕
                  </button>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>😫</span>
                  <input
                    type="text"
                    className="fn-input"
                    placeholder="예: 긁어서 피가 날 정도였어요"
                    value={ch.before}
                    onChange={(e) => updateChange(i, "before", e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>😊</span>
                  <input
                    type="text"
                    className="fn-input"
                    placeholder="예: 연고 없이 지내요"
                    value={ch.after}
                    onChange={(e) => updateChange(i, "after", e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
            ))}

            {changes.length < MAX_CHANGES && (
              <button
                type="button"
                onClick={addChange}
                style={{
                  width: "100%",
                  padding: "10px 0",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  background: "none",
                  color: C.sageDeep,
                  border: `1px dashed ${C.sageLight}`,
                  cursor: "pointer",
                }}
              >
                + 변화 추가
              </button>
            )}
          </section>

          {/* ── 7. 개선 기간 ─�� */}
          <section className="fn-section">
            <h2 className="fn-section-title">
              개선 기간 <span className="fn-required">*</span>
            </h2>
            <div className="fn-chip-row wrap">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`fn-chip${duration === d ? " selected" : ""}`}
                  onClick={() => setDuration(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </section>

          {/* ── 8. 본문 ── */}
          <section className="fn-section">
            <h2 className="fn-section-title">
              본문 <span className="fn-required">*</span>
            </h2>
            <textarea
              className="fn-textarea"
              placeholder="약사로서의 경험과 노하우를 자유롭게 작성해주세요. 어떤 계기로 시작했는지, 어떤 변화가 있었는지 등을 포함하면 좋아요."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
            />
            <div className="fn-char-count">
              {body.length}자{body.length < MIN_BODY && ` (최소 ${MIN_BODY}자)`}
            </div>
          </section>

          {/* ── 9. 사진 첨부 ── */}
          <section className="fn-section">
            <h2 className="fn-section-title">📷 사진 첨부</h2>
            <p className="fn-field-hint">최대 {MAX_PHOTOS}장까지 첨부할 수 있어요 (선택)</p>

            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                disabled={photos.length >= MAX_PHOTOS}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 10,
                  fontSize: 14, fontWeight: 600,
                  background: C.sagePale, color: C.sageDeep, border: "none",
                  cursor: photos.length >= MAX_PHOTOS ? "not-allowed" : "pointer",
                  opacity: photos.length >= MAX_PHOTOS ? 0.5 : 1,
                }}
              >
                🖼 갤러리
              </button>
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                disabled={photos.length >= MAX_PHOTOS}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 10,
                  fontSize: 14, fontWeight: 600,
                  background: C.sagePale, color: C.sageDeep, border: "none",
                  cursor: photos.length >= MAX_PHOTOS ? "not-allowed" : "pointer",
                  opacity: photos.length >= MAX_PHOTOS ? 0.5 : 1,
                }}
              >
                📸 카메라
              </button>
            </div>

            <input ref={galleryRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />

            {photos.length > 0 && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                {photos.map((p, i) => (
                  <div key={i} style={{ position: "relative", width: 80, height: 80, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
                    <img src={p.url} alt={`사진 ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      style={{
                        position: "absolute", top: 4, right: 4,
                        width: 22, height: 22, borderRadius: "50%",
                        background: "rgba(0,0,0,0.55)", color: "#fff",
                        border: "none", fontSize: 13, lineHeight: "22px",
                        textAlign: "center", cursor: "pointer", padding: 0,
                      }}
                      aria-label={`사진 ${i + 1} 삭제`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: 14, color: C.textMid, marginTop: 4 }}>
              영양제 실물 사진이 있으면 신뢰도가 올라가요
            </div>
            <div style={{ fontSize: 13, color: C.sageMid, marginTop: 4 }}>
              {photos.length}/{MAX_PHOTOS}장
            </div>
          </section>

          {/* ���─ 10. 경력 표시 ── */}
          <section className="fn-section">
            <h2 className="fn-section-title">경력 표시 설정</h2>
            <p className="fn-field-hint">글 상단에 경력이 함께 표시됩니다</p>
            <input
              type="text"
              className="fn-input"
              placeholder="예: 15년차 약사"
              value={career}
              onChange={(e) => setCareer(e.target.value)}
            />
          </section>

          {/* 면책 안내 */}
          <div style={{
            padding: "12px 16px", borderRadius: 10,
            background: C.terraPale, fontSize: 13, color: C.terra,
            lineHeight: 1.6, textAlign: "center", marginTop: 4,
          }}>
            등록 시 자동 포함: &quot;개인의 경험이며, 같은 증상이라도 사람마다 원인이 다릅니다. 정확한 분석은 전문 약사와 상담하세요.&quot;
          </div>

          {/* ── 하단 버튼 ── */}
          <div style={{
            background: "rgba(248,249,247,0.95)",
            borderTop: "1px solid rgba(94,125,108,0.14)",
            padding: "14px 0",
            marginTop: 8,
          }}>
            <div className="fn-bottom-inner">
              <button className="fn-btn secondary" onClick={() => setShowPreview(true)} type="button">
                미리보기
              </button>
              <button className="fn-btn primary" onClick={() => setShowConfirm(true)} type="button">
                등록하기
              </button>
            </div>
          </div>

          {/* 네비게이션 바 여백 */}
          <div style={{ height: 80 }} />
        </div>

        {/* ── 미리보기 모달 ── */}
        {showPreview && (
          <div className="fn-modal-overlay" onClick={() => setShowPreview(false)}>
            <div className="fn-modal" onClick={(e) => e.stopPropagation()}>
              <div className="fn-modal-scroll">
                <article className="feed-card" style={{ margin: 0, boxShadow: "none" }}>
                  {/* 약사 프로필 */}
                  <div className="feed-card-header">
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: C.sagePale, display: "flex",
                      alignItems: "center", justifyContent: "center",
                      fontSize: 18, fontWeight: 700, color: C.sageDeep, flexShrink: 0,
                    }}>
                      {PHARMACIST.name.charAt(0)}
                    </div>
                    <div className="feed-card-pharmacist">
                      <div className="feed-card-name">{PHARMACIST.name} 약사</div>
                      <div className="feed-card-pharmacy">
                        {PHARMACIST.pharmacy} · {career || PHARMACIST.career}
                      </div>
                    </div>
                  </div>

                  <div className="feed-card-body">
                    {/* 대상 */}
                    {targetText && (
                      <div style={{ fontSize: 14, color: C.sageMid, fontWeight: 500, marginBottom: 6 }}>
                        {targetText}
                      </div>
                    )}

                    {/* 증상 태그 */}
                    {selectedSymptomData.length > 0 && (
                      <div className="feed-card-tags">
                        {selectedSymptomData.map((s) => (
                          <span key={s.label} className={`feed-tag feed-tag-${s.variant}`}>{s.label}</span>
                        ))}
                      </div>
                    )}

                    {/* 제목 */}
                    {title && (
                      <div style={{
                        fontSize: 17, fontWeight: 700, color: C.textDark,
                        lineHeight: 1.5, marginBottom: 12,
                        fontFamily: "'Gothic A1', sans-serif",
                      }}>
                        {title}
                      </div>
                    )}

                    {/* 전/후 변화 */}
                    {changes.some((ch) => ch.before || ch.after) && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                        {changes.filter((ch) => ch.before || ch.after).map((ch, ci) => (
                          <div key={ci} style={{
                            padding: "10px 14px", borderRadius: 10,
                            background: C.sagePale, fontSize: 14, lineHeight: 1.6,
                          }}>
                            <div style={{ color: C.textMid }}>
                              <span style={{ marginRight: 6 }}>😫</span>
                              <span style={{ fontWeight: 500 }}>{ch.before || "—"}</span>
                            </div>
                            <div style={{ color: C.sageDeep, marginTop: 4 }}>
                              <span style={{ marginRight: 6 }}>😊</span>
                              <span style={{ fontWeight: 600 }}>{ch.after || "—"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 기간 */}
                    {duration && (
                      <div className="feed-card-duration">
                        🗓 <span>{duration} 관리</span>
                      </div>
                    )}

                    {/* 사진 */}
                    {photos.length > 0 && (
                      <div
                        className="rc-preview-photos"
                        style={{
                          display: "grid",
                          gridTemplateColumns: photos.length === 1 ? "1fr" : "1fr 1fr",
                          gap: 8, marginBottom: 14, borderRadius: 12, overflow: "hidden",
                        }}
                      >
                        {photos.map((p, i) => (
                          <div key={i} style={{
                            aspectRatio: photos.length === 1 ? "16/9" : "1/1",
                            overflow: "hidden", borderRadius: 8,
                          }}>
                            <img src={p.url} alt={`사진 ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 하단 */}
                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      paddingTop: 12, borderTop: `1px solid ${C.border}`,
                    }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.textMid, display: "flex", alignItems: "center", gap: 5 }}>
                        🤍 0
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.terra }}>
                        이 약사에게 상담받기 →
                      </span>
                    </div>

                    {/* 면책 문구 */}
                    <div style={{
                      fontSize: 12, color: C.sageMid, marginTop: 12,
                      padding: "8px 12px", background: C.sageBg,
                      borderRadius: 8, lineHeight: 1.5, textAlign: "center",
                    }}>
                      개인의 경험이며, 같은 증상이라도 사람마다 원인이 다릅니다. 정확한 분석은 전문 약��와 상담하세요.
                    </div>
                  </div>
                </article>
              </div>

              <button className="fn-modal-close" onClick={() => setShowPreview(false)} type="button">
                닫기
              </button>
            </div>
          </div>
        )}

        {/* ── 등록 확인 팝업 ── */}
        {showConfirm && (
          <div className="fn-modal-overlay" onClick={() => setShowConfirm(false)}>
            <div className="fn-confirm" onClick={(e) => e.stopPropagation()}>
              <h3 className="fn-confirm-title">이야기를 등록하시겠습니까?</h3>
              <p className="fn-confirm-desc">등록 후 약사의 이야기 피드에 공개됩니다.</p>
              <div className="fn-confirm-actions">
                <button className="fn-btn secondary" onClick={() => setShowConfirm(false)} type="button">
                  취소
                </button>
                <button className="fn-btn primary" onClick={handleSubmit} type="button">
                  등록하기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 토스트 ── */}
        {showToast && (
          <div className="fn-toast">등록 완료!</div>
        )}
      </div>
    </>
  );
}

export default function RecommendClient() {
  return (
    <Suspense>
      <RecommendContent />
    </Suspense>
  );
}
