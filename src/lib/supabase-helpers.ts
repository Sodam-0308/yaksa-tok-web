"use client";

import { supabase } from "./supabase";
import type {
  ProfileRow,
  PatientProfileRow,
  PharmacistProfileRow,
} from "@/types/database";

/** 현재 로그인한 사용자 (auth user). 로그인되지 않은 경우 null */
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** profiles 테이블에서 단일 프로필 가져오기 */
export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data;
}

/**
 * 약사 프로필 + profiles JOIN
 * 반환: { ...pharmacist_profiles 필드, profile: profiles 필드 } 또는 null
 */
export async function getPharmacistProfile(
  userId: string,
): Promise<(PharmacistProfileRow & { profile: ProfileRow | null }) | null> {
  const { data, error } = await supabase
    .from("pharmacist_profiles")
    .select("*, profile:profiles(*)")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return data as unknown as PharmacistProfileRow & { profile: ProfileRow | null };
}

/**
 * 환자 프로필 + profiles JOIN
 * 반환: { ...patient_profiles 필드, profile: profiles 필드 } 또는 null
 */
export async function getPatientProfile(
  userId: string,
): Promise<(PatientProfileRow & { profile: ProfileRow | null }) | null> {
  const { data, error } = await supabase
    .from("patient_profiles")
    .select("*, profile:profiles(*)")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return data as unknown as PatientProfileRow & { profile: ProfileRow | null };
}
