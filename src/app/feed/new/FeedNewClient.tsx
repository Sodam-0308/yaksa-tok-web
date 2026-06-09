"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

/* ══════════════════════════════════════════
   타입 & 상수
   ══════════════════════════════════════════ */

const GENDERS = ["남성", "여성", "기타"] as const;
const AGE_GROUPS = ["영유아 (0~6세)", "어린이 (7~12세)", "10대", "20대", "30대", "40대", "50대", "60대", "70대 이상"] as const;

const CATEGORY_OPTIONS = [
  { key: "digestion",   label: "소화·장" },
  { key: "sleep",       label: "수면·마음" },
  { key: "fatigue",     label: "피로·기력" },
  { key: "skin",        label: "피부" },
  { key: "pain",        label: "통증·염증" },
  { key: "women",       label: "여성건강" },
  { key: "circulation", label: "체중관리·순환" },
  { key: "growth",      label: "소아·성장" },
  { key: "etc",         label: "기타" },
] as const;

const DURATION_OPTIONS = ["1개월 미만", "1~3개월", "3~6개월", "6개월~1년", "1년 이상"] as const;
const IMPROVE_DURATION = ["1주 이내", "2주 이내", "1개월 이내", "3개월 이내", "6개월 이내", "6개월 이상"] as const;

const SCORE_LABELS = ["에너지/활력", "수면의 질", "소화 상태", "기분/정서", "증상 불편도"];

/* ══════════════════════════════════════════
   메인 컴포넌트
   ══════════════════════════════════════════ */
function FeedNewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit"); // 편집 모드 — 기존 글 id
  const { user, profile } = useAuth();
  // 미리보기 표시용 약사 이름 — 실제 로그인 약사(profile.name). 비동기로 늦게 오면 빈값, mock 이름은 절대 표시 안 함.
  const previewName = profile?.name?.trim() || "";

  // 업로드/등록 진행 상태 + 에러 토스트
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const CASE_BUCKET = "case-photos";
  const ALLOWED_IMG = ["image/jpeg", "image/png", "image/webp"];
  const MAX_BYTES = 5 * 1024 * 1024;

  /* 환자 기본 */
  const [gender, setGender] = useState<string>("");
  const [ageGroup, setAgeGroup] = useState<string>("");

  /* 증상 */
  const [categories, setCategories] = useState<string[]>([]);
  const toggleCategory = (key: string) => {
    setCategories((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length < 3
        ? [...prev, key]
        : prev
    );
  };

  /* 기간 */
  const [duration, setDuration] = useState("");

  /* 개선 전 */
  const [beforeDesc, setBeforeDesc] = useState("");
  const [beforeScores, setBeforeScores] = useState([5, 5, 5, 5, 5]);
  /** 항목별 측정 ON/OFF (index: SCORE_LABELS 순) */
  const [scoreEnabled, setScoreEnabled] = useState<boolean[]>([false, false, false, false, false]);
  const toggleScoreEnabled = (i: number) => {
    setScoreEnabled((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  /* 개선 결과 */
  const [afterDesc, setAfterDesc] = useState("");
  const [afterScores, setAfterScores] = useState([5, 5, 5, 5, 5]);

  /* 개선 기간 */
  const [improveDuration, setImproveDuration] = useState("");

  /* 제목 */
  const [title, setTitle] = useState("");

  /* 사진 */
  const [photos, setPhotos] = useState<{ file?: File; url: string }[]>([]);
  const [consent, setConsent] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const MAX_PHOTOS = 5;

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_PHOTOS - photos.length;
    const incoming = Array.from(files).slice(0, remaining);
    const accepted: { file: File; url: string }[] = [];
    for (const file of incoming) {
      if (!ALLOWED_IMG.includes(file.type)) {
        setSubmitError("지원하지 않는 형식입니다 (jpg/png/webp)");
        continue;
      }
      if (file.size > MAX_BYTES) {
        setSubmitError("파일 크기는 5MB 이하만 가능합니다");
        continue;
      }
      accepted.push({ file, url: URL.createObjectURL(file) });
    }
    if (accepted.length > 0) {
      setPhotos((prev) => [...prev, ...accepted]);
      setSubmitError(null);
    }
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
  const [loadingEdit, setLoadingEdit] = useState(false);

  /* 증상 토글 */
  /* 슬라이더 변경 */
  const updateScore = (
    setter: React.Dispatch<React.SetStateAction<number[]>>,
    idx: number,
    val: number,
  ) => {
    setter((prev) => prev.map((v, i) => (i === idx ? val : v)));
  };

  /* 편집 모드 — editId 있으면 기존 글 1회 로드해 폼 초기값 채움. (점수/증상 기간은 DB 미저장이라 복원 안 함) */
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    setLoadingEdit(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("case_studies").select("*").eq("id", editId).maybeSingle();
        if (cancelled || error || !data) return;
        const row = data as Record<string, unknown>;
        setTitle((row.title as string) ?? "");
        setCategories(Array.isArray(row.categories) ? (row.categories as string[]) : []);
        setAgeGroup((row.patient_age_group as string) ?? "");
        setGender((row.patient_gender as string) ?? "");
        setBeforeDesc((row.description as string) ?? "");
        setAfterDesc((row.outcome as string) ?? "");
        setImproveDuration((row.duration_text as string) ?? "");
        setConsent(!!row.patient_consent_checked);
        const existing = Array.isArray(row.photos) ? (row.photos as string[]) : [];
        setPhotos(existing.map((u) => ({ url: u })));
      } finally {
        if (!cancelled) setLoadingEdit(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editId]);

  /* 등록/수정 — Supabase Storage 업로드 + case_studies INSERT/UPDATE */
  const handleSubmit = async () => {
    if (submitting) return;
    setShowConfirm(false);
    setSubmitError(null);

    if (!user) {
      setSubmitError("로그인이 필요해요");
      return;
    }

    setSubmitting(true);

    // 1) photos 업로드 — 새 파일(p.file)만 Storage 업로드, 기존 사진(p.url만)은 그대로 유지.
    const photoUrls: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      if (!p.file) {
        photoUrls.push(p.url); // 편집 시 기존 사진 URL 유지
        continue;
      }
      const ext = (p.file.name.split(".").pop() || "jpg").toLowerCase();
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
      const path = `${user.id}/${Date.now()}-${i}.${safeExt}`;
      const { error: upErr } = await supabase.storage
        .from(CASE_BUCKET)
        .upload(path, p.file, { upsert: false, cacheControl: "3600", contentType: p.file.type });
      if (upErr) {
        console.error("[feed-new] case-photos upload failed:", upErr);
        setSubmitError(`사진 업로드 실패: ${upErr.message}`);
        setSubmitting(false);
        return;
      }
      const { data: pub } = supabase.storage.from(CASE_BUCKET).getPublicUrl(path);
      if (pub?.publicUrl) photoUrls.push(pub.publicUrl);
    }

    // 2) case_studies INSERT
    type CsInsert = {
      author_id: string;
      author_type: "pharmacist" | "patient";
      pharmacist_id: string | null;
      title: string;
      categories: string[];
      patient_age_group: string | null;
      patient_gender: string | null;
      description: string;
      outcome: string | null;
      duration_weeks: number | null;
      duration_text: string | null;
      photos: string[];
      patient_consent_checked: boolean;
      is_published: boolean;
    };
    // duration "2~4주" → 3 (대략 중앙값) 등 단순 매핑은 생략 — null 로 둠
    const payload: CsInsert = {
      author_id: user.id,
      // 이 화면은 약사 전용(약사가 환자 사례를 익명으로 작성·게시) → author_type 항상 pharmacist 확정.
      author_type: "pharmacist",
      pharmacist_id: user.id,
      title: title.trim() || "(제목 없음)",
      categories: categories,
      patient_age_group: ageGroup || null,
      patient_gender: gender || null,
      description: (beforeDesc || "").trim() || "(내용 없음)",
      outcome: (afterDesc || "").trim() || null,
      duration_weeks: null,
      duration_text: improveDuration || null,
      photos: photoUrls,
      patient_consent_checked: consent,
      is_published: true,
    };
    let opErr: { message: string } | null = null;
    if (editId) {
      // 편집 — 불변 필드(author_id/author_type/pharmacist_id/is_published) 제외하고 UPDATE.
      type CsUpdate = Omit<CsInsert, "author_id" | "author_type" | "pharmacist_id" | "is_published">;
      const updatePayload: CsUpdate = {
        title: payload.title,
        categories: payload.categories,
        patient_age_group: payload.patient_age_group,
        patient_gender: payload.patient_gender,
        description: payload.description,
        outcome: payload.outcome,
        duration_weeks: payload.duration_weeks,
        duration_text: payload.duration_text,
        photos: payload.photos,
        patient_consent_checked: payload.patient_consent_checked,
      };
      const { error } = await (supabase
        .from("case_studies") as unknown as {
          update: (p: CsUpdate) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
        })
        .update(updatePayload)
        .eq("id", editId);
      opErr = error;
    } else {
      const { error } = await (supabase
        .from("case_studies") as unknown as {
          insert: (p: CsInsert) => Promise<{ error: { message: string } | null }>;
        })
        .insert(payload);
      opErr = error;
    }
    if (opErr) {
      console.error("[feed-new] case_studies save failed:", opErr);
      setSubmitError(`${editId ? "수정" : "등록"} 실패: ${opErr.message}`);
      setSubmitting(false);
      return;
    }

    // 성공 — 토스트를 띄운 채로 즉시 이동(인위적 지연 없음). /feed 로 화면이 바뀌며 토스트는 자연 소멸.
    setSubmitting(false);
    setShowToast(true);
    router.push("/feed");
  };

  /* 선택된 분류 라벨 목록 (미리보기용) */
  const selectedCategoryLabels = CATEGORY_OPTIONS.filter((c) => categories.includes(c.key)).map((c) => c.label);

  return (
    <div className="fn-page">
      <style>{`
        /* 데스크톱 폭 통일 — /feed/recommend 와 동일(960px). */
        @media (min-width: 1200px) {
          .fn-container { max-width: 960px !important; }
          .fn-bottom-inner { max-width: 960px !important; }
        }
        .fn-preview-card,
        .fn-preview-card:hover {
          transform: none !important;
          box-shadow: none !important;
          border-color: var(--border) !important;
          transition: none !important;
          cursor: default !important;
        }
        /* 토스트 등장 — transform 비충돌(opacity만). globals .fn-toast 의 slideUp(translateY)이
           중앙정렬 translateX(-50%) 를 덮어써 오른쪽→가운데로 미끄러지는 문제를 인라인 animation 으로 차단. */
        @keyframes fnConfirmFadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
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
          <div className="fn-guide-title">{editId ? "사례 수정하기" : "이런 사례를 올려주세요"}</div>
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

        {/* ── 분류 ── */}
        <section className="fn-section">
          <h2 className="fn-section-title">분류 <span className="fn-required">*</span></h2>
          <p className="fn-field-hint">해당하는 분류를 선택해주세요. (최대 3개까지 가능)</p>

          <div className="fn-chip-row wrap">
            {CATEGORY_OPTIONS.map((c) => (
              <button
                key={c.key}
                className={`fn-symptom-chip${categories.includes(c.key) ? " active-sage" : ""}`}
                onClick={() => toggleCategory(c.key)}
                type="button"
              >
                {c.label}
              </button>
            ))}
          </div>
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
            <div style={{ fontSize: 13, color: "#3D4A42", marginBottom: 12, lineHeight: 1.5 }}>
              기록할 항목만 켜주세요. 1~10 슬라이더로 점수를 입력합니다.
            </div>
            {SCORE_LABELS.map((label, i) => {
              const enabled = scoreEnabled[i];
              return (
                <div
                  key={label}
                  style={{
                    padding: "10px 12px", borderRadius: 10,
                    background: enabled ? "#F8F9F7" : "#fff",
                    border: `1px solid ${enabled ? "rgba(94,125,108,0.18)" : "rgba(94,125,108,0.14)"}`,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: enabled ? 8 : 0, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#2C3630", flex: 1, minWidth: 0 }}>{label}</span>
                    {!enabled && (
                      <span style={{ fontSize: 13, color: "#3D4A42" }}>측정 안 함</span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleScoreEnabled(i)}
                      aria-checked={enabled}
                      role="switch"
                      style={{
                        position: "relative", width: 40, height: 22, borderRadius: 11,
                        background: enabled ? "#4A6355" : "#D1D5D3",
                        border: "none", cursor: "pointer", flexShrink: 0,
                        transition: "background 0.2s",
                      }}
                    >
                      <span style={{
                        position: "absolute", top: 2, left: enabled ? 20 : 2,
                        width: 18, height: 18, borderRadius: "50%",
                        background: "#fff", transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                      }} />
                    </button>
                  </div>
                  {enabled && (
                    <div className="fn-slider-row" style={{ marginBottom: 0 }}>
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
                  )}
                </div>
              );
            })}
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
            {scoreEnabled.some(Boolean) ? (
              <>
                {SCORE_LABELS.map((label, i) => {
                  if (!scoreEnabled[i]) return null;
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
                    if (!scoreEnabled[i]) return null;
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
              </>
            ) : (
              <div style={{ fontSize: 13, color: "#3D4A42", padding: "10px 0" }}>
                개선 전 점수에서 항목을 켜면 여기에 함께 나타납니다.
              </div>
            )}
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
          {submitError && (
            <div
              role="alert"
              style={{
                fontSize: 14,
                color: "#D02F2F",
                background: "#FFF3F3",
                border: "1px solid #F5C8C8",
                padding: "10px 12px",
                borderRadius: 10,
                marginBottom: 12,
                lineHeight: 1.5,
              }}
            >
              {submitError}
            </div>
          )}
          <p className="fn-field-hint">최대 {MAX_PHOTOS}장까지 첨부할 수 있어요 (선택)</p>

          {/* 동의 체크 (약사가 환자 사례 업로드 시) */}
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

          <div style={{ fontSize: 13, color: "#3D4A42", marginTop: 8 }}>
            {photos.length}/{MAX_PHOTOS}장
          </div>
        </section>

        {/* ── 하단 버튼 (폼 흐름 맨 끝 — 다 작성한 뒤 보이게) ── */}
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
              disabled={
                submitting ||
                loadingEdit ||
                categories.length === 0 ||
                (photos.length > 0 && !consent)
              }
              style={
                submitting || loadingEdit || categories.length === 0 || (photos.length > 0 && !consent)
                  ? { opacity: 0.5, cursor: "not-allowed" }
                  : {}
              }
            >
              {loadingEdit ? "불러오는 중..." : submitting ? (editId ? "수정 중..." : "등록 중...") : (editId ? "수정하기" : "등록하기")}
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
              <article className="feed-card fn-preview-card" style={{ margin: 0, boxShadow: "none", cursor: "default" }}>
                {/* 약사 정보 */}
                <div className="feed-card-header">
                  <div className="feed-card-avatar" style={{ background: "var(--color-sage-pale)", color: "var(--color-sage-deep)", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: "50%", fontWeight: 700, flexShrink: 0 }}>
                    {(previewName || "약").charAt(0)}
                  </div>
                  <div className="feed-card-pharmacist">
                    <div className="feed-card-name">{previewName ? `${previewName} 약사` : "약사"}</div>
                    <div className="feed-card-pharmacy">{""}</div>
                  </div>
                </div>

                <div className="feed-card-body">
                  {/* 분류 태그 */}
                  {selectedCategoryLabels.length > 0 && (
                    <div className="feed-card-tags">
                      {selectedCategoryLabels.map((label) => (
                        <span key={label} className="feed-tag feed-tag-sage">{label}</span>
                      ))}
                    </div>
                  )}

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

                  {/* 전후 점수 변화 — 측정 ON 항목만 표시 */}
                  {scoreEnabled.some(Boolean) && (
                    <div className="feed-scores">
                      <div className="feed-scores-title">전후 변화</div>
                      {SCORE_LABELS.map((label, i) => {
                        if (!scoreEnabled[i]) return null;
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
                  )}

                  {/* 개선 기간 */}
                  <div className="feed-card-duration">
                    {improveDuration ? `${improveDuration} 관리` : "—"}
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
        <div
          onClick={() => setShowConfirm(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 200,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "#fff",
              borderRadius: 16,
              padding: "28px 24px 20px",
              width: "min(92vw, 380px)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
              animation: "none",
              transition: "none",
              zIndex: 201,
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--text-dark)",
                margin: "0 0 8px",
                textAlign: "center",
              }}
            >
              {editId ? "이대로 수정할까요?" : "개선 사례를 등록하시겠습니까?"}
            </h3>
            <p
              style={{
                fontSize: 15,
                color: "var(--text-mid)",
                margin: "0 0 24px",
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              등록 후 개선 사례 피드에 공개됩니다.
            </p>
            <div style={{
              margin: "14px 0 4px", padding: "12px 14px", borderRadius: 10,
              background: "#F4F6F4", fontSize: 14, color: "#3D4A42", lineHeight: 1.5, textAlign: "center",
            }}>
              이 증상으로 올라가요: <b style={{ color: "#2C3630" }}>{selectedCategoryLabels.join(", ")}</b>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowConfirm(false)}
                type="button"
                style={{
                  flex: 1,
                  padding: "12px 0",
                  background: "#F4F6F4",
                  color: "var(--text-mid)",
                  fontSize: 15,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                type="button"
                style={{
                  flex: 1,
                  padding: "12px 0",
                  background: "var(--color-terra)",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                {editId ? "수정 완료" : "등록하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 토스트 ── */}
      {showToast && (
        <div className="fn-toast" style={{ position: "fixed", top: "50%", left: "50%", bottom: "auto", transform: "translate(-50%, -50%)", zIndex: 300, animation: "fnConfirmFadeIn 0.2s ease" }}>등록 완료 (피드 목록으로 돌아갑니다)</div>
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
