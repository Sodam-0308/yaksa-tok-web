"use client";

import { useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/* ══════════════════════════════════════════
   타입 & 상수
   ══════════════════════════════════════════ */

type TagVariant = "sage" | "terra" | "lavender" | "rose" | "blue" | "muted";

interface SymptomOption {
  label: string;
  variant: TagVariant;
}

const PHARMACIST = { name: "김서연 약사", pharmacy: "그린약국" };

const GENDERS = ["남성", "여성"] as const;
const AGE_GROUPS = ["10대", "20대", "30대", "40대", "50대", "60대 이상"] as const;

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
  { label: "기타", variant: "muted" },
];

const DURATION_OPTIONS = ["1개월 미만", "1~3개월", "3~6개월", "6개월~1년", "1년 이상"] as const;
const IMPROVE_DURATION = ["2주 이내", "2~4주", "1~2개월", "2~3개월", "3개월 이상"] as const;

const SCORE_LABELS = ["에너지 수준", "수면 질", "증상 불편도"];

/* ══════════════════════════════════════════
   메인 컴포넌트
   ══════════════════════════════════════════ */
function FeedNewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPharmacist = searchParams.get("role") === "pharmacist";

  /* 환자 기본 */
  const [gender, setGender] = useState<string>("");
  const [ageGroup, setAgeGroup] = useState<string>("");

  /* 증상 */
  const [symptoms, setSymptoms] = useState<Set<string>>(new Set());
  const [etcText, setEtcText] = useState("");

  /* 기간 */
  const [duration, setDuration] = useState("");

  /* 개선 전 */
  const [beforeDesc, setBeforeDesc] = useState("");
  const [beforeScores, setBeforeScores] = useState([5, 5, 5]);

  /* 개선 결과 */
  const [afterDesc, setAfterDesc] = useState("");
  const [afterScores, setAfterScores] = useState([5, 5, 5]);

  /* 개선 기간 */
  const [improveDuration, setImproveDuration] = useState("");

  /* 제목 */
  const [title, setTitle] = useState("");

  /* 사진 */
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [uploaderType, setUploaderType] = useState<"pharmacist" | "patient">(isPharmacist ? "pharmacist" : "patient");
  const [consent, setConsent] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const MAX_PHOTOS = 5;

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

  /* 증상 토글 */
  const toggleSymptom = (label: string) => {
    setSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else if (next.size < 3) {
        next.add(label);
      }
      return next;
    });
  };

  /* 슬라이더 변경 */
  const updateScore = (
    setter: React.Dispatch<React.SetStateAction<number[]>>,
    idx: number,
    val: number,
  ) => {
    setter((prev) => prev.map((v, i) => (i === idx ? val : v)));
  };

  /* 등록 */
  const handleSubmit = () => {
    setShowConfirm(false);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      router.push("/feed");
    }, 2000);
  };

  /* 선택된 증상 variant 목록 */
  const selectedSymptomData = SYMPTOM_OPTIONS.filter((s) => symptoms.has(s.label));

  return (
    <div className="fn-page">
      {/* 네비게이션 */}
      <nav>
        <button className="nav-back" onClick={() => router.back()} aria-label="뒤로가기">
          ←
        </button>
        <div className="nav-title">개선 사례 등록</div>
      </nav>

      <div className="fn-container">
        {/* ── 안내 카드 ── */}
        <div className="fn-guide-card">
          <div className="fn-guide-title">이런 사례를 올려주세요</div>
          <p className="fn-guide-desc">
            실제 상담 환자의 증상 개선 과정을 공유해주세요.
            환자 개인정보는 자동으로 익명 처리됩니다.
          </p>
          <p className="fn-guide-warn">
            구체적인 제품명·브랜드명은 작성하지 마세요.
          </p>
        </div>

        {/* ── 환자 기본 정보 ── */}
        <section className="fn-section">
          <h2 className="fn-section-title">환자 정보 (익명) <span className="fn-required">*</span></h2>

          <div className="fn-field-label">성별</div>
          <div className="fn-chip-row">
            {GENDERS.map((g) => (
              <button
                key={g}
                className={`fn-chip${gender === g ? " selected" : ""}`}
                onClick={() => setGender(g)}
                type="button"
              >
                {g}
              </button>
            ))}
          </div>

          <div className="fn-field-label">연령대</div>
          <div className="fn-chip-row wrap">
            {AGE_GROUPS.map((a) => (
              <button
                key={a}
                className={`fn-chip${ageGroup === a ? " selected" : ""}`}
                onClick={() => setAgeGroup(a)}
                type="button"
              >
                {a}
              </button>
            ))}
          </div>
        </section>

        {/* ── 증상 태그 ── */}
        <section className="fn-section">
          <h2 className="fn-section-title">주요 증상 <span className="fn-required">*</span></h2>
          <p className="fn-field-hint">최대 3개까지 선택할 수 있어요</p>

          <div className="fn-chip-row wrap">
            {SYMPTOM_OPTIONS.map((s) => (
              <button
                key={s.label}
                className={`fn-symptom-chip${symptoms.has(s.label) ? ` active-${s.variant}` : ""}`}
                onClick={() => toggleSymptom(s.label)}
                type="button"
              >
                {s.label}
              </button>
            ))}
          </div>

          {symptoms.has("기타") && (
            <input
              type="text"
              className="fn-input"
              placeholder="증상을 입력해주세요"
              value={etcText}
              onChange={(e) => setEtcText(e.target.value)}
            />
          )}
        </section>

        {/* ── 증상 기간 ── */}
        <section className="fn-section">
          <h2 className="fn-section-title">증상 기간 <span className="fn-required">*</span></h2>
          <div className="fn-chip-row wrap">
            {DURATION_OPTIONS.map((d) => (
              <button
                key={d}
                className={`fn-chip${duration === d ? " selected" : ""}`}
                onClick={() => setDuration(d)}
                type="button"
              >
                {d}
              </button>
            ))}
          </div>
        </section>

        {/* ── 개선 전 상태 ── */}
        <section className="fn-section">
          <h2 className="fn-section-title">상담 전 상태 <span className="fn-required">*</span></h2>
          <textarea
            className="fn-textarea"
            placeholder="예: 아침에 일어나기 힘들고, 하루 종일 피곤함. 커피 3잔 이상 마심. 수면의 질이 낮아 자주 깨는 편."
            value={beforeDesc}
            onChange={(e) => setBeforeDesc(e.target.value)}
            rows={4}
          />
          <div className="fn-char-count">
            {beforeDesc.length}자{beforeDesc.length < 30 && " (최소 30자)"}
          </div>

          <div className="fn-score-group">
            <div className="fn-score-group-title">개선 전 점수 (선택)</div>
            {SCORE_LABELS.map((label, i) => (
              <div key={label} className="fn-slider-row">
                <span className="fn-slider-label">{label}</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={beforeScores[i]}
                  onChange={(e) => updateScore(setBeforeScores, i, +e.target.value)}
                  className="fn-slider"
                />
                <span className="fn-slider-value">{beforeScores[i]}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 개선 결과 ── */}
        <section className="fn-section">
          <h2 className="fn-section-title">개선 결과 <span className="fn-required">*</span></h2>
          <textarea
            className="fn-textarea"
            placeholder="예: 2주 후 아침 기상이 수월해졌고, 4주 후에는 오후 피로감이 크게 줄었다고 함. 커피도 1잔으로 줄임."
            value={afterDesc}
            onChange={(e) => setAfterDesc(e.target.value)}
            rows={4}
          />
          <div className="fn-char-count">
            {afterDesc.length}자{afterDesc.length < 30 && " (최소 30자)"}
          </div>

          <div className="fn-score-group">
            <div className="fn-score-group-title">개선 후 점수 (선택)</div>
            {SCORE_LABELS.map((label, i) => {
              const diff = afterScores[i] - beforeScores[i];
              return (
                <div key={label} className="fn-slider-row">
                  <span className="fn-slider-label">{label}</span>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={afterScores[i]}
                    onChange={(e) => updateScore(setAfterScores, i, +e.target.value)}
                    className="fn-slider"
                  />
                  <span className="fn-slider-value">{afterScores[i]}</span>
                  {diff !== 0 && (
                    <span className={`fn-slider-diff${diff > 0 ? " up" : " down"}`}>
                      {diff > 0 ? `+${diff}` : diff}
                    </span>
                  )}
                </div>
              );
            })}

            {/* 점수 비교 요약 */}
            <div className="fn-score-compare">
              {SCORE_LABELS.map((label, i) => {
                const diff = afterScores[i] - beforeScores[i];
                return (
                  <div key={label} className="fn-compare-row">
                    <span className="fn-compare-label">{label}</span>
                    <span className="fn-compare-values">
                      {beforeScores[i]} → {afterScores[i]}
                    </span>
                    <span className={`fn-compare-diff${diff > 0 ? " up" : diff < 0 ? " down" : ""}`}>
                      {diff > 0 ? `+${diff} ↑` : diff < 0 ? `${diff} ↓` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── 개선 기간 ── */}
        <section className="fn-section">
          <h2 className="fn-section-title">개선까지 걸린 기간 <span className="fn-required">*</span></h2>
          <div className="fn-chip-row wrap">
            {IMPROVE_DURATION.map((d) => (
              <button
                key={d}
                className={`fn-chip${improveDuration === d ? " selected" : ""}`}
                onClick={() => setImproveDuration(d)}
                type="button"
              >
                {d}
              </button>
            ))}
          </div>
        </section>

        {/* ── 사례 제목 ── */}
        <section className="fn-section">
          <h2 className="fn-section-title">사례 제목 <span className="fn-required">*</span></h2>
          <p className="fn-field-hint">피드에 표시되는 대표 제목이에요</p>
          <input
            type="text"
            className="fn-input"
            placeholder="예: 6개월 만성피로, 영양 밸런스로 활력 되찾은 30대 여성"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 50))}
          />
          <div className="fn-char-count">{title.length}/50</div>
        </section>

        {/* ── 사진 첨부 ── */}
        <section className="fn-section">
          <h2 className="fn-section-title">📷 사진 첨부</h2>
          <p className="fn-field-hint">최대 {MAX_PHOTOS}장까지 첨부할 수 있어요 (선택)</p>

          {/* 업로더 유형 (약사만 선택 가능) */}
          {isPharmacist && (
            <div style={{ marginBottom: 14 }}>
              <div className="fn-field-label">사진 올리는 사람</div>
              <div className="fn-chip-row">
                <button
                  type="button"
                  className={`fn-chip${uploaderType === "pharmacist" ? " selected" : ""}`}
                  onClick={() => { setUploaderType("pharmacist"); setConsent(false); }}
                >
                  약사가 올리는 사례
                </button>
                <button
                  type="button"
                  className={`fn-chip${uploaderType === "patient" ? " selected" : ""}`}
                  onClick={() => { setUploaderType("patient"); setConsent(false); }}
                >
                  환자 본인이 올리는 사례
                </button>
              </div>
            </div>
          )}

          {/* 동의 체크 (약사 업로드 시) */}
          {uploaderType === "pharmacist" && (
            <label style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "12px 14px",
              borderRadius: 10,
              background: "#FBF5F1",
              marginBottom: 14,
              cursor: "pointer",
              fontSize: 14,
              color: "#3D4A42",
              lineHeight: 1.5,
            }}>
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={{ marginTop: 3, width: 18, height: 18, accentColor: "#C06B45", flexShrink: 0 }}
              />
              <span>환자 본인의 동의를 받았으며, 개인 식별이 불가능한 사진만 업로드합니다.</span>
            </label>
          )}

          {/* 버튼 */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              disabled={photos.length >= MAX_PHOTOS}
              style={{
                flex: 1,
                padding: "12px 0",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                background: "#EDF4F0",
                color: "#4A6355",
                border: "none",
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
                flex: 1,
                padding: "12px 0",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                background: "#EDF4F0",
                color: "#4A6355",
                border: "none",
                cursor: photos.length >= MAX_PHOTOS ? "not-allowed" : "pointer",
                opacity: photos.length >= MAX_PHOTOS ? 0.5 : 1,
              }}
            >
              📸 카메라
            </button>
          </div>

          {/* hidden inputs */}
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }}
          />

          {/* 썸네일 */}
          {photos.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position: "relative", width: 80, height: 80, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(94,125,108,0.14)" }}>
                  <img
                    src={p.url}
                    alt={`사진 ${i + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.55)",
                      color: "#fff",
                      border: "none",
                      fontSize: 13,
                      lineHeight: "22px",
                      textAlign: "center",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    aria-label={`사진 ${i + 1} 삭제`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 13, color: "#7A8A80", marginTop: 8 }}>
            {photos.length}/{MAX_PHOTOS}장
          </div>
        </section>

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
            <button
              className="fn-btn primary"
              onClick={() => setShowConfirm(true)}
              type="button"
              disabled={uploaderType === "pharmacist" && photos.length > 0 && !consent}
              style={uploaderType === "pharmacist" && photos.length > 0 && !consent ? { opacity: 0.5, cursor: "not-allowed" } : {}}
            >
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
              {/* 피드 카드 미리보기 */}
              <article className="feed-card" style={{ margin: 0, boxShadow: "none" }}>
                {/* 약사 정보 */}
                <div className="feed-card-header">
                  <div className="feed-card-avatar" style={{ background: "var(--color-sage-pale)", color: "var(--color-sage-deep)", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: "50%", fontWeight: 700, flexShrink: 0 }}>
                    {PHARMACIST.name.charAt(0)}
                  </div>
                  <div className="feed-card-pharmacist">
                    <div className="feed-card-name">{PHARMACIST.name}</div>
                    <div className="feed-card-pharmacy">{PHARMACIST.pharmacy}</div>
                  </div>
                </div>

                <div className="feed-card-body">
                  {/* 증상 태그 */}
                  <div className="feed-card-tags">
                    {selectedSymptomData.map((s) => (
                      <span key={s.label} className={`feed-tag feed-tag-${s.variant}`}>
                        {s.label}
                      </span>
                    ))}
                  </div>

                  {/* 환자 정보 (익명) */}
                  <div className="feed-card-patient">
                    {gender || "—"} · {ageGroup || "—"} · 증상 {duration || "—"}
                  </div>

                  {/* 사례 제목 */}
                  {title && <div className="fn-preview-title">{title}</div>}

                  {/* 간단한 스토리 */}
                  {beforeDesc && (
                    <p style={{ fontSize: 14, color: "var(--color-text-mid)", lineHeight: 1.6, margin: "8px 0 4px" }}>
                      <span style={{ fontWeight: 600, color: "var(--color-text-dark)" }}>상담 전</span>{" "}
                      {beforeDesc.length > 80 ? beforeDesc.slice(0, 80) + "…" : beforeDesc}
                    </p>
                  )}
                  <p style={{ fontSize: 14, color: "var(--color-text-mid)", lineHeight: 1.6, margin: "4px 0 12px" }}>
                    <span style={{ fontWeight: 600, color: "var(--color-sage-deep)" }}>개선 후</span>{" "}
                    {afterDesc ? (afterDesc.length > 80 ? afterDesc.slice(0, 80) + "…" : afterDesc) : "(개선 결과가 여기에 표시됩니다)"}
                  </p>

                  {/* 전후 점수 변화 */}
                  <div className="feed-scores">
                    <div className="feed-scores-title">전후 변화</div>
                    {SCORE_LABELS.map((label, i) => {
                      const diff = afterScores[i] - beforeScores[i];
                      return (
                        <div key={label} className="feed-score-row">
                          <span className="feed-score-label">{label}</span>
                          <span className="feed-score-before">{beforeScores[i]}</span>
                          <div className="feed-score-bar">
                            <div className="feed-score-fill-bg" style={{ width: `${beforeScores[i] * 10}%` }} />
                            <div className="feed-score-fill" style={{ width: `${afterScores[i] * 10}%` }} />
                          </div>
                          <span className="feed-score-after">{afterScores[i]}</span>
                          <span className={`feed-score-diff ${diff > 0 ? "up" : "down"}`}>
                            {diff > 0 ? `↑${diff}` : diff < 0 ? `↓${Math.abs(diff)}` : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* 개선 기간 */}
                  <div className="feed-card-duration">
                    {improveDuration ? `${improveDuration} 관리` : "—"}
                  </div>

                  {/* 상담받기 버튼 */}
                  <button
                    type="button"
                    style={{
                      width: "100%",
                      padding: "14px 0",
                      marginTop: 16,
                      background: "var(--color-terra)",
                      color: "#fff",
                      fontSize: 16,
                      fontWeight: 700,
                      border: "none",
                      borderRadius: 12,
                      cursor: "pointer",
                      letterSpacing: "0.02em",
                    }}
                    onClick={(e) => e.preventDefault()}
                  >
                    이 약사에게 상담받기
                  </button>
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
            <h3 className="fn-confirm-title">개선 사례를 등록하시겠습니까?</h3>
            <p className="fn-confirm-desc">등록 후 개선 사례 피드에 공개됩니다.</p>
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
  );
}

export default function FeedNewClient() {
  return (
    <Suspense>
      <FeedNewContent />
    </Suspense>
  );
}
