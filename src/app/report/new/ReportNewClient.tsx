"use client";

import { useRouter } from "next/navigation";

/* ══════════════════════════════════════════
   더미 데이터 — 보낸 가이드 목록
   ══════════════════════════════════════════ */
interface SentGuide {
  id: string;
  patientName: string;
  type: "before" | "dosage";
  typeLabel: string;
  sentDate: string;
}

const SENT_GUIDES: SentGuide[] = [
  { id: "g1", patientName: "김○○", type: "before", typeLabel: "방문전 리포트", sentDate: "2026.04.13" },
  { id: "g2", patientName: "김○○", type: "dosage", typeLabel: "복용 가이드", sentDate: "2026.04.10" },
  { id: "g3", patientName: "이○○", type: "before", typeLabel: "방문전 리포트", sentDate: "2026.04.08" },
  { id: "g4", patientName: "박○○", type: "dosage", typeLabel: "복용 가이드", sentDate: "2026.04.05" },
];

/* ══════════════════════════════════════════
   메인 컴포넌트
   ══════════════════════════════════════════ */
export default function ReportNewClient() {
  const router = useRouter();

  return (
    <div className="rpt-page">
      {/* 네비게이션 */}
      <nav>
        <button className="nav-back" onClick={() => router.back()} aria-label="뒤로가기">
          ←
        </button>
        <div className="nav-title">보낸 가이드 목록</div>
        <div style={{ width: 32 }} />
      </nav>

      <div className="rpt-container">
        {SENT_GUIDES.length === 0 ? (
          /* 빈 상태 */
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: "80px 24px", textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <div style={{
              fontSize: 16, fontWeight: 600, color: "#3D4A42",
              fontFamily: "'Noto Sans KR', sans-serif",
            }}>
              아직 보낸 가이드가 없어요
            </div>
          </div>
        ) : (
          /* 가이드 목록 */
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
            {SENT_GUIDES.map((guide) => (
              <button
                key={guide.id}
                type="button"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "16px 18px",
                  borderRadius: 14,
                  background: "#fff",
                  border: "1px solid rgba(94,125,108,0.14)",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  transition: "box-shadow 0.15s",
                  boxShadow: "0 1px 4px rgba(74,99,85,0.06)",
                  fontFamily: "'Noto Sans KR', sans-serif",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(74,99,85,0.12)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 4px rgba(74,99,85,0.06)"; }}
              >
                {/* 아바타 */}
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: "#EDF4F0", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, flexShrink: 0, color: "#4A6355",
                }}>
                  {guide.patientName.charAt(0)}
                </div>

                {/* 정보 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#2C3630" }}>
                      {guide.patientName}
                    </span>
                    <span style={{
                      padding: "2px 10px", borderRadius: 100,
                      fontSize: 12, fontWeight: 600,
                      background: guide.type === "before" ? "#E3EEF8" : "#EDF4F0",
                      color: guide.type === "before" ? "#3B6FA0" : "#4A6355",
                    }}>
                      {guide.typeLabel}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#5E7D6C" }}>
                    {guide.sentDate} 전송
                  </div>
                </div>

                {/* 화살표 */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B3CCBE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))}
          </div>
        )}

        {/* 네비게이션 바 여백 */}
        <div style={{ height: 80 }} />
      </div>
    </div>
  );
}
