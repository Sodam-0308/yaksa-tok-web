"use client";

import React from "react";

/* ══════════════════════════════════════════
   개별 SVG 아이콘 — 랜딩 페이지와 공용
   ══════════════════════════════════════════ */

interface IconProps {
  size?: number;
  color?: string;
}

export function IconBattery({ size = 22, color = "#3B6D11" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="6" width="14" height="12" rx="2" stroke={color} strokeWidth="1.5" />
      <rect x="18" y="9" width="2" height="6" rx="0.5" fill={color} />
      <rect x="6" y="8" width="4" height="8" rx="1" fill={color} opacity="0.6" />
    </svg>
  );
}

export function IconBowl({ size = 22, color = "#854F0B" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M5 13 Q7 10 14 10 Q21 10 23 13" stroke={color} strokeWidth="1.6" fill={color} opacity="0.35" />
      <path d="M5 13 Q5 22 14 22 Q23 22 23 13" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <line x1="5" y1="13" x2="23" y2="13" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

export function IconMoon({ size = 22, color = "#185FA5" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      <circle cx="18" cy="6" r="1" fill={color} stroke="none" />
    </svg>
  );
}

export function IconFemale({ size = 22, color = "#993C1D" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="9" r="5" />
      <line x1="12" y1="14" x2="12" y2="22" />
      <line x1="9" y1="19" x2="15" y2="19" />
    </svg>
  );
}

export function IconSkin({ size = 22, color = "#993C1D" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M6 10 Q6 4 14 4 Q22 4 22 10 L22 18 Q22 24 14 24 Q6 24 6 18Z" stroke={color} strokeWidth="1.5" />
      <circle cx="9" cy="12" r="1.4" fill={color} opacity="0.55" />
      <circle cx="19" cy="10" r="1.2" fill={color} opacity="0.5" />
      <circle cx="14" cy="16" r="1.5" fill={color} opacity="0.5" />
      <circle cx="8" cy="18" r="1" fill={color} opacity="0.4" />
      <circle cx="18" cy="17" r="1.1" fill={color} opacity="0.45" />
      <circle cx="12" cy="9" r="0.8" fill={color} opacity="0.35" />
    </svg>
  );
}

export function IconAllergy({ size = 22, color = "#0F6E56" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 10 Q8 8 12 10 Q16 12 20 10" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4 14 Q8 12 12 14 Q16 16 20 14" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7" cy="6" r="1.2" fill={color} opacity="0.4" />
      <circle cx="14" cy="5" r="0.9" fill={color} opacity="0.4" />
      <circle cx="18" cy="7" r="1" fill={color} opacity="0.4" />
      <circle cx="10" cy="18" r="0.8" fill={color} opacity="0.4" />
    </svg>
  );
}

export function IconKnot({ size = 22, color = "#854F0B" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <path d="M5 12 Q8 6 11 12 Q14 18 17 12" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="11" cy="12" r="2.5" stroke={color} strokeWidth="1.4" fill="none" />
    </svg>
  );
}

export function IconSadFace({ size = 22, color = "#534AB7" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="10" r="6" stroke={color} strokeWidth="1.5" />
      <path d="M8 13 Q11 10 14 13" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="9" cy="9" r="0.8" fill={color} />
      <circle cx="13" cy="9" r="0.8" fill={color} />
      <path d="M6 4 L8 6" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <path d="M16 4 L14 6" stroke={color} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

export function IconHair({ size = 22, color = "#993C1D" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M8 4 L7 20" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 4 L12 20" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M16 4 L17 20" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconScale({ size = 22, color = "#3B6D11" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <path d="M5 16 Q5 8 11 8 Q17 8 17 16" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="5" y1="16" x2="17" y2="16" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11 12 L11 16" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="11" cy="11" r="0.7" fill={color} />
    </svg>
  );
}

export function IconAntiAging({ size = 22, color = "#993C1D" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <path d="M4 11 A9 9 0 1 1 7 21" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 9 L4 11 L2 8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="13" y1="13" x2="13" y2="8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="13" y1="13" x2="17" y2="13" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="13" cy="13" r="1" fill={color} />
    </svg>
  );
}

export function IconImmune({ size = 22, color = "#0F6E56" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <path d="M13 3 L5 7 L5 14 Q5 20 13 23 Q21 20 21 14 L21 7 Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11 9 L14 12 L11 15 L14 18" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/* ══════════════════════════════════════════
   증상 메타 매핑 — 필터 키 기준
   ══════════════════════════════════════════ */

export type SymptomKey =
  | "fatigue" | "digestion" | "sleep" | "women" | "skin"
  | "rhinitis" | "gut" | "mood" | "hair" | "weight"
  | "antiaging" | "immune"
  | "headache" | "coldlimbs" | "dryeye" | "joint"
  | "liver" | "menopause" | "men";

export interface SymptomMeta {
  key: SymptomKey;
  label: string;
  bg: string;      // 연한 배경
  accent: string;  // 진한 액센트
  Icon?: React.FC<IconProps>;
}

export const SYMPTOM_META: Record<SymptomKey, SymptomMeta> = {
  fatigue:   { key: "fatigue",   label: "만성피로",         bg: "#EAF3DE", accent: "#3B6D11", Icon: IconBattery },
  digestion: { key: "digestion", label: "소화장애",         bg: "#FAEEDA", accent: "#854F0B", Icon: IconBowl },
  sleep:     { key: "sleep",     label: "불면/수면",        bg: "#E6F1FB", accent: "#185FA5", Icon: IconMoon },
  women:     { key: "women",     label: "여성건강/생리통",  bg: "#FAECE7", accent: "#993C1D", Icon: IconFemale },
  skin:      { key: "skin",      label: "피부",             bg: "#FAECE7", accent: "#993C1D", Icon: IconSkin },
  rhinitis:  { key: "rhinitis",  label: "비염/알레르기",    bg: "#E1F5EE", accent: "#0F6E56", Icon: IconAllergy },
  gut:       { key: "gut",       label: "변비/장건강",      bg: "#FAEEDA", accent: "#854F0B", Icon: IconKnot },
  mood:      { key: "mood",      label: "우울/불안/스트레스", bg: "#EEEDFE", accent: "#534AB7", Icon: IconSadFace },
  hair:      { key: "hair",      label: "탈모",             bg: "#FAECE7", accent: "#993C1D", Icon: IconHair },
  weight:    { key: "weight",    label: "체중 관리/붓기",   bg: "#EAF3DE", accent: "#3B6D11", Icon: IconScale },
  antiaging: { key: "antiaging", label: "항노화/항산화",    bg: "#FAECE7", accent: "#993C1D", Icon: IconAntiAging },
  immune:    { key: "immune",    label: "면역력저하",       bg: "#E1F5EE", accent: "#0F6E56", Icon: IconImmune },
  // 확장 (전용 아이콘 없음 — 색상만으로 구분)
  headache:  { key: "headache",  label: "두통/목어깨결림",  bg: "#EEEDFE", accent: "#534AB7" },
  coldlimbs: { key: "coldlimbs", label: "수족냉증",         bg: "#E6F1FB", accent: "#185FA5" },
  dryeye:    { key: "dryeye",    label: "안구건조",         bg: "#E6F1FB", accent: "#185FA5" },
  joint:     { key: "joint",     label: "관절/뼈",          bg: "#E1F5EE", accent: "#0F6E56" },
  liver:     { key: "liver",     label: "간 건강",          bg: "#FAEEDA", accent: "#854F0B" },
  menopause: { key: "menopause", label: "갱년기",           bg: "#FAECE7", accent: "#993C1D", Icon: IconFemale },
  men:       { key: "men",       label: "남성건강",         bg: "#E1F5EE", accent: "#0F6E56" },
};

/* ══════════════════════════════════════════
   증상 태그(한글 라벨) → 필터 키 매핑
   ══════════════════════════════════════════ */

export const TAG_LABEL_TO_KEY: Record<string, SymptomKey> = {
  만성피로: "fatigue",
  에너지부족: "fatigue",
  소화장애: "digestion",
  장건강: "gut",
  변비: "gut",
  불면: "sleep",
  수면장애: "sleep",
  비염: "rhinitis",
  알레르기: "rhinitis",
  두통: "headache",
  목어깨결림: "headache",
  생리통: "women",
  여성건강: "women",
  갱년기: "menopause",
  남성건강: "men",
  여드름: "skin",
  피부트러블: "skin",
  아토피: "skin",
  피부: "skin",
  탈모: "hair",
  "우울·불안": "mood",
  스트레스: "mood",
  안구건조: "dryeye",
  수족냉증: "coldlimbs",
  붓기: "weight",
  체중: "weight",
  관절통: "joint",
  관절: "joint",
  간건강: "liver",
  면역력: "immune",
  면역력저하: "immune",
  항노화: "antiaging",
  항산화: "antiaging",
};

export function getSymptomKey(tagLabel: string): SymptomKey | undefined {
  return TAG_LABEL_TO_KEY[tagLabel];
}

/* ══════════════════════════════════════════
   공용 래퍼 — 컬러 원 + 아이콘
   ══════════════════════════════════════════ */

interface SymptomIconProps {
  keyId: SymptomKey;
  size?: number;        // 원형 크기 (기본 40)
  iconColor?: string;   // 아이콘 색상 override
  bgOverride?: string;  // 원형 배경 override
}

export function SymptomIcon({ keyId, size = 40, iconColor, bgOverride }: SymptomIconProps) {
  const meta = SYMPTOM_META[keyId];
  if (!meta) return null;
  const iconSize = Math.max(12, Math.round(size * 0.55));
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bgOverride ?? meta.bg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {meta.Icon && <meta.Icon size={iconSize} color={iconColor ?? meta.accent} />}
    </div>
  );
}
