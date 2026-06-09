"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { WeeklySlots } from "@/types/database";

/* 카테고리 키 → 한글 라벨 (피드와 동일) */
const CATEGORY_LABELS: Record<string, string> = {
  digestion: "소화·장", sleep: "수면·마음", fatigue: "피로·기력",
  skin: "피부", pain: "통증·염증", women: "여성건강",
  circulation: "체중관리·순환", growth: "소아·성장", etc: "기타",
};

/* 요일 키 → 한글 */
const DAY_LABELS: [keyof WeeklySlots, string][] = [
  ["mon", "월요일"], ["tue", "화요일"], ["wed", "수요일"],
  ["thu", "목요일"], ["fri", "금요일"], ["sat", "토요일"], ["sun", "일요일"],
];

interface PharmacistProfile {
  id: string;
  licenseName: string;
  pharmacyName: string;
  address: string;
  lat: number | null;
  lng: number | null;
  bio: string | null;
  expertSpecialties: string[];
  availableSpecialties: string[];
  avgResponseMinutes: number | null;
  totalConsultations: number;
  totalImprovements: number;
  offlineConsultCount: number | null;
  careerYears: number | null;
  isVerified: boolean;
  pharmacyPhotos: string[];
  weeklySlots: WeeklySlots | null;
}

interface CaseStudyItem {
  id: string;
  title: string;
  categories: string[];
  symptoms: string[];
  durationText: string;
  ageGroup: string;
  gender: string;
  outcome: string;
}

/* avg_response_minutes → "30분" / "약 1시간" */
function formatResponse(min: number): string {
  if (min >= 60) return `약 ${Math.round(min / 60)}시간`;
  return `${min}분`;
}

export default function PharmacistClient() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PharmacistProfile | null>(null);
  const [cases, setCases] = useState<CaseStudyItem[]>([]);
  const [casesExpanded, setCasesExpanded] = useState(false);
  const [requested, setRequested] = useState(false);

  /* 약사 프로필 + 상담 사례 로드 */
  useEffect(() => {
    if (!id) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("pharmacist_profiles")
          .select(
            "id, license_name, pharmacy_name, address, lat, lng, bio, expert_specialties, available_specialties, avg_response_minutes, total_consultations, total_improvements, offline_consult_count, career_years, is_verified, is_active, pharmacy_photos, weekly_slots"
          )
          .eq("id", id)
          .maybeSingle();
        if (cancelled) return;
        if (error || !data) { setProfile(null); return; }
        const r = data as Record<string, unknown>;
        setProfile({
          id: (r.id as string) ?? "",
          licenseName: ((r.license_name as string) ?? "").trim(),
          pharmacyName: ((r.pharmacy_name as string) ?? "").trim(),
          address: ((r.address as string) ?? "").trim(),
          lat: (r.lat as number | null) ?? null,
          lng: (r.lng as number | null) ?? null,
          bio: (r.bio as string | null) ?? null,
          expertSpecialties: Array.isArray(r.expert_specialties) ? (r.expert_specialties as string[]) : [],
          availableSpecialties: Array.isArray(r.available_specialties) ? (r.available_specialties as string[]) : [],
          avgResponseMinutes: (r.avg_response_minutes as number | null) ?? null,
          totalConsultations: (r.total_consultations as number) ?? 0,
          totalImprovements: (r.total_improvements as number) ?? 0,
          offlineConsultCount: (r.offline_consult_count as number | null) ?? null,
          careerYears: (r.career_years as number | null) ?? null,
          isVerified: !!r.is_verified,
          pharmacyPhotos: Array.isArray(r.pharmacy_photos) ? (r.pharmacy_photos as string[]) : [],
          weeklySlots: (r.weekly_slots as WeeklySlots | null) ?? null,
        });

        /* 이 약사의 상담 사례 */
        const { data: csData } = await supabase
          .from("case_studies")
          .select("*")
          .eq("pharmacist_id", id)
          .eq("is_published", true)
          .order("created_at", { ascending: false });
        if (cancelled) return;
        const rows = (csData ?? []) as Record<string, unknown>[];
        setCases(
          rows.map((row) => ({
            id: (row.id as string) ?? "",
            title: ((row.title as string) ?? "").trim(),
            categories: Array.isArray(row.categories) ? (row.categories as string[]) : [],
            symptoms: Array.isArray(row.symptoms) ? (row.symptoms as string[]) : [],
            durationText: ((row.duration_text as string) ?? "").trim(),
            ageGroup: ((row.patient_age_group as string) ?? "").trim(),
            gender: ((row.patient_gender as string) ?? "").trim(),
            outcome: ((row.outcome as string) ?? "").trim(),
          }))
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleRequest = () => {
    if (!profile) return;
    setRequested(true);
    setTimeout(() => {
      alert(
        `${profile.licenseName || profile.pharmacyName}에게 상담을 요청했어요!\n약사님이 수락하면 채팅이 시작됩니다.`
      );
    }, 300);
  };

  /* ── 로딩 / 약사 없음 ── */
  if (loading) {
    return (
      <div className="pharmacist-page">
        <nav>
          <button className="nav-back" onClick={() => router.back()} aria-label="뒤로가기">←</button>
          <div className="nav-title">약사 프로필</div>
        </nav>
        <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: "#3D4A42" }}>
          불러오는 중이에요…
        </div>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="pharmacist-page">
        <nav>
          <button className="nav-back" onClick={() => router.back()} aria-label="뒤로가기">←</button>
          <div className="nav-title">약사 프로필</div>
        </nav>
        <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", gap: 10, alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>🔍</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#2C3630" }}>약사 정보를 찾을 수 없어요</div>
          <button
            onClick={() => router.back()}
            style={{ marginTop: 8, padding: "10px 20px", minHeight: 48, border: "1px solid #4A6355", borderRadius: 10, background: "transparent", color: "#4A6355", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  /* ── 파생값 ── */
  const displayName = profile.licenseName || profile.pharmacyName || "약사";
  const avatarText = displayName.trim().charAt(0) || "👤";

  // 경력 한 줄 (이름·약국 아래) — 둘 중 있는 것만 가운뎃점 연결
  const careerParts: string[] = [];
  if (profile.careerYears && profile.careerYears > 0) careerParts.push(`경력 ${profile.careerYears}년`);
  if (profile.offlineConsultCount && profile.offlineConsultCount > 0) {
    careerParts.push(`오프라인 상담 ${profile.offlineConsultCount.toLocaleString()}건`);
  }
  const careerLine = careerParts.join(" · ");

  // Stats 칸 구성 (약사톡 플랫폼 통계 — 실값 있는 것만)
  const statCells: { num: string; label: string }[] = [];
  if (profile.avgResponseMinutes != null) {
    statCells.push({ num: formatResponse(profile.avgResponseMinutes), label: "평균 응답" });
  }
  if (profile.totalConsultations > 0) {
    statCells.push({ num: profile.totalConsultations.toLocaleString(), label: "약사톡 상담" });
  }
  if (cases.length > 0) {
    statCells.push({ num: cases.length.toLocaleString(), label: "개선 사례" });
  }

  const hasSpecialties = profile.expertSpecialties.length > 0 || profile.availableSpecialties.length > 0;
  const slotDays = profile.weeklySlots
    ? DAY_LABELS.filter(([k]) => (profile.weeklySlots?.[k]?.length ?? 0) > 0)
    : [];
  const hasSlots = slotDays.length > 0;

  // 카카오맵 링크
  const mapUrl = (profile.lat != null && profile.lng != null)
    ? `https://map.kakao.com/link/map/${encodeURIComponent(profile.pharmacyName)},${profile.lat},${profile.lng}`
    : `https://map.kakao.com/?q=${encodeURIComponent(profile.address)}`;

  const displayedCases = casesExpanded ? cases : cases.slice(0, 2);

  return (
    <div className="pharmacist-page">
      <nav>
        <button className="nav-back" onClick={() => router.back()} aria-label="뒤로가기">←</button>
        <div className="nav-title">약사 프로필</div>
      </nav>

      <div className="pharm-container">
        {/* Profile Hero */}
        <div className="profile-hero">
          <div className="avatar-wrap">
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "#EDF4F0", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: 30, fontWeight: 700, color: "#4A6355",
              fontFamily: "'Gothic A1', sans-serif",
            }}>
              {avatarText}
            </div>
          </div>
          <h1 className="profile-name">{displayName}</h1>
          <p className="profile-pharmacy">
            {profile.pharmacyName}{profile.address ? ` · ${profile.address}` : ""}
          </p>
          {careerLine && (
            <p style={{ fontSize: 13, color: "#7A8A80", margin: "4px 0 0" }}>
              {careerLine}
            </p>
          )}
          {profile.isVerified && (
            <div className="badges-row">
              <span className="badge-chip gold">✅ 인증 약사</span>
            </div>
          )}
        </div>

        {/* Stats Grid (표시되는 칸 수에 맞춰 칼럼 채움 — 빈 격자 없음) */}
        {statCells.length > 0 && (
          <div className="stats-grid" style={{ gridTemplateColumns: `repeat(${statCells.length}, 1fr)` }}>
            {statCells.map((s) => (
              <div key={s.label} className="stat-item">
                <div className="stat-num">{s.num}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Bio (있을 때만) */}
        {profile.bio && (
          <div className="prof-section">
            <div className="prof-section-title">
              <span className="icon">💬</span> 소개
            </div>
            <div className="bio-text">{profile.bio}</div>
          </div>
        )}

        {/* Specialties (있을 때만) */}
        {hasSpecialties && (
          <div className="prof-section">
            <div className="prof-section-title">
              <span className="icon">🎯</span> 전문 분야
            </div>
            {profile.expertSpecialties.length > 0 && (
              <div className="specialty-group">
                <div className="specialty-label">✦ 전문</div>
                <div className="specialty-tags">
                  {profile.expertSpecialties.map((s) => (
                    <span key={s} className="s-tag s-tag-expert">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {profile.availableSpecialties.length > 0 && (
              <div className="specialty-group" style={{ marginTop: 14 }}>
                <div className="specialty-label">상담 가능</div>
                <div className="specialty-tags">
                  {profile.availableSpecialties.map((s) => (
                    <span key={s} className="s-tag s-tag-available">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Case Studies — case_studies 실연동 */}
        <div className="prof-section">
          <div className="prof-section-title">
            <span className="icon">📋</span> 상담 사례
          </div>
          {cases.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 16px", fontSize: 14, color: "#3D4A42", background: "#F8F9F7", borderRadius: 12 }}>
              아직 등록된 상담 사례가 없어요
            </div>
          ) : (
            <>
              <div className="case-list">
                {displayedCases.map((cs) => {
                  const chips = cs.categories.length > 0
                    ? cs.categories.map((k) => CATEGORY_LABELS[k] ?? k)
                    : cs.symptoms;
                  const subject = [cs.ageGroup, cs.gender].filter(Boolean).join(" ");
                  return (
                    <div key={cs.id} className="case-card">
                      <div className="case-header">
                        <div className="case-symptoms">
                          {chips.map((s, i) => (
                            <span key={`${s}-${i}`} className="case-symptom">{s}</span>
                          ))}
                        </div>
                        {cs.durationText && <span className="case-duration">{cs.durationText}</span>}
                      </div>
                      {cs.title && <div className="case-title">{cs.title}</div>}
                      {cs.outcome && <div className="case-outcome">{cs.outcome}</div>}
                      {subject && (
                        <div className="case-meta">
                          <span>👤 {subject}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {cases.length > 2 && (
                <button
                  type="button"
                  onClick={() => setCasesExpanded((v) => !v)}
                  style={{
                    width: "100%", marginTop: 12, padding: "12px 16px", minHeight: 48,
                    background: "transparent", border: "1px solid #4A6355", borderRadius: 10,
                    color: "#4A6355", fontSize: 14, fontWeight: 600, cursor: "pointer",
                    fontFamily: "'Gothic A1', sans-serif",
                  }}
                >
                  {casesExpanded ? "접기" : `상담 사례 더보기 (${cases.length - 2}건)`}
                </button>
              )}
            </>
          )}
        </div>

        {/* 환자 후기 — 후기 테이블 없음 → 빈 상태 */}
        <div className="prof-section">
          <div style={{ fontSize: 18, fontWeight: 600, color: "#2C3630", fontFamily: "'Gothic A1', sans-serif", marginBottom: 6 }}>
            💚 환자 후기
          </div>
          <div style={{ fontSize: 14, color: "#3D4A42", marginBottom: 14, lineHeight: 1.5 }}>
            실제 상담받은 분들의 개선 경험이에요
          </div>
          <div style={{ textAlign: "center", padding: "32px 16px", fontSize: 14, color: "#3D4A42", background: "#F8F9F7", borderRadius: 12 }}>
            아직 등록된 후기가 없어요
          </div>
        </div>

        {/* Hours — weekly_slots */}
        <div className="prof-section">
          <div className="prof-section-title">
            <span className="icon">🕐</span> 상담 가능 시간
          </div>
          {hasSlots ? (
            <div className="hours-grid">
              {slotDays.map(([k, label]) => (
                <div key={k} className="hours-item">
                  <div className="hours-day">{label}</div>
                  <div className="hours-time">
                    {(profile.weeklySlots?.[k] ?? []).join(", ")}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "32px 16px", fontSize: 14, color: "#3D4A42", background: "#F8F9F7", borderRadius: 12 }}>
              상담 가능 시간이 등록되지 않았어요
            </div>
          )}
        </div>

        {/* Pharmacy Info */}
        <div className="prof-section">
          <div className="prof-section-title">
            <span className="icon">🏥</span> 약국 정보
          </div>
          <div className="bio-text pharmacy-info">
            <div className="pharmacy-name">{profile.pharmacyName}</div>
            {profile.address && (
              <div className="pharmacy-details">📍 {profile.address}</div>
            )}
            {(profile.address || (profile.lat != null && profile.lng != null)) && (
              <div className="pharmacy-map">
                <a href={mapUrl} target="_blank" rel="noopener noreferrer">카카오맵에서 길찾기 →</a>
              </div>
            )}
          </div>
          {profile.pharmacyPhotos.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              {profile.pharmacyPhotos.map((url, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={i}
                  src={url}
                  alt={`${profile.pharmacyName} 사진 ${i + 1}`}
                  style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 10, border: "1px solid rgba(94,125,108,0.14)" }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="prof-bottom-cta" style={{ flexWrap: "wrap" }}>
        <div className="cta-info" style={{ minWidth: 0 }}>
          <div className="cta-free">무료 상담</div>
          <div className="cta-sub">약사님이 수락하면 채팅이 시작돼요</div>
        </div>
        <button
          className={`cta-btn${requested ? " requested" : ""}`}
          onClick={handleRequest}
          disabled={requested}
          style={{ flexShrink: 1 }}
        >
          {requested ? "요청 완료 ✓" : "상담 요청하기"}
        </button>
      </div>
    </div>
  );
}
