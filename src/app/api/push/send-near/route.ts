import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  calcRemainingDays,
  daysFromTodayLocal,
  MED_NEAR_THRESHOLD,
  VISIT_NEAR_THRESHOLD,
} from "@/lib/nearThresholds";

/** I-4 (B-2) 임박 알림 발송 Route Handler.
 *  - 복용 임박: patient_supplements (calcRemainingDays ∈ [0, MED_NEAR_THRESHOLD])
 *  - 방문 임박: visit_schedules (status=scheduled, daysFromTodayLocal ∈ [0, VISIT_NEAR_THRESHOLD])
 *  - 환자별로 ui_preferences(noti_med 기본 true / noti_visit 기본 false) 분기
 *  - push_subscriptions 의 모든 기기로 sendNotification, 410/404 응답은 row 삭제
 *  - 날짜 계산은 모두 src/lib/nearThresholds.ts 헬퍼로 위임 (서버/클라 동일 기준)
 */
export const runtime = "nodejs";

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    throw new Error("[push/send-near] VAPID env missing (VAPID_SUBJECT / NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

type NotifPayload = { title: string; body: string; url: string };
type MedTarget = { patient_id: string; name: string; remain: number };
type VisitTarget = { patient_id: string; daysLeft: number };
type SuppRow = { patient_id: string; name: string; start_date: string | null; days: number | null };
type VsRow = { patient_id: string; scheduled_date: string };
type SubRow = { endpoint: string; p256dh: string; auth: string };
type UiPref = { noti_med?: boolean; noti_visit?: boolean } | null;
type RunResult = {
  processed: number;
  sent: number;
  removed: number;
  errors: Array<{ patient_id: string; endpoint?: string; message: string }>;
};

async function runSendNear(): Promise<RunResult> {
  ensureVapid();
  const admin = createAdminClient();

  // 1) 복용 임박 후보 — start_date/days 로 calcRemainingDays
  const suppResp = await admin
    .from("patient_supplements")
    .select("patient_id, name, start_date, days");
  if (suppResp.error) {
    throw new Error("patient_supplements load failed: " + suppResp.error.message);
  }
  const medTargets: MedTarget[] = [];
  for (const s of (suppResp.data ?? []) as unknown as SuppRow[]) {
    const remain = calcRemainingDays(s.start_date, s.days);
    if (remain != null && remain >= 0 && remain <= MED_NEAR_THRESHOLD) {
      medTargets.push({ patient_id: s.patient_id, name: s.name, remain });
    }
  }

  // 2) 방문 임박 후보 — status="scheduled" + scheduled_date 로 daysFromTodayLocal
  const vsResp = await admin
    .from("visit_schedules")
    .select("patient_id, scheduled_date")
    .eq("status", "scheduled");
  if (vsResp.error) {
    throw new Error("visit_schedules load failed: " + vsResp.error.message);
  }
  const visitTargets: VisitTarget[] = [];
  for (const v of (vsResp.data ?? []) as unknown as VsRow[]) {
    const d = daysFromTodayLocal(v.scheduled_date);
    if (d != null && d >= 0 && d <= VISIT_NEAR_THRESHOLD) {
      visitTargets.push({ patient_id: v.patient_id, daysLeft: d });
    }
  }

  // 3) 환자별 묶기
  const byPatient = new Map<string, { meds: MedTarget[]; visits: VisitTarget[] }>();
  for (const m of medTargets) {
    const cur = byPatient.get(m.patient_id) ?? { meds: [], visits: [] };
    cur.meds.push(m);
    byPatient.set(m.patient_id, cur);
  }
  for (const v of visitTargets) {
    const cur = byPatient.get(v.patient_id) ?? { meds: [], visits: [] };
    cur.visits.push(v);
    byPatient.set(v.patient_id, cur);
  }

  const result: RunResult = { processed: 0, sent: 0, removed: 0, errors: [] };

  for (const [patient_id, { meds, visits }] of byPatient) {
    result.processed++;

    // 4) ui_preferences 분기 — med 기본 true / visit 기본 false (마이페이지 폴백과 동일)
    const profResp = await admin
      .from("profiles")
      .select("ui_preferences")
      .eq("id", patient_id)
      .maybeSingle();
    if (profResp.error) {
      result.errors.push({ patient_id, message: "profiles load: " + profResp.error.message });
      continue;
    }
    const pref = ((profResp.data as { ui_preferences: UiPref } | null)?.ui_preferences ?? null) as UiPref;
    const allowMed = pref?.noti_med !== false;   // undefined/true → 허용, false 만 차단
    const allowVisit = pref?.noti_visit === true; // 명시적 true 만 허용

    // 5) 발송 payload 구성
    const payloads: NotifPayload[] = [];
    if (allowMed) {
      for (const m of meds) {
        const body = m.remain === 0
          ? `${m.name} 복용이 오늘까지예요`
          : `${m.name} 복용이 ${m.remain}일 남았어요`;
        payloads.push({ title: "복용 종료가 가까워졌어요", body, url: "/mypage" });
      }
    }
    if (allowVisit) {
      for (const v of visits) {
        const body = v.daysLeft === 0
          ? "오늘 방문 예정이에요"
          : `${v.daysLeft}일 후 방문 예정이에요`;
        payloads.push({ title: "약국 방문 예정이 가까워졌어요", body, url: "/mypage" });
      }
    }
    if (payloads.length === 0) continue;

    // 6) 구독 조회 — 한 사용자 다중 기기 가능
    const subResp = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", patient_id);
    if (subResp.error) {
      result.errors.push({ patient_id, message: "push_subscriptions load: " + subResp.error.message });
      continue;
    }
    const subs = (subResp.data ?? []) as unknown as SubRow[];
    if (subs.length === 0) continue;

    // 7) 각 구독 × 각 payload 발송. 410/404 → 만료 → 그 구독 삭제 후 다음 구독으로.
    for (const s of subs) {
      const pushSub = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };
      let endpointDead = false;
      for (const p of payloads) {
        if (endpointDead) break;
        try {
          await webpush.sendNotification(pushSub, JSON.stringify(p));
          result.sent++;
        } catch (e: unknown) {
          const status = (e as { statusCode?: number }).statusCode;
          const msg = (e as { message?: string }).message ?? String(e);
          if (status === 410 || status === 404) {
            const delResp = await admin
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", s.endpoint);
            if (!delResp.error) result.removed++;
            result.errors.push({ patient_id, endpoint: s.endpoint, message: `expired (status ${status}) — removed` });
            endpointDead = true;
          } else {
            result.errors.push({ patient_id, endpoint: s.endpoint, message: `send failed (status ${status ?? "?"}): ${msg}` });
          }
        }
      }
    }
  }

  return result;
}

export async function POST() {
  try {
    const result = await runSendNear();
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[push/send-near] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** ⚠️ 임시 테스트용 — 배포 전 GET 제거 또는 토큰/관리자 보호 필요.
 *  브라우저 주소창에서 GET 한 번에 트리거 가능. */
export async function GET() {
  return POST();
}
