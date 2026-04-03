"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SYMPTOMS } from "@/lib/symptoms";

export default function LandingClient() {
  return (
    <Suspense>
      <LandingContent />
    </Suspense>
  );
}

function LandingContent() {
  const searchParams = useSearchParams();
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [navScrolled, setNavScrolled] = useState(false);
  const revealRefs = useRef<(HTMLElement | null)[]>([]);

  // URL 파라미터에서 증상 자동 선택
  useEffect(() => {
    const symptomParam = searchParams.get("symptom");
    if (symptomParam) {
      const preselected = symptomParam.split(",").map((s) => s.trim());
      setSelectedSymptoms(preselected);
    }
  }, [searchParams]);

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

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const signupHref =
    selectedSymptoms.length > 0
      ? `/signup?symptom=${encodeURIComponent(selectedSymptoms.join(","))}`
      : "/signup";

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
          <p className="hero-sub">근거리 전문 약사 매칭 서비스</p>
          <h1>
            요즘 어디가
            <br />
            불편하세요?
          </h1>
          <p className="hero-desc">
            해당하는 증상을 골라주세요. 가까운 전문 약사가 도와드릴게요.
          </p>

          <div className="symptom-grid">
            {SYMPTOMS.map((s) => (
              <div
                key={s.id}
                className={`symptom-chip${selectedSymptoms.includes(s.id) ? " selected" : ""}`}
                onClick={() => toggleSymptom(s.id)}
              >
                <span className="emoji">{s.emoji}</span>
                <span className="chip-title">{s.label}</span>
              </div>
            ))}
          </div>

          <div className={`hero-next${selectedSymptoms.length > 0 ? " show" : ""}`}>
            <p className="hero-next-text">
              <strong>{selectedSymptoms.join(", ")}</strong> 관련 전문 약사{" "}
              <strong>3명</strong>이 근처에 있어요
            </p>
            <Link href={signupHref} className="btn-start">
              무료로 상담 시작 <span className="arrow">→</span>
            </Link>
          </div>

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
            <div className="pharm-cases">
              개선 사례
              <br />
              <strong>24건</strong>
            </div>
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
            <div className="pharm-cases">
              개선 사례
              <br />
              <strong>18건</strong>
            </div>
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
            <div className="pharm-cases">
              개선 사례
              <br />
              <strong>31건</strong>
            </div>
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
