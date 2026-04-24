"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signInWithKakao } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";

const GENDERS = ["여성", "남성"];
const AGE_GROUPS = ["10대", "20대", "30대", "40대", "50대", "60대+"];

type Mode = "select" | "phone" | "social";

/* ══════════════════════════════════════════
   SVG 아이콘
   ══════════════════════════════════════════ */

function IconKakao() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 3C6.48 3 2 6.58 2 10.9c0 2.78 1.8 5.22 4.52 6.6-.2.73-.72 2.64-.82 3.05-.13.5.18.5.38.36.16-.1 2.5-1.7 3.52-2.4.78.12 1.58.18 2.4.18 5.52 0 10-3.58 10-7.9C22 6.58 17.52 3 12 3z" fill="#000" />
    </svg>
  );
}

function IconNaver() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M14.4 12.5L9.35 5H5v14h4.6v-7.5L14.65 19H19V5h-4.6v7.5z" fill="#fff" />
    </svg>
  );
}

function IconPhoneDevice() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sage-deep)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

/* ══════════════════════════════════════════
   Export
   ══════════════════════════════════════════ */

export default function SignupClient() {
  return (
    <Suspense>
      <SignupContent />
    </Suspense>
  );
}

/* ══════════════════════════════════════════
   메인
   ══════════════════════════════════════════ */

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  // ── 모드 ──
  const [mode, setMode] = useState<Mode>("select");

  // 이미 로그인된 상태이면 랜딩으로 (mode 변화 없이 최초 진입 시에만)
  useEffect(() => {
    if (!authLoading && user && mode === "select") {
      router.replace("/");
    }
  }, [authLoading, user, mode, router]);

  // ── 소셜 로그인 ──
  const [socialProvider, setSocialProvider] = useState<"kakao" | "naver" | null>(null);
  const [socialStep, setSocialStep] = useState(1);
  const [socialPhone, setSocialPhone] = useState("010-1234-5678");
  const socialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 중복 번호 팝업 ──
  const [showDuplicatePopup, setShowDuplicatePopup] = useState(false);

  // ── 소셜 로그인 안내 토스트 (네이버 준비 중 / 카카오 에러) ──
  const [socialToast, setSocialToast] = useState<string | null>(null);
  const socialToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showSocialToast = useCallback((msg: string) => {
    setSocialToast(msg);
    if (socialToastTimerRef.current) clearTimeout(socialToastTimerRef.current);
    socialToastTimerRef.current = setTimeout(() => setSocialToast(null), 2200);
  }, []);

  // ── URL ?error=auth 감지 (콜백 실패 시) ──
  useEffect(() => {
    if (searchParams.get("error") === "auth") {
      showSocialToast("로그인에 실패했어요. 다시 시도해주세요.");
    }
  }, [searchParams, showSocialToast]);

  // ── 휴대폰 OTP flow (기존) ──
  const [currentStep, setCurrentStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [timer, setTimer] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [ageGroup, setAgeGroup] = useState<string | null>(null);

  // Timer (기존)
  useEffect(() => {
    if (timer <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1 && timerRef.current) clearInterval(timerRef.current);
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timer > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatPhone = (value: string) => {
    const digits = value.replace(/[^0-9]/g, "").slice(0, 11);
    if (digits.length > 7)
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    if (digits.length > 3)
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return digits;
  };

  const phoneDigits = phone.replace(/-/g, "");

  const sendOTP = () => {
    if (phoneDigits.length < 10) return;
    setOtpSent(true);
    setTimer(180);
  };

  useEffect(() => {
    if (otpSent) {
      requestAnimationFrame(() => otpRefs.current[0]?.focus());
    }
  }, [otpSent]);

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/[^0-9]/g, "");
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    if (digit && index < 3) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter" && otpFilled) {
      verifyOTP();
    }
  };

  const otpFilled = otp.every((d) => d !== "");

  const verifyOTP = () => {
    if (!otpFilled) return;
    // Mock: 010-1234-5678 → 이미 가입된 번호
    if (phoneDigits === "01012345678") {
      setShowDuplicatePopup(true);
      return;
    }
    setCurrentStep(2);
  };

  const step2Valid = name.trim() && gender && ageGroup;

  const goToStep3 = () => {
    setCurrentStep(3);
  };

  const goToQuestionnaire = () => {
    const symptom = searchParams.get("symptom");
    const params = new URLSearchParams();
    if (symptom) params.set("symptom", symptom);
    if (gender) params.set("gender", gender);
    router.push(`/questionnaire${params.toString() ? "?" + params.toString() : ""}`);
  };

  // ── 소셜 로그인 ──
  const startSocial = async (provider: "kakao" | "naver") => {
    if (provider === "naver") {
      showSocialToast("네이버 로그인은 준비 중입니다.");
      return;
    }
    // 카카오: 실제 OAuth 호출. 성공 시 브라우저가 카카오 인증 페이지로 이동하므로 이 컴포넌트는 언마운트됨
    try {
      const { error } = await signInWithKakao();
      if (error) {
        showSocialToast("카카오 로그인을 시작할 수 없어요. 잠시 후 다시 시도해주세요.");
      }
    } catch {
      showSocialToast("카카오 로그인 중 문제가 발생했어요.");
    }
  };

  useEffect(() => {
    return () => {
      if (socialTimerRef.current) clearTimeout(socialTimerRef.current);
      if (socialToastTimerRef.current) clearTimeout(socialToastTimerRef.current);
    };
  }, []);

  const confirmSocialPhone = () => {
    const digits = socialPhone.replace(/-/g, "");
    if (digits === "01012345678") {
      setShowDuplicatePopup(true);
      return;
    }
    setSocialStep(3);
  };

  const providerLabel = socialProvider === "kakao" ? "카카오" : "네이버";

  // ── 뒤로가기 ──
  const goBack = useCallback(() => {
    if (mode === "select") {
      router.push("/");
    } else if (mode === "phone") {
      if (currentStep === 1) {
        setMode("select");
        setPhone("");
        setOtpSent(false);
        setOtp(["", "", "", ""]);
        setTimer(0);
      } else {
        setCurrentStep((s) => s - 1);
      }
    } else if (mode === "social") {
      if (socialTimerRef.current) clearTimeout(socialTimerRef.current);
      setMode("select");
      setSocialStep(1);
      setSocialProvider(null);
    }
  }, [mode, currentStep, router]);

  const timerDisplay = `${String(Math.floor(timer / 60)).padStart(2, "0")}:${String(timer % 60).padStart(2, "0")}`;

  // 전역 엔터키 핸들러
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (showDuplicatePopup) return;
      if (mode === "phone") {
        if (currentStep === 1) {
          if (!otpSent && phoneDigits.length >= 10) {
            e.preventDefault();
            sendOTP();
          } else if (otpSent && otpFilled) {
            e.preventDefault();
            verifyOTP();
          }
        } else if (currentStep === 2 && step2Valid) {
          e.preventDefault();
          goToStep3();
        } else if (currentStep === 3) {
          e.preventDefault();
          goToQuestionnaire();
        }
      } else if (mode === "social") {
        if (socialStep === 2) {
          e.preventDefault();
          confirmSocialPhone();
        } else if (socialStep === 3) {
          e.preventDefault();
          router.push("/");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const stepAnimation = (step: number) => {
    if (step === 1) return "animate-fade-up";
    return "animate-slide-left";
  };

  // 소셜 버튼 공통 스타일
  const socialBtn: React.CSSProperties = {
    width: "100%",
    height: 56,
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    cursor: "pointer",
    border: "none",
    fontFamily: "'Noto Sans KR', sans-serif",
  };

  return (
    <>
      <style>{`
        .su-social-kakao:hover{filter:brightness(0.95)}.su-social-kakao:active{filter:brightness(0.9)}
        .su-social-naver:hover{filter:brightness(0.95)}.su-social-naver:active{filter:brightness(0.9)}
        .su-social-phone:hover{background:var(--sage-bg)!important}.su-social-phone:active{background:var(--sage-pale)!important}
        @keyframes su-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>

      <div className="signup-page">
        <nav>
          <button className="nav-back" onClick={goBack} aria-label="뒤로가기">
            ←
          </button>
          <div className="nav-title">시작하기</div>
        </nav>

        <div className="signup-container">
          <div className="signup-card">

            {/* ═══════════════════════════════════
                모드: 로그인 방식 선택
               ═══════════════════════════════════ */}
            {mode === "select" && (
              <div className="step animate-fade-up">
                <div style={{ textAlign: "center", marginBottom: 40, paddingTop: 8 }}>
                  <h1 style={{
                    fontFamily: "'Gothic A1', sans-serif",
                    fontSize: 24,
                    fontWeight: 700,
                    color: "var(--text-dark)",
                    marginBottom: 8,
                    lineHeight: 1.3,
                  }}>
                    약사톡 시작하기
                  </h1>
                  <p style={{ fontSize: 15, color: "var(--text-mid)", margin: 0 }}>
                    간편하게 시작해보세요
                  </p>
                </div>

                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    color: "#C06B45",
                    textAlign: "center",
                    marginBottom: 12,
                  }}
                >
                  10초만에 가입 완료!
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* 카카오 */}
                  <button
                    type="button"
                    className="su-social-kakao"
                    onClick={() => startSocial("kakao")}
                    style={{ ...socialBtn, background: "#FEE500", color: "#000" }}
                  >
                    <IconKakao />
                    카카오로 시작하기
                  </button>

                  {/* 네이버 */}
                  <button
                    type="button"
                    className="su-social-naver"
                    onClick={() => startSocial("naver")}
                    style={{ ...socialBtn, background: "#03C75A", color: "#fff" }}
                  >
                    <IconNaver />
                    네이버로 시작하기
                  </button>

                  {/* 휴대폰 */}
                  <button
                    type="button"
                    className="su-social-phone"
                    onClick={() => { setMode("phone"); setCurrentStep(1); }}
                    style={{ ...socialBtn, background: "#fff", color: "var(--text-dark)", border: "1px solid var(--border)" }}
                  >
                    <IconPhoneDevice />
                    휴대폰 번호로 시작하기
                  </button>
                </div>

                {/* 혜택 안내 */}
                <div style={{
                  marginTop: 28,
                  background: "var(--sage-pale)",
                  borderRadius: 12,
                  padding: 20,
                }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-dark)", marginBottom: 14 }}>
                    약사톡에서 이런 게 가능해요
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {[
                      { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sage-deep)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>, text: "약사와 1:1 채팅 상담" },
                      { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sage-deep)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/></svg>, text: "AI 문답으로 증상 분석·저장" },
                      { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sage-deep)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>, text: "몸 상태 체크로 개선 확인" },
                      { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"/></svg>, text: "맞춤 복용 가이드 제공" },
                      { icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sage-deep)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, text: "내 전담 약사님 만들기" },
                    ].map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flexShrink: 0 }}>{item.icon}</div>
                        <span style={{ fontSize: 14, color: "var(--text-mid)", fontWeight: 500 }}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ textAlign: "center", marginTop: 24, fontSize: 14 }}>
                  <span style={{ color: "var(--text-mid)" }}>이미 계정이 있으신가요? </span>
                  <button
                    type="button"
                    onClick={() => { setMode("phone"); setCurrentStep(1); }}
                    style={{
                      background: "none", border: "none", padding: 0,
                      color: "var(--sage-deep)", textDecoration: "underline",
                      cursor: "pointer", fontSize: 14, fontWeight: 600,
                    }}
                  >
                    로그인
                  </button>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════
                모드: 휴대폰 OTP (기존 3단계 그대로)
               ═══════════════════════════════════ */}
            {mode === "phone" && (
              <>
                {/* Step 1: Phone */}
                {currentStep === 1 && (
                  <div className={`step ${stepAnimation(1)}`}>
                    <div className="step-progress">
                      <div className="progress-dot active" />
                      <div className="progress-dot" />
                      <div className="progress-dot" />
                    </div>
                    <h1 className="step-title">
                      휴대폰 번호를
                      <br />
                      알려주세요
                    </h1>
                    <p className="step-desc">
                      본인 확인을 위해 인증번호를 보내드릴게요.
                    </p>

                    <div className="input-group">
                      <div className="phone-row">
                        <input
                          type="tel"
                          className="input-field"
                          placeholder="010-0000-0000"
                          maxLength={13}
                          value={phone}
                          onChange={(e) => setPhone(formatPhone(e.target.value))}
                        />
                        <button
                          className={`btn-send-otp${otpSent ? " sent" : ""}`}
                          disabled={phoneDigits.length < 10}
                          onClick={sendOTP}
                        >
                          {otpSent ? "재전송" : "인증번호 받기"}
                        </button>
                      </div>
                    </div>

                    {otpSent && (
                      <div className="input-group">
                        <label className="input-label">인증번호 4자리</label>
                        <div className="otp-row">
                          {otp.map((digit, i) => (
                            <input
                              key={i}
                              ref={(el) => { otpRefs.current[i] = el; }}
                              type="tel"
                              maxLength={1}
                              value={digit}
                              onChange={(e) => handleOtpChange(i, e.target.value)}
                              onKeyDown={(e) => handleOtpKeyDown(i, e)}
                              className={`otp-input${digit ? " filled" : ""}`}
                            />
                          ))}
                        </div>
                        <div className="otp-timer">
                          {timer > 0 ? timerDisplay : "시간 초과"}
                        </div>
                        <div className="otp-resend">
                          인증번호가 안 왔나요?{" "}
                          <button onClick={sendOTP}>다시 받기</button>
                        </div>
                      </div>
                    )}

                    <button
                      className="btn-next"
                      disabled={!otpFilled}
                      onClick={verifyOTP}
                    >
                      인증 확인 <span className="arrow">→</span>
                    </button>

                    <div className="terms">
                      계속 진행하시면{" "}
                      <a href="#">이용약관</a>과{" "}
                      <a href="#">개인정보처리방침</a>에
                      동의하시는 것으로 간주합니다.
                    </div>
                  </div>
                )}

                {/* Step 2: Basic Info */}
                {currentStep === 2 && (
                  <div className={`step ${stepAnimation(2)}`}>
                    <div className="step-progress">
                      <div className="progress-dot done" />
                      <div className="progress-dot active" />
                      <div className="progress-dot" />
                    </div>
                    <h1 className="step-title">
                      간단한 정보만
                      <br />
                      알려주세요
                    </h1>
                    <p className="step-desc">
                      약사가 상담할 때 참고하는 기본 정보예요.
                    </p>

                    <div className="input-group">
                      <label className="input-label">이름</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="홍길동"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label">성별</label>
                      <div className="select-group">
                        {GENDERS.map((g) => (
                          <div
                            key={g}
                            role="button"
                            tabIndex={0}
                            className={`select-chip${gender === g ? " selected" : ""}`}
                            onClick={() => setGender(g)}
                            onKeyDown={(e) => {
                              if (e.code === "Space" || e.code === "Enter") {
                                e.preventDefault();
                                setGender(g);
                              }
                            }}
                          >
                            {g}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="input-group">
                      <label className="input-label">연령대</label>
                      <div className="age-grid">
                        {AGE_GROUPS.map((age) => (
                          <div
                            key={age}
                            role="button"
                            tabIndex={0}
                            className={`age-chip${ageGroup === age ? " selected" : ""}`}
                            onClick={() => setAgeGroup(age)}
                            onKeyDown={(e) => {
                              if (e.code === "Space" || e.code === "Enter") {
                                e.preventDefault();
                                setAgeGroup(age);
                              }
                            }}
                          >
                            {age}
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      className="btn-next"
                      disabled={!step2Valid}
                      onClick={goToStep3}
                    >
                      다음 <span className="arrow">→</span>
                    </button>
                  </div>
                )}

                {/* Step 3: Complete */}
                {currentStep === 3 && (
                  <div className={`step ${stepAnimation(3)}`}>
                    <div className="step-progress">
                      <div className="progress-dot done" />
                      <div className="progress-dot done" />
                      <div className="progress-dot active" />
                    </div>

                    <div className="success-check">
                      <svg viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>

                    <h1 className="step-title" style={{ textAlign: "center" }}>
                      준비 완료!
                    </h1>
                    <div className="success-text">
                      <strong>{name || "회원"}</strong>님, 환영해요.
                      <br />
                      지금부터 증상을 분석하고
                      <br />
                      가까운 전문 약사를 찾아드릴게요.
                    </div>

                    <button className="btn-next" onClick={goToQuestionnaire}>
                      증상 분석 시작하기 <span className="arrow">→</span>
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ═══════════════════════════════════
                모드: 소셜 로그인
               ═══════════════════════════════════ */}
            {mode === "social" && (
              <>
                {/* Social Step 1: 로딩 */}
                {socialStep === 1 && (
                  <div className="step animate-fade-up" style={{ textAlign: "center", paddingTop: 60 }}>
                    <div style={{
                      width: 48, height: 48,
                      border: "3px solid var(--sage-light)",
                      borderTopColor: "var(--sage-deep)",
                      borderRadius: "50%",
                      margin: "0 auto 24px",
                      animation: "su-spin 1s linear infinite",
                    }} />
                    <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-dark)" }}>
                      {providerLabel} 계정으로 로그인 중...
                    </div>
                    <div style={{ fontSize: 14, color: "var(--text-mid)", marginTop: 8 }}>
                      잠시만 기다려주세요
                    </div>
                  </div>
                )}

                {/* Social Step 2: 휴대폰 번호 확인 */}
                {socialStep === 2 && (
                  <div className="step animate-slide-left">
                    <h1 className="step-title">
                      휴대폰 번호를
                      <br />
                      확인해주세요
                    </h1>
                    <p className="step-desc">
                      약사와의 연결을 위해 필요해요
                    </p>

                    <div className="input-group">
                      <label className="input-label">휴대폰 번호</label>
                      <input
                        type="tel"
                        className="input-field"
                        placeholder="010-0000-0000"
                        maxLength={13}
                        value={socialPhone}
                        onChange={(e) => setSocialPhone(formatPhone(e.target.value))}
                      />
                    </div>

                    <button className="btn-next" onClick={confirmSocialPhone}>
                      이 번호로 확인 <span className="arrow">→</span>
                    </button>
                  </div>
                )}

                {/* Social Step 3: 가입 완료 */}
                {socialStep === 3 && (
                  <div className="step animate-slide-left">
                    <div className="success-check">
                      <svg viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>

                    <h1 className="step-title" style={{ textAlign: "center" }}>
                      환영합니다, 김환자님!
                    </h1>
                    <div className="success-text">
                      {providerLabel} 계정으로 가입이 완료되었어요.
                      <br />
                      지금 바로 약사톡을 시작해보세요.
                    </div>

                    <button className="btn-next" onClick={() => router.push("/")}>
                      약사톡 시작하기 <span className="arrow">→</span>
                    </button>
                  </div>
                )}
              </>
            )}

          </div>
        </div>

        {/* ═══ 이미 가입된 번호 팝업 ═══ */}
        {showDuplicatePopup && (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 300,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,0.5)", padding: 20,
            }}
          >
            <div
              style={{
                background: "#fff", borderRadius: 16, padding: 24,
                maxWidth: 320, width: "100%", textAlign: "center",
                boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{
                fontSize: 18, fontWeight: 700, color: "var(--text-dark)",
                marginBottom: 8, fontFamily: "'Gothic A1', sans-serif",
              }}>
                이미 가입된 번호예요!
              </h2>
              <p style={{ fontSize: 15, color: "var(--text-mid)", marginBottom: 4 }}>
                기존 계정으로 로그인할까요?
              </p>
              <p style={{ fontSize: 14, color: "var(--sage-mid)", marginBottom: 20 }}>
                {mode === "social" ? socialPhone : phone}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowDuplicatePopup(false);
                    router.push("/");
                  }}
                  style={{
                    width: "100%", padding: "14px 0", borderRadius: 12,
                    fontSize: 15, fontWeight: 700,
                    background: "var(--sage-deep)", color: "#fff",
                    border: "none", cursor: "pointer",
                  }}
                >
                  기존 계정으로 로그인
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDuplicatePopup(false);
                    if (mode === "social") {
                      setSocialPhone("");
                    } else {
                      setPhone("");
                      setOtpSent(false);
                      setOtp(["", "", "", ""]);
                      setTimer(0);
                    }
                  }}
                  style={{
                    width: "100%", padding: "14px 0", borderRadius: 12,
                    fontSize: 15, fontWeight: 600,
                    background: "#fff", color: "var(--sage-deep)",
                    border: "1.5px solid var(--sage-deep)", cursor: "pointer",
                  }}
                >
                  다른 번호 사용
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
          <a
            href="/signup/pharmacist"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#5E7D6C",
              textDecoration: "none",
            }}
          >
            약사이신가요? <span style={{ textDecoration: "underline" }}>약사 가입하기 →</span>
          </a>
        </div>

        <div className="page-footer">
          약사톡은 의료 행위를 하지 않으며, 영양 상담 연결 서비스를 제공합니다.
        </div>

        {/* 소셜 로그인 안내 토스트 */}
        {socialToast && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "fixed",
              bottom: 32,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#2C3630",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
              zIndex: 300,
              maxWidth: "calc(100vw - 32px)",
              textAlign: "center",
            }}
          >
            {socialToast}
          </div>
        )}
      </div>
    </>
  );
}
