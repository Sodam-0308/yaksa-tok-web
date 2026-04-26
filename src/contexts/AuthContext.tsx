"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  signInWithKakao as doSignInWithKakao,
  signOut as doSignOut,
} from "@/lib/auth";

interface ProfileSummary {
  id: string;
  role: "patient" | "pharmacist";
  name: string;
  role_confirmed: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: ProfileSummary | null;
  loading: boolean;          // 세션 로딩
  profileLoading: boolean;   // 프로필 fetch 로딩
  roleConfirmed: boolean;    // profile?.role_confirmed
  refreshProfile: () => Promise<void>;
  signInWithKakao: typeof doSignInWithKakao;
  signOut: typeof doSignOut;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, role, name, role_confirmed")
      .eq("id", userId)
      .maybeSingle<ProfileSummary>();
    setProfile(data ?? null);
    setProfileLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    const uid = session?.user.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    await fetchProfile(uid);
  }, [session, fetchProfile]);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
      if (data.session?.user.id) {
        fetchProfile(data.session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
      if (newSession?.user.id) {
        fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    profile,
    loading,
    profileLoading,
    roleConfirmed: profile?.role_confirmed === true,
    refreshProfile,
    signInWithKakao: doSignInWithKakao,
    signOut: doSignOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth는 <AuthProvider> 내부에서만 사용할 수 있어요.");
  }
  return ctx;
}
