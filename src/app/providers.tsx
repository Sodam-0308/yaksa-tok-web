"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";

/**
 * 앱 전역 Provider 래퍼 (클라이언트 전용)
 * layout.tsx에서 children을 이 컴포넌트로 감싸 인증 상태를 앱 전체에 제공합니다.
 */
export default function ClientProviders({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
