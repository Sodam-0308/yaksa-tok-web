"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

/* ══════════════════════════════════════════
   상수
   ══════════════════════════════════════════ */

const TOTAL_STEPS = 5;

/* TEMP-MOCK-OTP — NICE/KCB 본인인증 연동 시 아래 4줄 + sendOTP/verifyOTP 내 sessionStorage 로직 + 노란 안내 박스 모두 제거 */
const MOCK_OTP = "1234";
const OTP_STORAGE_KEY = "yaksa_mock_otp";
const OTP_TIMESTAMP_KEY = "yaksa_mock_otp_ts";
const OTP_EXPIRY_MS = 3 * 60 * 1000;

const SPECIALTIES = [
  "만성피로", "소화장애", "불면", "비염", "두통",
  "생리통", "여드름", "아토피", "우울·불안", "안구건조",
  "수족냉증", "붓기", "난임·임신준비", "아이성장", "갱년기",
] as const;

const C = {
  sageDeep: "#4A6355", sageBright: "#7FA48E", sagePale: "#EDF4F0",
  sageLight: "#B3CCBE", sageMid: "#5E7D6C",
  terra: "#C06B45",
  textDark: "#2C3630", textMid: "#3D4A42",
  border: "rgba(94, 125, 108, 0.14)", white: "#fff",
  // 진짜 에러용 빨강 (terra 와 구분)
  errorRed: "#D02F2F",
};

/* ══════════════════════════════════════════
   메인 컴포넌트
   ══════════════════════════════════════════ */

function PharmacistSignupContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  /* ── Step 1: 본인 인증 ── */
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", ""]); // 4자리
  const [otpError, setOtpError] = useState("");
  const [timer, setTimer] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Step 2: 기본 정보 ── */
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");

  /* ── Step 3: 면허 인증 ── */
  const [license, setLicense] = useState("");
  const [licenseName, setLicenseName] = useState("");

  /* ── Step 4: 약국 정보 ── */
  const [pharmacyName, setPharmacyName] = useState("");
  const [pharmacyAddr, setPharmacyAddr] = useState("");
  const [bizNumber, setBizNumber] = useState("");

  /* ── Step 5: 전문 분야 ── */
  const [specialties, setSpecialties] = useState<Set<string>>(new Set());

  /* ── 완료 ── */
  const [done, setDone] = useState(false);

  /* ═══ Timer ═══ */
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
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timer > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ═══ Phone helpers ═══ */
  const formatPhone = (v: string) => {
    const d = v.replace(/[^0-9]/g, "").slice(0, 11);
    if (d.length > 7) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
    if (d.length > 3) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return d;
  };
  const phoneDigits = phone.replace(/-/g, "");
  // 010 + 8자리 = 11자리 정확히 일치할 때만 유효
  const phoneValid = phoneDigits.length === 11 && phoneDigits.startsWith("010");

  /* TEMP-MOCK-OTP — sendOTP: 실제 SMS 미발송, sessionStorage에 고정 코드 저장 */
  const sendOTP = () => {
    if (!phoneValid) return;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(OTP_STORAGE_KEY, MOCK_OTP);
      sessionStorage.setItem(OTP_TIMESTAMP_KEY, String(Date.now()));
    }
    setOtpSent(true);
    setTimer(180);
    setOtp(["", "", "", ""]);
    setOtpError("");
  };

  useEffect(() => {
    if (otpSent) requestAnimationFrame(() => otpRefs.current[0]?.focus());
  }, [otpSent]);

  const handleOtpChange = (i: number, v: string) => {
    const digit = v.replace(/[^0-9]/g, "").slice(0, 1);
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    if (otpError) setOtpError(""); // 입력 시 에러 자동 해제
    if (digit && i < 3) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
    if (e.key === "Enter" && otpFilled) verifyOTP();
  };

  const otpFilled = otp.every((d) => d !== "");
  const enteredOtp = otp.join("");

  /* TEMP-MOCK-OTP — verifyOTP: sessionStorage 값과 비교 + 만료/일치 검사 */
  const verifyOTP = () => {
    if (!otpFilled) return;
    if (!/^[0-9]{4}$/.test(enteredOtp)) {
      setOtpError("인증번호 4자리를 정확히 입력해주세요");
      return;
    }
    if (typeof window !== "undefined") {
      const storedOtp = sessionStorage.getItem(OTP_STORAGE_KEY);
      const storedTs = sessionStorage.getItem(OTP_TIMESTAMP_KEY);
      if (!storedOtp || !storedTs) {
        setOtpError("인증번호를 먼저 받아주세요");
        return;
      }
      const elapsedMs = Date.now() - Number(storedTs);
      if (Number.isNaN(elapsedMs) || elapsedMs > OTP_EXPIRY_MS) {
        setOtpError("인증번호가 만료되었습니다. 다시 받아주세요");
        return;
      }
      if (enteredOtp !== storedOtp) {
        setOtpError("인증번호가 일치하지 않습니다");
        return;
      }
      // 인증 성공 — 재사용 방지를 위해 즉시 삭제
      sessionStorage.removeItem(OTP_STORAGE_KEY);
      sessionStorage.removeItem(OTP_TIMESTAMP_KEY);
    }
    setOtpError("");
    setStep(2);
  };

  const otpExpired = otpSent && timer <= 0;
  const otpReady = otpFilled && !otpExpired && /^[0-9]{4}$/.test(enteredOtp);

  const timerDisplay = `${String(Math.floor(timer / 60)).padStart(2, "0")}:${String(timer % 60).padStart(2, "0")}`;

  /* ═══ Biz number format ═══ */
  const formatBiz = (v: string) => {
    const d = v.replace(/[^0-9]/g, "").slice(0, 10);
    if (d.length > 5) return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
    if (d.length > 3) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return d;
  };

  /* ═══ Validity ═══ */
  // 완성형 한글 2~10자 (자음/모음 단독·영문·숫자·공백 모두 차단)
  const KOREAN_NAME_RE = /^[가-힣]{2,10}$/;

  // 이름 (Step 2)
  const nameTrimmed = name.trim();
  const nameValid = KOREAN_NAME_RE.test(nameTrimmed);
  const showNameError = nameTrimmed.length > 0 && !nameValid;

  // 생년월일 (Step 2) — YYYY-MM-DD 정확히 4-2-2 자리, 1940~2010 범위
  const BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const birthDateValid = (() => {
    if (!birthDate) return false;
    if (!BIRTH_DATE_RE.test(birthDate)) return false; // 6자리 년도 등 비표준 차단
    const d = new Date(birthDate);
    if (Number.isNaN(d.getTime())) return false;
    const y = d.getFullYear();
    return y >= 1940 && y <= 2010;
  })();
  const showBirthDateError = !!birthDate && !birthDateValid;

  // 면허증 이름 (Step 3)
  const licenseNameTrimmed = licenseName.trim();
  const licenseNameValid = KOREAN_NAME_RE.test(licenseNameTrimmed);
  const showLicenseNameError = licenseNameTrimmed.length > 0 && !licenseNameValid;

  // 약사 면허번호 (Step 3) — 숫자 4~6자리
  const LICENSE_NUMBER_RE = /^[0-9]{4,6}$/;
  const licenseTrimmed = license.trim();
  const licenseValid = LICENSE_NUMBER_RE.test(licenseTrimmed);
  const showLicenseError = licenseTrimmed.length > 0 && !licenseValid;

  const step2Valid = nameValid && birthDateValid;
  const step3Valid = licenseValid && licenseNameValid;
  const step4Valid = pharmacyName.trim() && pharmacyAddr.trim() && bizNumber.replace(/[^0-9]/g, "").length === 10;
  const step5Valid = specialties.size > 0 && specialties.size <= 3;

  /* ═══ Specialty toggle ═══ */
  const toggleSpec = (s: string) => {
    setSpecialties((prev) => {
      const n = new Set(prev);
      n.has(s) ? n.delete(s) : (n.size < 3 && n.add(s));
      return n;
    });
  };

  /* ═══ Navigation ═══ */
  const goBack = useCallback(() => {
    if (step === 1) router.push("/signup");
    else setStep((s) => s - 1);
  }, [step, router]);

  const handleComplete = async () => {
    if (submitting) return;

    // 면허증 이름 최종 검증 — disabled로 막혀 있더라도 안전망
    if (!licenseNameValid) {
      setStep(3);
      return;
    }

    if (!user) {
      // 인증 컨텍스트가 없는 경우(로그인 안 된 상태) — DB 저장 생략하고 완료 화면만 노출
      setDone(true);
      return;
    }

    setSubmitting(true);

    // pharmacist_profiles upsert (license_name 포함, onConflict=id)
    type PpUpsert = {
      id: string;
      pharmacy_name: string;
      address: string;
      license_number: string | null;
      license_name: string;
      business_number: string | null;
      expert_specialties?: string[];
    };
    const ppPayload: PpUpsert = {
      id: user.id,
      pharmacy_name: pharmacyName.trim(),
      address: pharmacyAddr.trim(),
      license_number: license.trim() || null,
      license_name: licenseNameTrimmed,
      business_number: bizNumber || null,
      expert_specialties: Array.from(specialties),
    };
    const ppRes = await (supabase
      .from("pharmacist_profiles") as unknown as {
        upsert: (
          p: PpUpsert,
          opts?: { onConflict?: string },
        ) => Promise<{ error: { message: string; code?: string } | null }>;
      })
      .upsert(ppPayload, { onConflict: "id" });
    if (ppRes.error) {
      console.error("[ph-signup] pharmacist_profiles upsert failed:", ppRes.error);
    } else {
      console.log("[ph-signup] pharmacist_profiles saved with license_name:", licenseNameTrimmed);
    }

    // profiles.name = license_name (환자에게 보여지는 약사 이름)
    const nameRes = await (supabase
      .from("profiles") as unknown as {
        update: (p: { name: string }) => {
          eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
        };
      })
      .update({ name: licenseNameTrimmed })
      .eq("id", user.id);
    if (nameRes.error) {
      console.error("[ph-signup] profiles.name update failed:", nameRes.error);
    }

    setSubmitting(false);
    setDone(true);
  };

  /* ═══ Enter key ═══ */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA") return;
      if (done) return;
      if (step === 1 && !otpSent && phoneValid) { e.preventDefault(); sendOTP(); }
      else if (step === 1 && otpSent && otpReady) { e.preventDefault(); verifyOTP(); }
      else if (step === 2 && step2Valid) { e.preventDefault(); setStep(3); }
      else if (step === 3 && step3Valid) { e.preventDefault(); setStep(4); }
      else if (step === 4 && step4Valid) { e.preventDefault(); setStep(5); }
      else if (step === 5 && step5Valid) { e.preventDefault(); handleComplete(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  /* ═══ Progress dots ═══ */
  const dots = Array.from({ length: TOTAL_STEPS }, (_, i) => {
    const idx = i + 1;
    if (idx < step) return "done";
    if (idx === step) return "active";
    return "";
  });

  if (done) {
    return (
      <div className="signup-page">
        <div className="signup-container">
          <div className="signup-card">
            <div className="step animate-fade-up">
              <div style={{ textAlign: "center", paddingTop: 20 }}>
                <div className="success-check">
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                </div>

                <h1 className="step-title" style={{ textAlign: "center" }}>
                  {(licenseNameTrimmed || name || "약사")}님, 환영합니다!
                </h1>
                <div className="success-text">
                  약사톡과 함께 환자의 건강을 개선해주세요.
                </div>

                {/* 안내 카드 */}
                <div style={{
                  display: "flex", flexDirection: "column", gap: 10,
                  margin: "28px 0 32px", textAlign: "left",
                }}>
                  <div style={{
                    padding: "14px 16px", borderRadius: 12,
                    background: C.sagePale, fontSize: 14, color: C.textMid, lineHeight: 1.6,
                  }}>
                    📋 내 정보에서 상담 시간과 추가 질문을 설정해보세요
                  </div>
                  <div style={{
                    padding: "14px 16px", borderRadius: 12,
                    background: C.sagePale, fontSize: 14, color: C.textMid, lineHeight: 1.6,
                  }}>
                    📝 개선 사례를 올리면 환자가 먼저 찾아와요
                  </div>
                </div>

                <button className="btn-next" onClick={() => router.push("/dashboard")}>
                  대시보드로 이동 <span className="arrow">→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="page-footer">
          약사톡은 의료 행위를 하지 않으며, 영양 상담 연결 서비스를 제공합니다.
        </div>
      </div>
    );
  }

  return (
    <div className="signup-page">
      <nav>
        <button className="nav-back" onClick={goBack} aria-label="뒤로가기">←</button>
        <div className="nav-title">약사 가입</div>
      </nav>

      <div className="signup-container">
        <div className="signup-card">

          {/* ═══════════ Step 1: 본인 인증 ═══════════ */}
          {step === 1 && (
            <div className="step animate-fade-up">
              <div className="step-progress">
                {dots.map((cls, i) => <div key={i} className={`progress-dot ${cls}`} />)}
              </div>

              <h1 className="step-title">
                휴대폰 번호를<br />알려주세요
              </h1>
              <p className="step-desc">본인 확인을 위해 인증번호를 보내드릴게요.</p>

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
                    disabled={!phoneValid}
                    onClick={sendOTP}
                  >
                    {otpSent ? "재전송" : "인증번호 받기"}
                  </button>
                </div>
              </div>

              {otpSent && (
                <>
                  {/* TEMP-MOCK-OTP — 노란 안내 박스 (NICE/KCB 연동 시 제거) */}
                  <div
                    role="alert"
                    style={{
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: "#FFF8E1",
                      border: "1px solid #F5DCA0",
                      color: "#7A5300",
                      fontSize: 14,
                      lineHeight: 1.5,
                      marginBottom: 16,
                    }}
                  >
                    <strong style={{ fontWeight: 700 }}>[테스트 환경]</strong>{" "}
                    인증번호 <strong style={{ fontWeight: 700, fontSize: 15 }}>{MOCK_OTP}</strong> 을 입력하세요. 실제 SMS는 발송되지 않습니다.
                  </div>

                  <div className="input-group">
                    <label className="input-label">인증번호 4자리</label>
                    <div className="otp-row">
                      {otp.map((digit, i) => (
                        <input
                          key={i}
                          ref={(el) => { otpRefs.current[i] = el; }}
                          type="tel"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          className={`otp-input${digit ? " filled" : ""}`}
                        />
                      ))}
                    </div>
                    <div className="otp-timer">{timer > 0 ? timerDisplay : "시간 초과"}</div>
                    {otpError && (
                      <div style={{ fontSize: 14, color: C.errorRed, marginTop: 6, lineHeight: 1.5 }}>
                        {otpError}
                      </div>
                    )}
                    {!otpError && otpExpired && (
                      <div style={{ fontSize: 14, color: C.errorRed, marginTop: 6, lineHeight: 1.5 }}>
                        인증번호가 만료되었습니다. 다시 받아주세요
                      </div>
                    )}
                    <div className="otp-resend">
                      인증번호가 안 왔나요? <button onClick={sendOTP}>다시 받기</button>
                    </div>
                  </div>
                </>
              )}

              <button
                className="btn-next"
                disabled={!otpReady}
                onClick={() => { if (otpReady) verifyOTP(); }}
              >
                인증 확인 <span className="arrow">→</span>
              </button>

              <div className="terms">
                계속 진행하시면 <a href="#">이용약관</a>과 <a href="#">개인정보처리방침</a>에 동의하시는 것으로 간주합니다.
              </div>
            </div>
          )}

          {/* ═══════════ Step 2: 기본 정보 ═══════════ */}
          {step === 2 && (
            <div className="step animate-slide-left">
              <div className="step-progress">
                {dots.map((cls, i) => <div key={i} className={`progress-dot ${cls}`} />)}
              </div>

              <h1 className="step-title">
                기본 정보를<br />알려주세요
              </h1>
              <p className="step-desc">약사 인증에 필요한 정보예요.</p>

              <div className="input-group">
                <label className="input-label">이름</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="홍길동"
                  maxLength={10}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {showNameError && (
                  <div style={{ fontSize: 14, color: C.errorRed, marginTop: 6, lineHeight: 1.5 }}>
                    한글 2~10자로 입력해주세요
                  </div>
                )}
              </div>

              <div className="input-group">
                <label className="input-label">생년월일</label>
                <input
                  type="date"
                  className="input-field"
                  min="1940-01-01"
                  max="2010-12-31"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  style={{ colorScheme: "light" }}
                />
                {showBirthDateError && (
                  <div style={{ fontSize: 14, color: C.errorRed, marginTop: 6, lineHeight: 1.5 }}>
                    올바른 생년월일을 입력해주세요 (1940~2010년)
                  </div>
                )}
              </div>

              <button
                className="btn-next"
                disabled={!step2Valid}
                onClick={() => { if (step2Valid) setStep(3); }}
              >
                다음 <span className="arrow">→</span>
              </button>
            </div>
          )}

          {/* ═══════════ Step 3: 면허 인증 ═══════════ */}
          {step === 3 && (
            <div className="step animate-slide-left">
              <div className="step-progress">
                {dots.map((cls, i) => <div key={i} className={`progress-dot ${cls}`} />)}
              </div>

              <h1 className="step-title">
                약사 면허를<br />인증해주세요
              </h1>
              <p className="step-desc">약사 면허를 확인하여 인증합니다.</p>

              <div className="input-group">
                <label className="input-label">면허증에 등록된 이름</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="예: 홍길동"
                  maxLength={10}
                  value={licenseName}
                  onChange={(e) => setLicenseName(e.target.value)}
                />
                {showLicenseNameError ? (
                  <div style={{ fontSize: 14, color: C.errorRed, marginTop: 6, lineHeight: 1.5 }}>
                    한글 2~10자로 입력해주세요
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: C.textMid, marginTop: 6, lineHeight: 1.5 }}>
                    면허증 사본에 적힌 이름과 똑같이 입력해주세요. 환자에게 보여지는 약사 이름이 됩니다.
                  </div>
                )}
              </div>

              <div className="input-group">
                <label className="input-label">약사 면허번호</label>
                <input
                  type="text"
                  className="input-field"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="예: 12345"
                  maxLength={6}
                  value={license}
                  onChange={(e) =>
                    setLicense(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
                  }
                />
                {showLicenseError ? (
                  <div style={{ fontSize: 14, color: C.errorRed, marginTop: 6, lineHeight: 1.5 }}>
                    면허번호는 숫자 4~6자리로 입력해주세요
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: C.textMid, marginTop: 6, lineHeight: 1.5 }}>
                    약사 면허증에 적힌 면허번호를 입력해주세요
                  </div>
                )}
              </div>

              <div style={{
                padding: "12px 16px", borderRadius: 10,
                background: C.sagePale, fontSize: 14,
                color: C.textMid, lineHeight: 1.6, marginBottom: 20,
              }}>
                면허 인증은 가입 후 관리자 확인 절차를 거칩니다. 허위 정보 입력 시 서비스 이용이 제한될 수 있어요.
              </div>

              <button
                className="btn-next"
                disabled={!step3Valid}
                onClick={() => { if (step3Valid) setStep(4); }}
              >
                다음 <span className="arrow">→</span>
              </button>
            </div>
          )}

          {/* ═══════════ Step 4: 약국 정보 ═══════════ */}
          {step === 4 && (
            <div className="step animate-slide-left">
              <div className="step-progress">
                {dots.map((cls, i) => <div key={i} className={`progress-dot ${cls}`} />)}
              </div>

              <h1 className="step-title">
                약국 정보를<br />입력해주세요
              </h1>
              <p className="step-desc">환자가 약국을 찾을 때 사용되는 정보예요.</p>

              <div className="input-group">
                <label className="input-label">약국 이름</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="예: 그린약국"
                  value={pharmacyName}
                  onChange={(e) => setPharmacyName(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="input-label">약국 주소</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="예: 서울특별시 강남구 테헤란로 123"
                  value={pharmacyAddr}
                  onChange={(e) => setPharmacyAddr(e.target.value)}
                />
                <div style={{ fontSize: 13, color: C.sageMid, marginTop: 6 }}>
                  추후 카카오맵 주소 검색으로 연동됩니다
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">사업자등록번호</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="000-00-00000"
                  maxLength={12}
                  value={bizNumber}
                  onChange={(e) => setBizNumber(formatBiz(e.target.value))}
                />
              </div>

              <button className="btn-next" disabled={!step4Valid} onClick={() => setStep(5)}>
                다음 <span className="arrow">→</span>
              </button>
            </div>
          )}

          {/* ═══════════ Step 5: 전문 분야 ═══════════ */}
          {step === 5 && (
            <div className="step animate-slide-left">
              <div className="step-progress">
                {dots.map((cls, i) => <div key={i} className={`progress-dot ${cls}`} />)}
              </div>

              <h1 className="step-title">
                전문 분야를<br />선택해주세요
              </h1>
              <p className="step-desc">특히 자신 있는 분야를 선택해주세요. (최대 3개)</p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                {SPECIALTIES.map((s) => {
                  const sel = specialties.has(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSpec(s)}
                      style={{
                        padding: "10px 16px",
                        borderRadius: 100,
                        fontSize: 14,
                        fontWeight: sel ? 700 : 500,
                        background: sel ? C.sageDeep : C.white,
                        color: sel ? C.white : C.textMid,
                        border: `1.5px solid ${sel ? C.sageDeep : C.border}`,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>

              {specialties.size >= 3 && (
                <div style={{ fontSize: 14, color: C.terra, marginBottom: 12 }}>
                  전문 분야는 최대 3개까지 선택할 수 있어요
                </div>
              )}

              <div style={{
                padding: "12px 16px", borderRadius: 10,
                background: C.sagePale, fontSize: 14,
                color: C.textMid, lineHeight: 1.6, marginBottom: 24,
              }}>
                상담 가능 분야는 가입 후 내 정보에서 추가할 수 있어요
              </div>

              <button
                className="btn-next"
                disabled={!step5Valid || submitting}
                onClick={handleComplete}
              >
                {submitting ? "저장 중..." : "가입 완료"} <span className="arrow">→</span>
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

export default function PharmacistSignupClient() {
  return (
    <Suspense>
      <PharmacistSignupContent />
    </Suspense>
  );
}
