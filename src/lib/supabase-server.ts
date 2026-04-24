import "server-only";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * 서버용 Supabase 클라이언트 (App Router)
 * Server Components / Route Handlers / Server Actions 에서 사용
 *
 * Next.js 15의 `cookies()`는 비동기이므로 await 해서 호출합니다.
 * Server Components에서 cookieStore.set()은 호출되지 않지만, Route Handler나
 * Server Action에서 호출될 수 있도록 try/catch로 감쌉니다.
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components에서는 쿠키를 설정할 수 없습니다 — 무시하고 통과.
          }
        },
      },
    },
  );
}
