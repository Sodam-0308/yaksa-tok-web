"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  IconBattery, IconBowl, IconMoon, IconFemale, IconSkin, IconAllergy,
  IconKnot, IconSadFace, IconHair, IconScale, IconAntiAging, IconImmune,
} from "@/components/SymptomIcon";

/* ══════════════════════════════════════════
   증상 데이터
   ══════════════════════════════════════════ */

interface LandingSymptom {
  id: string;
  label: string;
  bg: string;
  icon: React.ReactNode;
}

const MAIN_SYMPTOMS: LandingSymptom[] = [
  { id: "만성피로", label: "만성피로", bg: "#EAF3DE", icon: <IconBattery /> },
  { id: "소화장애", label: "소화장애", bg: "#FAEEDA", icon: <IconBowl /> },
  { id: "불면/수면", label: "불면/수면", bg: "#E6F1FB", icon: <IconMoon /> },
  { id: "여성건강/생리통", label: "여성건강/생리통", bg: "#FAECE7", icon: <IconFemale /> },
  { id: "피부", label: "피부", bg: "#FAECE7", icon: <IconSkin /> },
  { id: "비염/알레르기", label: "비염/알레르기", bg: "#E1F5EE", icon: <IconAllergy /> },
  { id: "변비/장건강", label: "변비/장건강", bg: "#FAEEDA", icon: <IconKnot /> },
  { id: "우울/불안/스트레스", label: "우울/불안/스트레스", bg: "#EEEDFE", icon: <IconSadFace /> },
  { id: "탈모", label: "탈모", bg: "#FAECE7", icon: <IconHair /> },
  { id: "체중 관리/붓기", label: "체중 관리/붓기", bg: "#EAF3DE", icon: <IconScale /> },
  { id: "항노화/항산화", label: "항노화/항산화", bg: "#FAECE7", icon: <IconAntiAging /> },
  { id: "면역력저하", label: "면역력저하", bg: "#E1F5EE", icon: <IconImmune /> },
];

const EXTRA_SYMPTOMS = [
  "두통/목어깨결림",
  "수족냉증",
  "안구건조",
  "관절/뼈",
  "간 건강",
  "갱년기",
  "남성건강",
];

export default function LandingClient() {
  return (
    <Suspense>
      <LandingContent />
    </Suspense>
  );
}

function LandingContent() {
  const router = useRouter();
  const [navScrolled, setNavScrolled] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [customSymptom, setCustomSymptom] = useState("");
  const revealRefs = useRef<(HTMLElement | null)[]>([]);

  // Nav scroll effect
  useEffect(() => {
    const handleScroll = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  const goToQuestionnaire = (symptom: string) => {
    router.push(`/questionnaire?symptom=${encodeURIComponent(symptom)}&reset=1`);
  };

  return (
    <div className="landing-page">
      <nav className={navScrolled ? "scrolled" : ""}>
        <a href="#" className="nav-logo">
          약사톡<span>.</span>
        </a>
        <div className="nav-right">
          <a href="#how" className="nav-link">이용방법</a>
          <a href="#pharmacists" className="nav-link">약사 소개</a>
          <Link href="/signup" className="nav-cta">시작하기</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-inner">
          <p className="hero-sub">가까운 상담 전문 약사 매칭 서비스</p>
          <h1>
            요즘 어디가
            <br />
            불편하세요?
          </h1>
          <p className="hero-desc">
            해당하는 증상을 골라주세요. 가까운 전문 약사가 도와드릴게요.
          </p>

          {/* 메인 증상 10개 — 4열 그리드 */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
            maxWidth: 440,
            margin: "0 auto",
          }}>
            {MAIN_SYMPTOMS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goToQuestionnaire(s.id)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    padding: "12px 4px 10px",
                    borderRadius: 14,
                    border: "2px solid transparent",
                    background: "var(--white, #fff)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  }}
                >
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: s.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {s.icon}
                  </div>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-dark, #2C3630)",
                    textAlign: "center",
                    lineHeight: 1.3,
                    wordBreak: "keep-all",
                  }}>
                    {s.label}
                  </span>
                </button>
            ))}
          </div>

          {/* 찾는 증상이 없나요? */}
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              style={{
                padding: "8px 20px",
                borderRadius: 100,
                fontSize: 14,
                fontWeight: 600,
                background: "var(--sage-pale, #EDF4F0)",
                color: "var(--sage-deep, #4A6355)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {showMore ? "접기 ▲" : "찾는 증상이 없나요? ▼"}
            </button>
          </div>

          {/* 더보기 증상 태그 */}
          {showMore && (
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "center",
              marginTop: 12,
              maxWidth: 440,
              marginLeft: "auto",
              marginRight: "auto",
            }}>
              {EXTRA_SYMPTOMS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => goToQuestionnaire(label)}
                    style={{
                      padding: "7px 16px",
                      borderRadius: 100,
                      fontSize: 14,
                      fontWeight: 500,
                      background: "var(--white, #fff)",
                      color: "var(--text-mid, #3D4A42)",
                      border: "1.5px solid var(--border, rgba(94,125,108,0.14))",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {label}
                  </button>
              ))}
            </div>
          )}

          {/* 증상 직접 입력 */}
          {showMore && (
            <div style={{
              maxWidth: 440,
              margin: "14px auto 0",
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}>
              <input
                type="text"
                value={customSymptom}
                onChange={(e) => setCustomSymptom(e.target.value)}
                placeholder="증상을 직접 입력하세요"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1.5px solid var(--border, rgba(94,125,108,0.14))",
                  fontSize: 14,
                  color: "var(--text-dark, #2C3630)",
                  outline: "none",
                  fontFamily: "'Noto Sans KR', sans-serif",
                  background: "var(--white, #fff)",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customSymptom.trim()) {
                    e.preventDefault();
                    goToQuestionnaire(customSymptom.trim());
                  }
                }}
              />
              {customSymptom.trim() && (
                <button
                  type="button"
                  onClick={() => goToQuestionnaire(customSymptom.trim())}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 700,
                    background: "var(--terra, #C06B45)",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  시작하기
                </button>
              )}
            </div>
          )}

          <div className="hero-trust">
            <div className="trust-item">
              <span className="trust-dot" /> 무료 상담
            </div>
            <div className="trust-item">
              <span className="trust-dot" /> 5km 내 매칭
            </div>
            <div className="trust-item">
              <span className="trust-dot" /> 24시간 내 답변
            </div>
          </div>

          <div className="scroll-down-indicator">
            <span className="scroll-arrow">↓</span>
          </div>
        </div>
      </section>

      <div className="insight-banner reveal" ref={addRevealRef}>
        <p>같은 증상이라도 사람마다 원인이 다릅니다.<br />그래서 <strong>1:1 맞춤 상담</strong>이 필요해요.</p>
      </div>

      <section className="how-section" id="how">
        <div className="how-inner">
          <div className="how-header reveal" ref={addRevealRef}>
            <div className="how-tag">이용방법</div>
            <h2 className="how-title">3단계면 충분해요</h2>
          </div>
          <div>
            <div className="how-step reveal" ref={addRevealRef}>
              <div className="step-num">1</div>
              <div className="step-content">
                <h3>증상 분석</h3>
                <p>AI가 12가지 질문으로 증상을 꼼꼼히 파악합니다. 3분이면 끝나요.</p>
              </div>
            </div>
            <div className="how-step reveal reveal-d1" ref={addRevealRef}>
              <div className="step-num">2</div>
              <div className="step-content">
                <h3>약사 매칭 &amp; 채팅 상담</h3>
                <p>내 증상에 맞는 5km 이내 약사가 자동 배정돼요. 편하게 채팅으로 상담하세요.</p>
              </div>
            </div>
            <div className="how-step reveal reveal-d2" ref={addRevealRef}>
              <div className="step-num">3</div>
              <div className="step-content">
                <h3>약국 방문 &amp; 맞춤 관리</h3>
                <p>약사의 안내에 따라 약국을 방문하면, 나에게 맞는 영양요법과 관리를 시작합니다.</p>
              </div>
            </div>
          </div>
          <div className="reveal" ref={addRevealRef} style={{ textAlign: "center", marginTop: 40 }}>
            <Link href="/questionnaire" className="btn-start">
              무료로 상담 시작 <span className="arrow">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="pharm-section" id="pharmacists">
        <div className="pharm-inner">
          <div className="pharm-header reveal" ref={addRevealRef}>
            <div className="how-tag">전문 약사</div>
            <h2 className="how-title">이런 약사들이 기다리고 있어요</h2>
          </div>
          <div className="pharm-card reveal" ref={addRevealRef}>
            <div className="pharm-avatar">👩‍⚕️</div>
            <div className="pharm-info">
              <div className="pharm-name">김서연 약사</div>
              <div className="pharm-loc">초록숲 약국 · 서울 강남</div>
              <div className="pharm-tags">
                <span className="p-tag p-tag-s">소화장애</span>
                <span className="p-tag p-tag-t">만성피로</span>
              </div>
            </div>
            <Link href="/feed" style={{ color: "#C06B45", fontSize: 14, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3, whiteSpace: "nowrap", flexShrink: 0 }}>
              개선 사례 보기 →
            </Link>
          </div>
          <div className="pharm-card reveal reveal-d1" ref={addRevealRef}>
            <div className="pharm-avatar">👨‍⚕️</div>
            <div className="pharm-info">
              <div className="pharm-name">박준호 약사</div>
              <div className="pharm-loc">자연담은 약국 · 전주 완산</div>
              <div className="pharm-tags">
                <span className="p-tag p-tag-l">불면·우울</span>
                <span className="p-tag p-tag-b">비염</span>
              </div>
            </div>
            <Link href="/feed" style={{ color: "#C06B45", fontSize: 14, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3, whiteSpace: "nowrap", flexShrink: 0 }}>
              개선 사례 보기 →
            </Link>
          </div>
          <div className="pharm-card reveal reveal-d2" ref={addRevealRef}>
            <div className="pharm-avatar">👩‍⚕️</div>
            <div className="pharm-info">
              <div className="pharm-name">이하은 약사</div>
              <div className="pharm-loc">봄빛 약국 · 부산 해운대</div>
              <div className="pharm-tags">
                <span className="p-tag p-tag-r">여드름·아토피</span>
                <span className="p-tag p-tag-s">생리통</span>
              </div>
            </div>
            <Link href="/feed" style={{ color: "#C06B45", fontSize: 14, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3, whiteSpace: "nowrap", flexShrink: 0 }}>
              개선 사례 보기 →
            </Link>
          </div>
        </div>
      </section>

      <section className="bottom-cta">
        <div className="bottom-cta-inner reveal" ref={addRevealRef}>
          <h2>
            가까운 약사에게
            <br />
            편하게 물어보세요
          </h2>
          <p>가입부터 상담까지 무료. 부담 없이 시작하세요.</p>
          <button
            className="btn-white"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            증상 선택하러 가기 ↑
          </button>
        </div>
      </section>

      <footer>
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              약사톡<span>.</span>
            </div>
            <div className="footer-links">
              <a href="#">이용약관</a>
              <a href="#">개인정보처리방침</a>
              <a href="#">자주 묻는 질문</a>
            </div>
          </div>
          <div className="footer-legal">
            약사톡은 의료 행위를 하지 않으며, 영양 상담 연결 서비스를 제공합니다. 본 서비스는 의사의
            진료를 대체하지 않습니다.
          </div>
          <div className="footer-copy">© 2026 약사톡. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
