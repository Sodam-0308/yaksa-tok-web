"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

/* ════════════��═════════════════════════════
   상수 & 더미
   ═════════════��════════════════════════════ */

const PHARMACIST = { name: "김서연", pharmacy: "그린약국", career: "15년차" };

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

const GENDERS = ["남성", "여성", "기타"] as const;
const AGE_GROUPS = ["영유아 (0~6세)", "어린이 (7~12세)", "10대", "20대", "30대", "40대", "50대", "60대", "70대 이상"] as const;
const DURATION_OPTIONS = ["1주 이내", "2주 이내", "1개월 이내", "3개월 이내", "6개월 이내", "6개월 이상"] as const;

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
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit"); // 편집 모드 — 기존 글 id
  const { user, profile } = useAuth();
  // 미리보기 표시용 약사 이름 — 실제 로그인 약사(profile.name). 비동기로 늦게 오면 빈값, mock 이름은 절대 표시 안 함.
  const previewName = profile?.name?.trim() || "";
  // 전용 story 버킷이 없어 case-photos 재사용 — 동일 약사 업로더 + `${uid}/` 경로 prefix 라 동일 Storage RLS 통과.
  const STORY_PHOTO_BUCKET = "case-photos";

  /* 대상 */
  const [targetType, setTargetType] = useState<"self" | "family" | "">("");
  const [familyAge, setFamilyAge] = useState("");
  const [familyGender, setFamilyGender] = useState("");

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
  const [photos, setPhotos] = useState<{ file?: File; url: string }[]>([]);
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
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  /* 편집 모드 — editId 있으면 기존 글 1회 로드해 폼 초기값 채움. */
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    setLoadingEdit(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("pharmacist_stories").select("*").eq("id", editId).maybeSingle();
        if (cancelled || error || !data) return;
        const row = data as Record<string, unknown>;
        setTitle((row.title as string) ?? "");
        setCategories(Array.isArray(row.categories) ? (row.categories as string[]) : []);
        setBody((row.story as string) ?? "");
        setDuration((row.duration_text as string) ?? "");
        const existing = Array.isArray(row.photos) ? (row.photos as string[]) : [];
        setPhotos(existing.map((u) => ({ url: u })));
        // 본인/가족 추론: 나이/성별이 있으면 가족, 없으면 본인.
        if (row.subject_age_group || row.subject_gender) {
          setTargetType("family");
          setFamilyAge((row.subject_age_group as string) ?? "");
          setFamilyGender((row.subject_gender as string) ?? "");
        } else {
          setTargetType("self");
        }
        // changes 복원: before/after_description 을 \n 으로 쪼개 인덱스로 짝짓기.
        const befores = ((row.before_description as string) ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
        const afters = ((row.after_description as string) ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
        const n = Math.max(befores.length, afters.length);
        const restored: Change[] = [];
        for (let i = 0; i < n; i++) restored.push({ before: befores[i] ?? "", after: afters[i] ?? "" });
        setChanges(restored.length ? restored : [{ before: "", after: "" }]);
      } finally {
        if (!cancelled) setLoadingEdit(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editId]);

  /* 등록/수정 — Supabase Storage 업로드 + pharmacist_stories INSERT/UPDATE */
  const handleSubmit = async () => {
    if (submitting) return;
    setShowConfirm(false);
    setSubmitError(null);

    if (!user) {
      setSubmitError("약사 로그인이 필요해요");
      return;
    }
    setSubmitting(true);

    // 1) 사진 Storage 업로드
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
        .from(STORY_PHOTO_BUCKET)
        .upload(path, p.file, { upsert: false, cacheControl: "3600", contentType: p.file.type });
      if (upErr) {
        console.error("[recommend] story photo upload failed:", upErr);
        setSubmitError("사진 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.");
        setSubmitting(false);
        return;
      }
      const { data: pub } = supabase.storage.from(STORY_PHOTO_BUCKET).getPublicUrl(path);
      if (pub?.publicUrl) photoUrls.push(pub.publicUrl);
    }

    // 2) pharmacist_stories INSERT
    //   changes(전/후 변화 배열)는 DB의 단일 before_description/after_description 으로 합쳐 저장(줄바꿈 join).
    const beforeDesc = changes.map((c) => c.before.trim()).filter(Boolean).join("\n");
    const afterDesc = changes.map((c) => c.after.trim()).filter(Boolean).join("\n");
    type PsInsert = {
      pharmacist_id: string;
      title: string;
      categories: string[];
      subject_age_group: string | null;
      subject_gender: string | null;
      subject_relation: string | null;
      before_description: string;
      after_description: string;
      story: string | null;
      duration_text: string | null;
      photos: string[];
      is_published: boolean;
    };
    const payload: PsInsert = {
      pharmacist_id: user.id,
      title: title.trim() || "(제목 없음)",
      categories: categories,
      subject_age_group: targetType === "family" ? (familyAge || null) : null,
      subject_gender: targetType === "family" ? (familyGender || null) : null,
      subject_relation: targetText.trim() || null,
      before_description: beforeDesc,
      after_description: afterDesc,
      story: body.trim() || null,
      duration_text: duration || null,
      photos: photoUrls,
      is_published: true,
    };
    let opErr: { message: string } | null = null;
    if (editId) {
      // 편집 — 불변 필드(pharmacist_id/is_published) 제외하고 UPDATE.
      type PsUpdate = Omit<PsInsert, "pharmacist_id" | "is_published">;
      const updatePayload: PsUpdate = {
        title: payload.title,
        categories: payload.categories,
        subject_age_group: payload.subject_age_group,
        subject_gender: payload.subject_gender,
        subject_relation: payload.subject_relation,
        before_description: payload.before_description,
        after_description: payload.after_description,
        story: payload.story,
        duration_text: payload.duration_text,
        photos: payload.photos,
      };
      const { error } = await (supabase
        .from("pharmacist_stories") as unknown as {
          update: (p: PsUpdate) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
        })
        .update(updatePayload)
        .eq("id", editId);
      opErr = error;
    } else {
      const { error } = await (supabase
        .from("pharmacist_stories") as unknown as {
          insert: (p: PsInsert) => Promise<{ error: { message: string } | null }>;
        })
        .insert(payload);
      opErr = error;
    }
    if (opErr) {
      console.error("[recommend] pharmacist_stories save failed:", opErr);
      setSubmitError(`${editId ? "수정" : "등록"}에 실패했어요. 잠시 후 다시 시도해 주세요.`);
      setSubmitting(false);
      return;
    }

    // 성공 — 토스트를 띄운 채로 즉시 이동(인위적 지연 없음). /feed 로 화면이 바뀌며 토스트는 자연 소멸.
    setSubmitting(false);
    setShowToast(true);
    router.push("/feed");
  };

  /* 대상 텍스트 */
  const targetText = targetType === "self"
    ? "약사 본인"
    : targetType === "family"
      ? `약사 가족${familyAge || familyGender ? ` (${[familyAge, familyGender].filter(Boolean).join(" ")})` : ""}`
      : "";

  /* 선택된 증상 데이터 */
  const selectedCategoryLabels = CATEGORY_OPTIONS.filter((c) => categories.includes(c.key)).map((c) => c.label);

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
        /* 확인 팝업 등장 — transform 비충돌(opacity만). globals .fn-confirm 의 fadeUp(translateY)이
           중앙정렬 translate(-50%,-50%) 를 덮어써 우하단→가운데로 미끄러지는 문제를 인라인 animation 으로 차단. */
        @keyframes fnConfirmFadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <div className="fn-page">
        {/* ── 1. 헤더 ── */}
        <nav>
          <button className="nav-back" onClick={() => router.back()} aria-label="뒤로가기">
            ←
          </button>
          <div className="nav-title">{editId ? "이야기 수정하기" : "약사의 이야기 작성"}</div>
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
                  <div className="fn-field-label">성별</div>
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

          {/* ── 4. 분류 ── */}
          <section className="fn-section">
            <h2 className="fn-section-title">
              분류 <span className="fn-required">*</span>
            </h2>
            <p className="fn-field-hint">해당하는 분류를 선택해주세요. (최대 3개까지 가능)</p>
            <div className="fn-chip-row wrap">
              {CATEGORY_OPTIONS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={`fn-symptom-chip${categories.includes(c.key) ? " active-sage" : ""}`}
                  onClick={() => toggleCategory(c.key)}
                >
                  {c.label}
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
                disabled={submitting || loadingEdit || categories.length === 0}
                style={(submitting || loadingEdit || categories.length === 0) ? { opacity: 0.5, cursor: "not-allowed" } : {}}
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
                <article className="feed-card" style={{ margin: 0, boxShadow: "none" }}>
                  {/* 약사 프로필 */}
                  <div className="feed-card-header">
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: C.sagePale, display: "flex",
                      alignItems: "center", justifyContent: "center",
                      fontSize: 18, fontWeight: 700, color: C.sageDeep, flexShrink: 0,
                    }}>
                      {(previewName || "약").charAt(0)}
                    </div>
                    <div className="feed-card-pharmacist">
                      <div className="feed-card-name">{previewName ? `${previewName} 약사` : "약사"}</div>
                      <div className="feed-card-pharmacy">
                        {career || ""}
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

                    {/* 분류 태그 */}
                    {selectedCategoryLabels.length > 0 && (
                      <div className="feed-card-tags">
                        {selectedCategoryLabels.map((label) => (
                          <span key={label} className="feed-tag feed-tag-sage">{label}</span>
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
            <div className="fn-confirm" onClick={(e) => e.stopPropagation()} style={{ animation: "fnConfirmFadeIn 0.2s ease" }}>
              <h3 className="fn-confirm-title">{editId ? "이대로 수정할까요?" : "이야기를 등록하시겠습니까?"}</h3>
              <p className="fn-confirm-desc">등록 후 약사의 이야기 피드에 공개됩니다.</p>
              <div style={{
                margin: "14px 0 4px", padding: "12px 14px", borderRadius: 10,
                background: "#F4F6F4", fontSize: 14, color: "#3D4A42", lineHeight: 1.5, textAlign: "center",
              }}>
                선택한 분류: <b style={{ color: "#2C3630" }}>{selectedCategoryLabels.join(", ")}</b>
              </div>
              <div className="fn-confirm-actions">
                <button className="fn-btn secondary" onClick={() => setShowConfirm(false)} type="button">
                  취소
                </button>
                <button className="fn-btn primary" onClick={handleSubmit} type="button" disabled={submitting}>
                  {submitting ? (editId ? "수정 중..." : "등록 중...") : (editId ? "수정 완료" : "등록하기")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 토스트 ── */}
        {showToast && (
          <div className="fn-toast" style={{ position: "fixed", top: "50%", left: "50%", bottom: "auto", transform: "translate(-50%, -50%)", zIndex: 300, animation: "fnConfirmFadeIn 0.2s ease" }}>등록 완료 (피드 목록으로 돌아갑니다)</div>
        )}
        {submitError && (
          <div className="fn-toast" style={{ position: "fixed", top: "50%", left: "50%", bottom: "auto", transform: "translate(-50%, -50%)", zIndex: 300, background: "#C0392B", animation: "fnConfirmFadeIn 0.2s ease" }} role="alert">{submitError}</div>
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
