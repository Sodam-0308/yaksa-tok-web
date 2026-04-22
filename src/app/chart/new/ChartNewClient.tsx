"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  SymptomIcon,
  SYMPTOM_META,
  type SymptomKey,
} from "@/components/SymptomIcon";

const COLOR = {
  sageBg: "#F8F9F7",
  sagePale: "#EDF4F0",
  sageLight: "#B3CCBE",
  sageMid: "#5E7D6C",
  sageDeep: "#4A6355",
  terra: "#C06B45",
  textDark: "#2C3630",
  textMid: "#3D4A42",
  border: "rgba(94, 125, 108, 0.14)",
  white: "#fff",
};

const SYMPTOM_KEYS: SymptomKey[] = [
  "fatigue", "digestion", "sleep", "women", "skin", "rhinitis",
  "gut", "mood", "hair", "weight", "antiaging", "immune",
];

interface Supplement {
  name: string;
  dosage: string;
  timing: string;
}

interface VisitDraft {
  date: string;
  products: Supplement[];
  complaint: string;
  pharmacistGuide: string;
  pharmacistNote: string;
  durationDays: string;
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const newVisitDraft = (): VisitDraft => ({
  date: todayStr(),
  products: [{ name: "", dosage: "", timing: "" }],
  complaint: "",
  pharmacistGuide: "",
  pharmacistNote: "",
  durationDays: "",
});

interface Visit extends VisitDraft {
  id: string;
}

export default function ChartNewClient() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [gender, setGender] = useState<"여성" | "남성" | "">("");
  const [birthYear, setBirthYear] = useState("");
  const [phone, setPhone] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [budget, setBudget] = useState("");
  const [memo, setMemo] = useState("");

  const [symptoms, setSymptoms] = useState<SymptomKey[]>([]);
  const [showSymptomPicker, setShowSymptomPicker] = useState(false);
  const addSymptom = (key: SymptomKey) => {
    setSymptoms((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setShowSymptomPicker(false);
  };
  const removeSymptom = (key: SymptomKey) => {
    setSymptoms((prev) => prev.filter((k) => k !== key));
  };

  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitDraft, setVisitDraft] = useState<VisitDraft | null>(null);
  const openVisitForm = () => setVisitDraft(newVisitDraft());
  const cancelVisitForm = () => setVisitDraft(null);
  const updateDraft = <K extends keyof VisitDraft>(key: K, value: VisitDraft[K]) => {
    setVisitDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };
  const addDraftProduct = () => {
    setVisitDraft((prev) => (prev ? { ...prev, products: [...prev.products, { name: "", dosage: "", timing: "" }] } : prev));
  };
  const updateDraftProduct = (i: number, field: keyof Supplement, value: string) => {
    setVisitDraft((prev) => prev ? { ...prev, products: prev.products.map((p, idx) => idx === i ? { ...p, [field]: value } : p) } : prev);
  };
  const removeDraftProduct = (i: number) => {
    setVisitDraft((prev) => prev ? { ...prev, products: prev.products.filter((_, idx) => idx !== i) } : prev);
  };
  const saveVisit = () => {
    if (!visitDraft) return;
    const cleaned: Visit = {
      ...visitDraft,
      id: `v-${Date.now()}`,
      products: visitDraft.products.filter((p) => p.name.trim()),
    };
    setVisits((prev) => [...prev, cleaned]);
    setVisitDraft(null);
  };
  const removeVisit = (id: string) => {
    setVisits((prev) => prev.filter((v) => v.id !== id));
  };


  const canSubmit = name.trim().length > 0 && gender !== "";

  const submit = () => {
    if (!canSubmit) return;
    router.push("/chart/1");
  };

  const card: React.CSSProperties = {
    background: COLOR.white,
    borderRadius: 16,
    border: "1px solid rgba(94,125,108,0.1)",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    padding: 20,
    marginBottom: 16,
  };
  const label: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.sageMid,
    marginBottom: 6,
  };
  const input: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    minHeight: 48,
    borderRadius: 10,
    border: `1.5px solid ${COLOR.border}`,
    background: COLOR.white,
    fontSize: 15,
    color: COLOR.textDark,
    outline: "none",
    fontFamily: "'Noto Sans KR', sans-serif",
    boxSizing: "border-box",
  };

  return (
    <>
      <style>{`
        .cn-page { min-height: 100dvh; background: ${COLOR.sageBg}; }
        .cn-page nav {
          position: sticky; top: 0; z-index: 50; padding: 0 24px; height: 60px;
          display: flex; align-items: center;
          background: rgba(248,249,247,0.95); backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid ${COLOR.border};
        }
        .cn-container { max-width: 560px; margin: 0 auto; padding: 20px 16px; }
      `}</style>

      <div className="cn-page">
        <nav>
          <button
            className="nav-back"
            onClick={() => router.back()}
            aria-label="뒤로가기"
            style={{ background: "none", border: "none", fontSize: 22, color: COLOR.textDark, cursor: "pointer" }}
          >
            ←
          </button>
          <div
            style={{
              flex: 1,
              textAlign: "center",
              fontFamily: "'Gothic A1', sans-serif",
              fontSize: 16,
              fontWeight: 700,
              color: COLOR.textDark,
              marginRight: 36,
            }}
          >
            새 환자 등록
          </div>
        </nav>

        <div className="cn-container">
          {/* 기본 정보 */}
          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLOR.textDark, marginBottom: 14, fontFamily: "'Gothic A1', sans-serif" }}>
              기본 정보
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={label}>이름 *</div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 김환자"
                style={input}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={label}>성별 *</div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["여성", "남성"] as const).map((g) => {
                  const active = gender === g;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      style={{
                        flex: 1,
                        minHeight: 48,
                        padding: "12px 0",
                        borderRadius: 10,
                        background: active ? COLOR.sageDeep : COLOR.white,
                        color: active ? COLOR.white : COLOR.textDark,
                        border: `1.5px solid ${active ? COLOR.sageDeep : COLOR.border}`,
                        fontSize: 15,
                        fontWeight: active ? 700 : 500,
                        cursor: "pointer",
                        fontFamily: "'Noto Sans KR', sans-serif",
                      }}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={label}>출생연도</div>
              <input
                type="number"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                placeholder="예: 1980"
                style={input}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={label}>휴대폰 번호</div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                style={input}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>
              <div style={{ flex: 1 }}>
                <div style={label}>키 (cm)</div>
                <input
                  type="number"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="예: 165"
                  style={input}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={label}>몸무게 (kg)</div>
                <input
                  type="number"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="예: 58"
                  style={input}
                />
              </div>
            </div>
          </div>

          {/* 상담 정보 */}
          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLOR.textDark, marginBottom: 14, fontFamily: "'Gothic A1', sans-serif" }}>
              상담 정보
            </div>

            <div>
              <div style={label}>예산</div>
              <input
                type="text"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="예: 월 5만원 이내"
                style={input}
              />
            </div>
          </div>

          {/* 📝 약사 메모 */}
          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLOR.textDark, marginBottom: 14, fontFamily: "'Gothic A1', sans-serif" }}>
              📝 약사 메모
            </div>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="환자 특이사항, 기존 복용 중인 영양제, 주의할 점 등"
              rows={5}
              style={{
                width: "100%",
                padding: 16,
                minHeight: 120,
                borderRadius: 12,
                background: COLOR.sagePale,
                border: `1px solid ${COLOR.border}`,
                fontSize: 15,
                color: COLOR.textDark,
                outline: "none",
                resize: "vertical",
                fontFamily: "'Noto Sans KR', sans-serif",
                lineHeight: 1.6,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* 현재 증상 */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLOR.textDark, fontFamily: "'Gothic A1', sans-serif" }}>
                현재 증상
              </div>
              <button
                type="button"
                onClick={() => setShowSymptomPicker(true)}
                style={{
                  padding: "8px 14px",
                  minHeight: 40,
                  borderRadius: 10,
                  background: COLOR.sagePale,
                  color: COLOR.sageDeep,
                  fontSize: 14,
                  fontWeight: 600,
                  border: `1px solid ${COLOR.sageLight}`,
                  cursor: "pointer",
                  fontFamily: "'Noto Sans KR', sans-serif",
                }}
              >
                + 증상 추가
              </button>
            </div>
            {symptoms.length === 0 ? (
              <div style={{ fontSize: 14, color: COLOR.textMid, padding: "20px 0", textAlign: "center" }}>
                아직 등록된 증상이 없어요
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {symptoms.map((k) => {
                  const meta = SYMPTOM_META[k];
                  return (
                    <div
                      key={k}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: COLOR.sageBg,
                        border: `1px solid ${COLOR.border}`,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <SymptomIcon keyId={k} size={32} />
                        <span style={{ fontSize: 15, fontWeight: 600, color: COLOR.textDark }}>
                          {meta.label}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSymptom(k)}
                        aria-label={`${meta.label} 삭제`}
                        style={{
                          minHeight: 36,
                          minWidth: 36,
                          padding: "6px 12px",
                          borderRadius: 8,
                          background: "transparent",
                          color: COLOR.textMid,
                          fontSize: 14,
                          border: `1px solid ${COLOR.border}`,
                          cursor: "pointer",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 방문 기록 */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLOR.textDark, fontFamily: "'Gothic A1', sans-serif" }}>
                방문 기록
              </div>
              {!visitDraft && (
                <button
                  type="button"
                  onClick={openVisitForm}
                  style={{
                    padding: "8px 14px",
                    minHeight: 40,
                    borderRadius: 10,
                    background: COLOR.sagePale,
                    color: COLOR.sageDeep,
                    fontSize: 14,
                    fontWeight: 600,
                    border: `1px solid ${COLOR.sageLight}`,
                    cursor: "pointer",
                    fontFamily: "'Noto Sans KR', sans-serif",
                  }}
                >
                  + 방문 기록 추가
                </button>
              )}
            </div>

            {/* 저장된 방문 기록 리스트 */}
            {visits.length === 0 && !visitDraft && (
              <div style={{ fontSize: 14, color: COLOR.textMid, padding: "20px 0", textAlign: "center" }}>
                아직 방문 기록이 없어요
              </div>
            )}
            {visits.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: visitDraft ? 14 : 0 }}>
                {visits.map((v) => (
                  <div key={v.id} style={{ padding: 14, borderRadius: 12, background: COLOR.sageBg, border: `1px solid ${COLOR.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: COLOR.textDark }}>{v.date}</span>
                      <button
                        type="button"
                        onClick={() => removeVisit(v.id)}
                        aria-label="방문 기록 삭제"
                        style={{
                          minHeight: 32,
                          minWidth: 32,
                          padding: "4px 10px",
                          borderRadius: 8,
                          background: "transparent",
                          color: COLOR.textMid,
                          fontSize: 13,
                          border: `1px solid ${COLOR.border}`,
                          cursor: "pointer",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    {v.products.length > 0 && (
                      <div style={{ fontSize: 14, color: COLOR.textMid, lineHeight: 1.5 }}>
                        영양제: {v.products.map((p) => p.name).filter(Boolean).join(", ")}
                      </div>
                    )}
                    {v.durationDays && (
                      <div style={{ fontSize: 14, color: COLOR.textMid, marginTop: 4 }}>
                        복용 일수: {v.durationDays}일
                      </div>
                    )}
                    {v.complaint && (
                      <div style={{ fontSize: 14, color: COLOR.textMid, marginTop: 4 }}>
                        호소: {v.complaint}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 방문 입력 폼 */}
            {visitDraft && (
              <div style={{ padding: 14, borderRadius: 12, background: COLOR.sageBg, border: `1.5px dashed ${COLOR.sageLight}` }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={label}>방문 날짜</div>
                  <input
                    type="date"
                    value={visitDraft.date}
                    onChange={(e) => updateDraft("date", e.target.value)}
                    style={input}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ ...label, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>구매 영양제</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {visitDraft.products.map((p, i) => (
                      <div key={i} style={{ padding: 10, borderRadius: 10, background: COLOR.white, border: `1px solid ${COLOR.border}` }}>
                        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                          <input
                            type="text"
                            value={p.name}
                            onChange={(e) => updateDraftProduct(i, "name", e.target.value)}
                            placeholder="이름 (예: 비타민B군)"
                            style={{ ...input, minHeight: 40, padding: "8px 10px", fontSize: 14 }}
                          />
                          <button
                            type="button"
                            onClick={() => removeDraftProduct(i)}
                            aria-label="영양제 삭제"
                            style={{
                              width: 40, height: 40,
                              borderRadius: 8,
                              background: "transparent",
                              color: COLOR.textMid,
                              fontSize: 14,
                              border: `1px solid ${COLOR.border}`,
                              cursor: "pointer",
                              flexShrink: 0,
                            }}
                          >
                            ✕
                          </button>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            type="text"
                            value={p.dosage}
                            onChange={(e) => updateDraftProduct(i, "dosage", e.target.value)}
                            placeholder="용량 (예: 1알)"
                            style={{ ...input, minHeight: 40, padding: "8px 10px", fontSize: 14 }}
                          />
                          <input
                            type="text"
                            value={p.timing}
                            onChange={(e) => updateDraftProduct(i, "timing", e.target.value)}
                            placeholder="복용 시점 (예: 아침 식후)"
                            style={{ ...input, minHeight: 40, padding: "8px 10px", fontSize: 14 }}
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addDraftProduct}
                      style={{
                        width: "100%",
                        minHeight: 40,
                        padding: "8px 0",
                        borderRadius: 8,
                        background: COLOR.sagePale,
                        color: COLOR.sageDeep,
                        fontSize: 14,
                        fontWeight: 600,
                        border: `1px dashed ${COLOR.sageLight}`,
                        cursor: "pointer",
                      }}
                    >
                      + 영양제 추가
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={label}>복용 일수</div>
                  <input
                    type="number"
                    value={visitDraft.durationDays}
                    onChange={(e) => updateDraft("durationDays", e.target.value)}
                    placeholder="예: 14"
                    style={{ ...input, minHeight: 40 }}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={label}>환자 호소 내용</div>
                  <textarea
                    value={visitDraft.complaint}
                    onChange={(e) => updateDraft("complaint", e.target.value)}
                    placeholder="예: 오후만 되면 피로가 심해져요"
                    rows={2}
                    style={{ ...input, minHeight: 60, resize: "vertical", lineHeight: 1.6 }}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={label}>약사 가이드</div>
                  <textarea
                    value={visitDraft.pharmacistGuide}
                    onChange={(e) => updateDraft("pharmacistGuide", e.target.value)}
                    placeholder="예: 취침 전 마그네슘 복용, 카페인 줄이기"
                    rows={2}
                    style={{ ...input, minHeight: 60, resize: "vertical", lineHeight: 1.6 }}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={label}>약사 소견</div>
                  <textarea
                    value={visitDraft.pharmacistNote}
                    onChange={(e) => updateDraft("pharmacistNote", e.target.value)}
                    placeholder="내부 메모 (환자에게 표시되지 않음)"
                    rows={2}
                    style={{ ...input, minHeight: 60, resize: "vertical", lineHeight: 1.6 }}
                  />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={cancelVisitForm}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      padding: "10px 0",
                      borderRadius: 10,
                      background: COLOR.white,
                      color: COLOR.textMid,
                      fontSize: 14,
                      fontWeight: 600,
                      border: `1px solid ${COLOR.border}`,
                      cursor: "pointer",
                    }}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={saveVisit}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      padding: "10px 0",
                      borderRadius: 10,
                      background: COLOR.sageDeep,
                      color: COLOR.white,
                      fontSize: 14,
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    저장
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ fontSize: 13, color: COLOR.textMid, lineHeight: 1.5, padding: "0 4px" }}>
            * 표시 항목은 필수 입력이에요. 나머지는 등록 후에도 차트에서 추가할 수 있어요.
          </div>

          {/* 하단 CTA (일반 흐름 배치) */}
          <div style={{ marginTop: 24, marginBottom: 120 }}>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              style={{
                width: "100%",
                padding: "14px 0",
                minHeight: 52,
                borderRadius: 12,
                background: canSubmit ? COLOR.sageDeep : COLOR.sageLight,
                color: COLOR.white,
                fontSize: 16,
                fontWeight: 700,
                border: "none",
                cursor: canSubmit ? "pointer" : "default",
              }}
            >
              등록
            </button>
          </div>
        </div>

        {/* 증상 선택 팝업 */}
        {showSymptomPicker && (
          <div
            onClick={() => setShowSymptomPicker(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 300,
              padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: COLOR.white,
                borderRadius: 16,
                padding: 20,
                width: "100%",
                maxWidth: 420,
                maxHeight: "80vh",
                overflowY: "auto",
                boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                <div style={{ fontSize: 17, fontWeight: 700, color: COLOR.textDark, fontFamily: "'Gothic A1', sans-serif" }}>
                  증상 선택
                </div>
                <button
                  type="button"
                  onClick={() => setShowSymptomPicker(false)}
                  aria-label="닫기"
                  style={{
                    width: 40, height: 40,
                    borderRadius: 10,
                    background: COLOR.sageBg,
                    color: COLOR.textDark,
                    border: `1px solid ${COLOR.border}`,
                    cursor: "pointer",
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                >
                  ✕
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 8,
                }}
              >
                {SYMPTOM_KEYS.map((k) => {
                  const meta = SYMPTOM_META[k];
                  const selected = symptoms.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => addSymptom(k)}
                      disabled={selected}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 12px",
                        minHeight: 48,
                        borderRadius: 10,
                        background: selected ? meta.bg : COLOR.white,
                        border: `1.5px solid ${selected ? meta.accent : COLOR.border}`,
                        cursor: selected ? "default" : "pointer",
                        opacity: selected ? 0.55 : 1,
                        textAlign: "left",
                        fontFamily: "'Noto Sans KR', sans-serif",
                      }}
                    >
                      <SymptomIcon keyId={k} size={28} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: COLOR.textDark }}>
                        {meta.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
