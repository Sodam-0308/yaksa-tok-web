"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

type BrowserClient = ReturnType<typeof createBrowserClient<Database>>;

let _client: BrowserClient | null = null;

/**
 * 브라우저용 Supabase 클라이언트 (싱글톤)
 * 클라이언트 컴포넌트에서만 import 해서 사용
 */
export function getSupabaseBrowser(): BrowserClient {
  if (_client) return _client;
  _client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return _client;
}

/**
 * 편의 export: 최상위에서 한 번 생성된 싱글톤을 그대로 사용
 */
export const supabase = getSupabaseBrowser();
