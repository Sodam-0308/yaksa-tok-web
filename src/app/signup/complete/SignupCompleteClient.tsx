"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type PatientProfileInsert = Database["public"]["Tables"]["patient_profiles"]["Insert"];
type AiQuestionnaireUpdate = Database["public"]["Tables"]["ai_questionnaires"]["Update"];

const QUESTIONNAIRE_ID_KEY = "yaksa-tok-questionnaire-id";
const PENDING_MATCH_KEY = "yaksa-tok-pending-match";

function consumePendingMatch(): boolean {
  if (typeof window === "undefined") return false;
  const fromSession = sessionStorage.getItem(PENDING_MATCH_KEY) === "1";
  const fromCookie = document.cookie
    .split(";")
    .map((c) => c.trim())
    .some((c) => c === `${PENDING_MATCH_KEY}=1`);
  // 한 번 사용 후 양쪽 모두 정리
  sessionStorage.removeItem(PENDING_MATCH_KEY);
  document.cookie = `${PENDING_MATCH_KEY}=; path=/; max-age=0; samesite=lax`;
  return fromSession || fromCookie;
}

const COLOR = {
  sageBg: "#F8F9F7",
  sagePale: "#EDF4F0",
  sageLight: "#B3CCBE",
  sageMid: "#5E7D6C",
  sageDeep: "#4A6355",
  terra: "#C06B45",
  terraLight: "#F5E6DC",
  terraPale: "#FBF5F1",
  terraDark: "#A35A39",
  textDark: "#2C3630",
  textMid: "#3D4A42",
  border: "rgba(94,125,108,0.14)",
  white: "#fff",
};

type Role = "patient" | "pharmacist";

function PatientIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={COLOR.sageDeep} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function PharmacistIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={COLOR.terra} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="8" rx="4" />
      <line x1="12" y1="8" x2="12" y2="16" />
    </svg>
  );
}

export default function SignupCompleteClient() {
  const router = useRouter();
  const { user, loading, profile, profileLoading, refreshProfile } = useAuth();

  const [submittingRole, setSubmittingRole] = useState<Role | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 로그인되지 않은 사용자는 /signup 으로
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/signup");
    }
  }, [loading, user, router]);

  // 이미 역할 확정한 사용자는 / 로 (재선택 방지)
  useEffect(() => {
    if (!loading && !profileLoading && profile?.role_confirmed) {
      router.replace("/");
    }
  }, [loading, profileLoading, profile, router]);

  const handleSelectRole = async (role: Role) => {
    if (!user || submittingRole) return;
    setSubmittingRole(role);
    setErrorMsg(null);

    try {
      const metaName =
        (user.user_metadata?.name as string | undefined) ??
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.nickname as string | undefined) ??
        "사용자";

      if (profile) {
        // 기존 profile 있음 → UPDATE
        const update: ProfileUpdate = {
          role,
          role_confirmed: true,
        };
        const { error: updateError } = await (supabase
          .from("profiles") as unknown as {
            update: (p: ProfileUpdate) => {
              eq: (col: string, val: string) => Promise<{ error: Error | null }>;
            };
          })
          .update(update)
          .eq("id", user.id);
        if (updateError) throw updateError;
      } else {
        // profile 없음 → INSERT
        const insert: ProfileInsert = {
          id: user.id,
          role,
          name: metaName,
          phone: user.phone ?? null,
          avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
          auth_provider: (user.app_metadata?.provider as string | undefined) ?? "kakao",
          role_confirmed: true,
        };
        const { error: insertError } = await (supabase
          .from("profiles") as unknown as {
            insert: (p: ProfileInsert) => Promise<{ error: Error | null }>;
          })
          .insert(insert);
        if (insertError) throw insertError;
      }

      // 환자 선택 시 patient_profiles 행도 보장
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
        // upsert로 중복 시 무시
        const { error: patientError } = await (supabase
          .from("patient_profiles") as unknown as {
            upsert: (
              p: PatientProfileInsert,
              opts?: { onConflict?: string },
            ) => Promise<{ error: Error | null }>;
          })
          .upsert(patientPayload, { onConflict: "id" });
        if (patientError) throw patientError;
      }

      // 비로그인 상태로 작성한 AI 문답이 있으면 현재 user에 연결
      if (typeof window !== "undefined") {
        const orphanId = sessionStorage.getItem(QUESTIONNAIRE_ID_KEY);
        if (orphanId) {
          try {
            const update: AiQuestionnaireUpdate = { patient_id: user.id };
            await (supabase
              .from("ai_questionnaires") as unknown as {
                update: (p: AiQuestionnaireUpdate) => {
                  eq: (col: string, val: string) => {
                    is: (col: string, val: null) => Promise<{ error: Error | null }>;
                  };
                };
              })
              .update(update)
              .eq("id", orphanId)
              .is("patient_id", null);
            sessionStorage.removeItem(QUESTIONNAIRE_ID_KEY);
          } catch (linkErr) {
            console.error("[signup-complete] questionnaire link failed:", linkErr);
          }
        }
      }

      await refreshProfile();

      if (role === "pharmacist") {
        // 약사는 추가 가입 절차로
        router.replace("/signup/pharmacist");
      } else {
        // 환자: 문답에서 넘어온 흐름이면 /match, 아니면 /
        const pendingMatch = consumePendingMatch();
        router.replace(pendingMatch ? "/match" : "/");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "역할 선택을 완료하지 못했어요.";
      setErrorMsg(message);
      setSubmittingRole(null);
    }
  };

  if (loading || (!loading && !user) || (profile?.role_confirmed)) {
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
          padding: "48px 20px 80px",
        }}
      >
        {/* 로고 */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: COLOR.sageDeep,
            fontFamily: "'Gothic A1', sans-serif",
            marginBottom: 32,
            letterSpacing: "-0.01em",
          }}
        >
          약사톡<span style={{ color: COLOR.terra }}>.</span>
        </div>

        {/* 인사 */}
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: COLOR.textDark,
            fontFamily: "'Gothic A1', sans-serif",
            margin: "0 0 8px",
            lineHeight: 1.4,
          }}
        >
          약사톡에 오신 것을 환영합니다!
        </h1>
        <p
          style={{
            fontSize: 15,
            color: COLOR.textMid,
            lineHeight: 1.6,
            margin: "0 0 28px",
          }}
        >
          어떤 역할로 시작하시나요?
        </p>

        {/* 환자 카드 */}
        <button
          type="button"
          onClick={() => handleSelectRole("patient")}
          disabled={submittingRole !== null}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            width: "100%",
            minHeight: 96,
            padding: "20px",
            marginBottom: 14,
            borderRadius: 16,
            background: COLOR.sagePale,
            border: `1.5px solid ${COLOR.sageLight}`,
            cursor: submittingRole ? "default" : "pointer",
            opacity: submittingRole && submittingRole !== "patient" ? 0.5 : 1,
            textAlign: "left",
            fontFamily: "'Noto Sans KR', sans-serif",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: COLOR.white,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 1px 4px rgba(74,99,85,0.06)",
            }}
            aria-hidden="true"
          >
            <PatientIcon />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: COLOR.sageDeep,
                marginBottom: 4,
                fontFamily: "'Gothic A1', sans-serif",
              }}
            >
              환자로 시작하기
            </div>
            <div style={{ fontSize: 14, color: COLOR.textMid, lineHeight: 1.5 }}>
              증상 상담받고 싶어요
            </div>
          </div>
          <span
            aria-hidden="true"
            style={{ color: COLOR.sageDeep, fontSize: 22, fontWeight: 700, flexShrink: 0 }}
          >
            ›
          </span>
        </button>

        {/* 약사 카드 */}
        <button
          type="button"
          onClick={() => handleSelectRole("pharmacist")}
          disabled={submittingRole !== null}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            width: "100%",
            minHeight: 96,
            padding: "20px",
            borderRadius: 16,
            background: COLOR.terraPale,
            border: `1.5px solid ${COLOR.terraLight}`,
            cursor: submittingRole ? "default" : "pointer",
            opacity: submittingRole && submittingRole !== "pharmacist" ? 0.5 : 1,
            textAlign: "left",
            fontFamily: "'Noto Sans KR', sans-serif",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: COLOR.white,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 1px 4px rgba(192,107,69,0.08)",
            }}
            aria-hidden="true"
          >
            <PharmacistIcon />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: COLOR.terraDark,
                marginBottom: 4,
                fontFamily: "'Gothic A1', sans-serif",
              }}
            >
              약사로 시작하기
            </div>
            <div style={{ fontSize: 14, color: COLOR.textMid, lineHeight: 1.5 }}>
              상담 약사로 활동하고 싶어요
            </div>
          </div>
          <span
            aria-hidden="true"
            style={{ color: COLOR.terra, fontSize: 22, fontWeight: 700, flexShrink: 0 }}
          >
            ›
          </span>
        </button>

        {submittingRole && (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginTop: 18,
              fontSize: 14,
              color: COLOR.textMid,
              textAlign: "center",
            }}
          >
            처리 중...
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            style={{
              marginTop: 18,
              background: "#FAECE7",
              color: "#993C1D",
              fontSize: 14,
              padding: "10px 14px",
              borderRadius: 10,
              lineHeight: 1.5,
            }}
          >
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}
