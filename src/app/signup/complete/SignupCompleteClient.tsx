"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
type PatientProfileInsert = Database["public"]["Tables"]["patient_profiles"]["Insert"];

const COLOR = {
  sageBg: "#F8F9F7",
  sagePale: "#EDF4F0",
  sageLight: "#B3CCBE",
  sageMid: "#5E7D6C",
  sageDeep: "#4A6355",
  terra: "#C06B45",
  textDark: "#2C3630",
  textMid: "#3D4A42",
  border: "rgba(94,125,108,0.14)",
  white: "#fff",
};

type Role = "patient" | "pharmacist";

export default function SignupCompleteClient() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [name, setName] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 로그인되지 않은 사용자는 /signup으로 이동
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/signup");
    }
  }, [loading, user, router]);

  const canSubmit = name.trim().length > 0 && role !== null && !submitting;

  const submit = async () => {
    if (!canSubmit || !user || !role) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const profilePayload: ProfileInsert = {
        id: user.id,
        role,
        name: name.trim(),
        phone: user.phone ?? null,
        avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
        auth_provider:
          (user.app_metadata?.provider as string | undefined) ?? "kakao",
      };
      const { error: profileError } = await (supabase
        .from("profiles") as unknown as {
          insert: (p: ProfileInsert) => Promise<{ error: Error | null }>;
        })
        .insert(profilePayload);

      if (profileError) {
        throw profileError;
      }

      if (role === "patient") {
        const patientPayload: PatientProfileInsert = {
          id: user.id,
          birth_year: null,
          gender: null,
          height_cm: null,
          weight_kg: null,
          body_recorded_at: null,
          monthly_budget: null,
          case_study_consent_at: null,
        };
        const { error: patientError } = await (supabase
          .from("patient_profiles") as unknown as {
            insert: (p: PatientProfileInsert) => Promise<{ error: Error | null }>;
          })
          .insert(patientPayload);
        if (patientError) throw patientError;
        router.replace("/");
      } else {
        router.replace("/signup/pharmacist");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "가입을 완료하지 못했어요.";
      setErrorMsg(message);
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: COLOR.sageBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: COLOR.textMid,
          fontSize: 15,
        }}
      >
        불러오는 중...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: COLOR.sageBg }}>
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          padding: "48px 20px 120px",
        }}
      >
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: COLOR.textDark,
            fontFamily: "'Gothic A1', sans-serif",
            margin: "0 0 8px",
            lineHeight: 1.35,
          }}
        >
          약사톡에 오신 걸 환영해요!
        </h1>
        <p
          style={{
            fontSize: 15,
            color: COLOR.textMid,
            lineHeight: 1.6,
            margin: "0 0 32px",
          }}
        >
          이름과 역할을 알려주시면 바로 시작할 수 있어요.
        </p>

        {/* 이름 */}
        <div style={{ marginBottom: 24 }}>
          <label
            htmlFor="signup-complete-name"
            style={{
              display: "block",
              fontSize: 14,
              fontWeight: 600,
              color: COLOR.textDark,
              marginBottom: 8,
            }}
          >
            이름 <span style={{ color: COLOR.terra }}>*</span>
          </label>
          <input
            id="signup-complete-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 김약사"
            maxLength={30}
            style={{
              width: "100%",
              padding: "14px 16px",
              minHeight: 52,
              borderRadius: 12,
              border: `1.5px solid ${COLOR.border}`,
              background: COLOR.white,
              fontSize: 15,
              color: COLOR.textDark,
              outline: "none",
              fontFamily: "'Noto Sans KR', sans-serif",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* 역할 */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: COLOR.textDark,
              marginBottom: 8,
            }}
          >
            어떤 역할로 시작하시나요? <span style={{ color: COLOR.terra }}>*</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              type="button"
              onClick={() => setRole("patient")}
              style={{
                width: "100%",
                padding: "16px",
                minHeight: 56,
                borderRadius: 12,
                background: role === "patient" ? COLOR.sageDeep : COLOR.sageDeep,
                color: COLOR.white,
                fontSize: 16,
                fontWeight: 700,
                border:
                  role === "patient"
                    ? `2px solid ${COLOR.terra}`
                    : `2px solid transparent`,
                cursor: "pointer",
                fontFamily: "'Noto Sans KR', sans-serif",
                textAlign: "center",
                boxShadow:
                  role === "patient"
                    ? "0 4px 14px rgba(192,107,69,0.2)"
                    : "none",
              }}
            >
              환자로 시작하기
            </button>
            <button
              type="button"
              onClick={() => setRole("pharmacist")}
              style={{
                width: "100%",
                padding: "16px",
                minHeight: 56,
                borderRadius: 12,
                background: COLOR.white,
                color: COLOR.sageDeep,
                fontSize: 16,
                fontWeight: 700,
                border:
                  role === "pharmacist"
                    ? `2px solid ${COLOR.sageDeep}`
                    : `1.5px solid ${COLOR.sageLight}`,
                cursor: "pointer",
                fontFamily: "'Noto Sans KR', sans-serif",
                textAlign: "center",
              }}
            >
              약사로 시작하기
            </button>
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            style={{
              background: "#FAECE7",
              color: "#993C1D",
              fontSize: 14,
              padding: "10px 14px",
              borderRadius: 10,
              marginBottom: 16,
              lineHeight: 1.5,
            }}
          >
            {errorMsg}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          style={{
            width: "100%",
            height: 56,
            borderRadius: 14,
            background: canSubmit ? COLOR.sageDeep : COLOR.sageLight,
            color: COLOR.white,
            fontSize: 16,
            fontWeight: 700,
            border: "none",
            cursor: canSubmit ? "pointer" : "default",
            fontFamily: "'Gothic A1', sans-serif",
          }}
        >
          {submitting ? "처리 중..." : "시작하기"}
        </button>
      </div>
    </div>
  );
}
