"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Mock data — 추후 Supabase에서 약사 ID로 조회
const MOCK_PHARMACIST = {
  name: "김서연 약사",
  avatar: "👩‍⚕️",
  pharmacyName: "초록숲 약국",
  address: "서울 강남구 역삼동",
  fullAddress: "서울 강남구 역삼로 123 1층",
  phone: "02-1234-5678",
  parking: "건물 내 주차 가능 (1시간 무료)",
  distance: "1.2km",
  walkTime: "도보 16분",
  matchRate: 94,
  matchDesc: "소화장애 · 만성피로 · 불면에 높은 전문성",
  stats: {
    cases: 24,
    avgResponse: "2h",
    returnRate: "89%",
  },
  badges: [
    { label: "👑 베스트 약사", gold: true },
    { label: "⚡ 빠른 답변", gold: false },
    { label: "⭐ 개선 확인 24건", gold: false },
  ],
  bio: "안녕하세요, 15년차 약사 김서연입니다. 소화기 건강과 만성피로 영양 관리를 중심으로 상담하고 있어요. 병원에서 이상 없다는 말에 답답하셨던 분들, 영양 밸런스부터 다시 잡아볼게요. 한 분 한 분 꼼꼼히 상담 드립니다.",
  expertSpecialties: ["소화장애", "만성피로", "수면 관리"],
  availableSpecialties: ["비염", "두통", "우울·불안", "생리통", "면역·염증"],
  improvements: [
    { emoji: "🫠", area: "소화장애", score: "평균 3.2점 개선", fill: 85 },
    { emoji: "😴", area: "만성피로", score: "평균 2.8점 개선", fill: 72 },
    { emoji: "🌙", area: "수면 관리", score: "평균 2.5점 개선", fill: 65 },
  ],
  caseStudies: [
    {
      symptoms: ["소화장애", "만성피로"],
      duration: "8주 관리",
      title:
        "30대 여성, 3년간 지속된 더부룩함과 오후 피로감이 유산균 + 비타민B군 조합으로 눈에 띄게 개선",
      outcome: "📈 에너지 3→7 · 소화 2→6",
      meta: { age: "30대 여성", date: "2026.03" },
    },
    {
      symptoms: ["불면", "우울·불안"],
      duration: "12주 관리",
      title:
        "40대 남성, 수면제 없이 잠들기 어려웠던 분이 마그네슘 + 생활습관 개선으로 수면의 질 회복",
      outcome: "📈 수면 2→7 · 기분 3→6",
      meta: { age: "40대 남성", date: "2026.02" },
    },
  ],
  hours: [
    { day: "월 ~ 금", time: "09:00 ~ 18:00" },
    { day: "토요일", time: "09:00 ~ 13:00" },
    { day: "일요일", time: "휴무", closed: true },
    { day: "점심시간", time: "12:00 ~ 13:00" },
  ],
};

export default function PharmacistClient() {
  const router = useRouter();
  const [requested, setRequested] = useState(false);
  const data = MOCK_PHARMACIST;
  const revealRefs = useRef<(HTMLElement | null)[]>([]);

  // Scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.15 }
    );
    revealRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const addRevealRef = (el: HTMLElement | null) => {
    if (el && !revealRefs.current.includes(el)) {
      revealRefs.current.push(el);
    }
  };

  const handleRequest = () => {
    setRequested(true);
    setTimeout(() => {
      alert(
        `${data.name}에게 상담을 요청했어요!\n약사가 수락하면 채팅이 시작됩니다.`
      );
    }, 300);
  };

  return (
    <div className="pharmacist-page">
      <nav>
        <button className="nav-back" onClick={() => router.back()} aria-label="뒤로가기">
          ←
        </button>
        <div className="nav-title">약사 프로필</div>
      </nav>

      <div className="pharm-container">
        {/* Profile Hero */}
        <div className="profile-hero">
          <div className="avatar-wrap">
            <div className="avatar">{data.avatar}</div>
            <div className="avatar-badge">⭐</div>
          </div>
          <h1 className="profile-name">{data.name}</h1>
          <p className="profile-pharmacy">
            {data.pharmacyName} · {data.address}
          </p>
          <span className="profile-distance">
            📍 {data.distance} · {data.walkTime}
          </span>
          <div className="badges-row">
            {data.badges.map((b) => (
              <span
                key={b.label}
                className={`badge-chip${b.gold ? " gold" : ""}`}
              >
                {b.label}
              </span>
            ))}
          </div>
        </div>

        {/* Match Score */}
        <div className="prof-section">
          <div className="prof-match-card">
            <div className="prof-match-score">{data.matchRate}%</div>
            <div className="prof-match-info" style={{ minWidth: 0 }}>
              <div className="prof-match-title">내 증상과 매칭률</div>
              <div className="prof-match-desc">{data.matchDesc}</div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          {[
            { num: data.stats.cases, label: "개선 확인" },
            { num: data.stats.avgResponse, label: "평균 답변" },
            { num: data.stats.returnRate, label: "재상담률" },
          ].map((s) => (
            <div key={s.label} className="stat-item">
              <div className="stat-num">{s.num}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Bio */}
        <div className="prof-section reveal" ref={addRevealRef}>
          <div className="prof-section-title">
            <span className="icon">💬</span> 소개
          </div>
          <div className="bio-text">{data.bio}</div>
        </div>

        {/* Specialties */}
        <div className="prof-section reveal" ref={addRevealRef}>
          <div className="prof-section-title">
            <span className="icon">🎯</span> 전문 분야
          </div>
          <div className="specialty-group">
            <div className="specialty-label">✦ 전문</div>
            <div className="specialty-tags">
              {data.expertSpecialties.map((s) => (
                <span key={s} className="s-tag s-tag-expert">{s}</span>
              ))}
            </div>
          </div>
          <div className="specialty-group" style={{ marginTop: 14 }}>
            <div className="specialty-label">상담 가능</div>
            <div className="specialty-tags">
              {data.availableSpecialties.map((s) => (
                <span key={s} className="s-tag s-tag-available">{s}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Improvement Stats */}
        <div className="prof-section reveal" ref={addRevealRef}>
          <div className="prof-section-title">
            <span className="icon">📈</span> 분야별 개선 현황
          </div>
          <div className="improve-list">
            {data.improvements.map((item) => (
              <div key={item.area} className="improve-item">
                <span className="improve-emoji">{item.emoji}</span>
                <div className="improve-info">
                  <div className="improve-area">{item.area}</div>
                  <div className="improve-score">{item.score}</div>
                </div>
                <div className="improve-bar">
                  <div
                    className="improve-fill"
                    style={{ width: `${item.fill}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Case Studies */}
        <div className="prof-section reveal" ref={addRevealRef}>
          <div className="prof-section-title">
            <span className="icon">📋</span> 상담 사례
          </div>
          <div className="case-list">
            {data.caseStudies.map((cs, i) => (
              <div key={i} className="case-card">
                <div className="case-header">
                  <div className="case-symptoms">
                    {cs.symptoms.map((s) => (
                      <span key={s} className="case-symptom">{s}</span>
                    ))}
                  </div>
                  <span className="case-duration">{cs.duration}</span>
                </div>
                <div className="case-title">{cs.title}</div>
                <div className="case-outcome">{cs.outcome}</div>
                <div className="case-meta">
                  <span>👤 {cs.meta.age}</span>
                  <span>🗓️ {cs.meta.date}</span>
                </div>
              </div>
            ))}
          </div>
          <a href="#" className="see-more">상담 사례 더보기 →</a>
        </div>

        {/* Hours */}
        <div className="prof-section reveal" ref={addRevealRef}>
          <div className="prof-section-title">
            <span className="icon">🕐</span> 상담 가능 시간
          </div>
          <div className="hours-grid">
            {data.hours.map((h) => (
              <div key={h.day} className="hours-item">
                <div className="hours-day">{h.day}</div>
                <div className={`hours-time${h.closed ? " hours-closed" : ""}`}>
                  {h.time}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pharmacy Info */}
        <div className="prof-section reveal" ref={addRevealRef}>
          <div className="prof-section-title">
            <span className="icon">🏥</span> 약국 정보
          </div>
          <div className="bio-text pharmacy-info">
            <div className="pharmacy-name">{data.pharmacyName}</div>
            <div className="pharmacy-details">
              📍 {data.fullAddress}
              <br />
              📞 {data.phone}
              <br />
              🅿️ {data.parking}
            </div>
            <div className="pharmacy-map">
              <a href="#">카카오맵에서 길찾기 →</a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="prof-bottom-cta" style={{ flexWrap: "wrap" }}>
        <div className="cta-info" style={{ minWidth: 0 }}>
          <div className="cta-free">무료 상담</div>
          <div className="cta-sub">약사가 수락하면 채팅이 시작돼요</div>
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
