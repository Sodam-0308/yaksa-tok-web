"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const GENDERS = ["여성", "남성"];
const AGE_GROUPS = ["10대", "20대", "30대", "40대", "50대", "60대+"];

export default function SignupClient() {
  return (
    <Suspense>
      <SignupContent />
    </Suspense>
  );
}

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1 state
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [timer, setTimer] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 2 state
  const [name, setName] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [ageGroup, setAgeGroup] = useState<string | null>(null);

  // Timer
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

  // OTP 영역이 렌더링된 후 첫 번째 입력칸에 자동 포커스
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
    // OTP 4자리 입력 완료 후 엔터키 → 다음 단계 이동
    if (e.key === "Enter" && otpFilled) {
      verifyOTP();
    }
  };

  const otpFilled = otp.every((d) => d !== "");

  const verifyOTP = () => {
    if (!otpFilled) return;
    // TODO: Supabase Auth Phone OTP 검증
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

  const goBack = useCallback(() => {
    if (currentStep === 1) {
      router.push("/");
    } else {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep, router]);

  const timerDisplay = `${String(Math.floor(timer / 60)).padStart(2, "0")}:${String(timer % 60).padStart(2, "0")}`;

  // 전역 엔터키 핸들러
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
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
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // Step animation class
  const stepAnimation = (step: number) => {
    if (step === 1) return "animate-fade-up";
    return "animate-slide-left";
  };

  return (
    <div className="signup-page">
      <nav>
        <button className="nav-back" onClick={goBack} aria-label="뒤로가기">
          ←
        </button>
        <div className="nav-title">시작하기</div>
      </nav>

      <div className="signup-container">
        <div className="signup-card">
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
        </div>
      </div>

      <div className="page-footer">
        약사톡은 의료 행위를 하지 않으며, 영양 상담 연결 서비스를 제공합니다.
      </div>
    </div>
  );
}
