import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** 서버 전용 Supabase 클라이언트 (service role, RLS bypass).
 *  Route Handler / Server Action 안에서만 사용. 절대 클라이언트로 노출 금지.
 *  env 키 미설정 시 즉시 throw — 서버 로그/응답에서 원인 명확히. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("[supabase-admin] NEXT_PUBLIC_SUPABASE_URL missing");
  if (!key) throw new Error("[supabase-admin] SUPABASE_SERVICE_ROLE_KEY missing");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
