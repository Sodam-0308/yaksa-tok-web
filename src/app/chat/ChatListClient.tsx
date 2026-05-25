"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { SYMPTOM_META, TAG_LABEL_TO_KEY } from "@/components/SymptomIcon";

/* ══════════════════════════════════════════
   컬러
   ══════════════════════════════════════════ */

const C = {
  sageBg: "#F8F9F7",
  sagePale: "#EDF4F0",
  sageLight: "#B3CCBE",
  sageMid: "#5E7D6C",
  sageDeep: "#4A6355",
  terra: "#C06B45",
  textDark: "#2C3630",
  textMid: "#3D4A42",
  border: "rgba(94, 125, 108, 0.14)",
  borderSoft: "rgba(94, 125, 108, 0.08)",
  white: "#fff",
};

/* ══════════════════════════════════════════
   타입 & Mock 폴백 (비로그인 데모용)
   ══════════════════════════════════════════ */

interface ChatRoom {
  id: string;
  /** 자기 역할 ("patient" | "pharmacist") — /chat/[id]?role=... 라우팅에 사용 */
  myRole: "patient" | "pharmacist";
  /** 상대방 표시 이름 */
  counterpartName: string;
  /** 아바타 이니셜 (한글 1자) */
  initial: string;
  /** 증상 태그 */
  symptoms: { label: string; bg: string; color: string }[];
  /** 마지막 메시지 미리보기 (마커는 변환 후 저장) */
  lastMessage: string;
  /** 마지막 메시지 시각 (ISO) */
  lastMessageAt: string;
  /** 안 읽은 메시지 수 (상대방이 보낸 것 중) */
  unreadCount: number;
  /** ⚠️ 거절 이력 있는 환자 (재요청) — 약사 뷰 전용 */
  hasPrevRejection: boolean;
  /** consultations.status — 카드 배지 ("상담 종료"/"상담 진행 중" 등) */
  status?: string;
}

/** 회차 마커/legacy 패턴을 사용자에게 보여줄 미리보기 텍스트로 변환.
 *  마커가 아니면 content 그대로 반환. */
function formatPreview(content: string, myRole: "patient" | "pharmacist"): string {
  // 정확 일치 토큰
  if (content === "[ROUND_START]") {
    return myRole === "patient" ? "상담이 수락되었습니다" : "상담 시작";
  }
  if (content === "[ROUND_END]") return "상담 종료";
  if (content === "[CONSULT_REJECTED]") return "상담을 거절하였습니다";
  // 종료 토큰 — 본인 행위는 주어 생략, 상대 행위는 호칭 명시 (ChatClient.formatSystemMessageContent 와 동일 규칙).
  if (content === "[CONSULT_ENDED_BY_PHARMACIST]") {
    return myRole === "patient" ? "약사님이 상담을 종료했습니다" : "상담을 종료했습니다";
  }
  if (content === "[CONSULT_ENDED_BY_PATIENT]") {
    return myRole === "patient" ? "상담을 종료했습니다" : "환자님이 상담을 종료했습니다";
  }
  // 사이클 6 — 약사 측 복용 가이드 전송 토큰
  if (content === "[DOSAGE_GUIDE_SENT]") {
    return myRole === "patient" ? "복용 가이드가 도착했어요" : "복용 가이드 전송 완료";
  }
  if (content === "[VISIT_CONFIRMED]") return "방문 완료";
  // 접두 토큰 — [추가질문답변] 이 [추가질문] 접두를 포함하므로 답변 먼저 분기
  if (content.startsWith("[추가질문답변]")) return "환자가 답변했어요";
  if (content.startsWith("[추가질문]")) return "추가 질문을 보냈어요";
  if (content.startsWith("[방문안내]")) return content.replace(/^\[방문안내\]\s*/, "");
  if (content.startsWith("[시스템]")) return content.replace(/^\[시스템\]\s*/, "");
  // Legacy 형식 ("--- N차 상담 시작 ---" / "--- N차 상담 종료 ---")
  if (/^--- \d+차 상담 시작 ---$/.test(content)) {
    return myRole === "patient" ? "상담이 수락되었습니다" : "상담 시작";
  }
  if (/^--- \d+차 상담 종료 ---$/.test(content)) return "상담 종료";
  return content;
}

/** consultations.status → 카드 배지 라벨. 미해당이면 null (배지 미노출). */
function statusBadgeLabel(status: string | undefined): string | null {
  if (!status) return null;
  if (status === "completed" || status === "cancelled") return "상담 종료";
  if (status === "rejected") return "거절됨";
  if (status === "pending") return "상담 요청 중";
  if (
    status === "accepted" ||
    status === "chatting" ||
    status === "matched" ||
    status === "active" ||
    status === "in_progress" ||
    status === "visit_scheduled"
  ) {
    return "상담 진행 중";
  }
  return null;
}

/** 환자가 보는 약사 표시 이름에 " 약사" 접미사. 이미 "약사"로 끝나면 그대로. */
function withPharmacistSuffix(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (trimmed.endsWith("약사")) return trimmed;
  return `${trimmed} 약사`;
}

const MOCK_NOW_ISO = "2026-04-21T10:00:00+09:00";

const MOCK_CHATS: ChatRoom[] = [
  {
    id: "c-2",
    myRole: "pharmacist",
    counterpartName: "박○○",
    initial: "박",
    symptoms: [{ label: "소화장애", bg: "#FAEEDA", color: "#854F0B" }],
    lastMessage: "약사님, 어제 알려주신 유산균 먹고 속이 좀 편해졌는데 아직 점심 이후에는 더부룩해요.",
    lastMessageAt: "2026-04-19T14:20:00+09:00",
    unreadCount: 5,
    hasPrevRejection: false,
  },
  {
    id: "c-9",
    myRole: "pharmacist",
    counterpartName: "조○○",
    initial: "조",
    symptoms: [{ label: "탈모", bg: "#FAECE7", color: "#993C1D" }],
    lastMessage: "추천해주신 영양제 관련해서 질문이 있어요. 언제쯤 효과를 볼 수 있나요?",
    lastMessageAt: "2026-04-20T08:30:00+09:00",
    unreadCount: 1,
    hasPrevRejection: false,
  },
  {
    id: "c-1",
    myRole: "pharmacist",
    counterpartName: "김○○",
    initial: "김",
    symptoms: [
      { label: "만성피로", bg: "#EAF3DE", color: "#3B6D11" },
      { label: "수면장애", bg: "#E6F1FB", color: "#185FA5" },
    ],
    lastMessage: "네, 알겠습니다! 감사합니다 약사님 🙏",
    lastMessageAt: "2026-04-21T07:45:00+09:00",
    unreadCount: 2,
    hasPrevRejection: false,
  },
];

/* ══════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════ */

function hoursSince(iso: string, nowIso?: string): number {
  const then = new Date(iso).getTime();
  const now = nowIso ? new Date(nowIso).getTime() : Date.now();
  if (Number.isNaN(then) || Number.isNaN(now)) return 0;
  return Math.max(0, (now - then) / 3_600_000);
}

/** 카카오톡 스타일 시간 표시 */
function fmtChatTime(iso: string, nowIso?: string): string {
  const h = hoursSince(iso, nowIso);
  if (h < 1) return "방금";
  if (h < 24) return `${Math.floor(h)}시간 전`;
  if (h < 48) return "1일 전";
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

/** 경과 시간별 unread 뱃지 색상 (대시보드와 동일) */
function getUnreadBadgeStyle(hours: number): React.CSSProperties {
  if (hours < 6) return { background: "#FFD4A8", color: "#8B4513" };
  if (hours < 12) return { background: "#FF9A4D", color: "#fff" };
  if (hours < 24) return { background: "#F06820", color: "#fff" };
  return { background: "#E02020", color: "#fff", animation: "chatListUnreadPulse 1s ease-in-out infinite" };
}

/** symptom 라벨 → bg/color 매핑 (SYMPTOM_META 활용, 없으면 sage 폴백) */
function symptomTagStyle(label: string): { label: string; bg: string; color: string } {
  const key = TAG_LABEL_TO_KEY[label];
  if (key) {
    const meta = SYMPTOM_META[key];
    return { label, bg: meta.bg, color: meta.accent };
  }
  return { label, bg: "#EDF4F0", color: "#4A6355" };
}

type SortKey = "urgent" | "recent";

/* ══════════════════════════════════════════
   메인
   ══════════════════════════════════════════ */

interface DbConsultationRow {
  id: string;
  patient_id: string;
  pharmacist_id: string | null;
  status: string;
  created_at: string;
  patient: { id: string; name: string; avatar_url: string | null } | null;
  pharmacist: { id: string; name: string; avatar_url: string | null } | null;
  questionnaire: { symptoms: string[] | null } | null;
}

interface DbMessageRow {
  id: string;
  consultation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

function Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewRole = searchParams.get("role"); // "patient" | "pharmacist" | null — 화면 분기용 (권한은 RLS 가 보호)
  const { user, loading: authLoading } = useAuth();

  const [sortKey, setSortKey] = useState<SortKey>("urgent");
  const [dbRooms, setDbRooms] = useState<ChatRoom[] | null>(null);
  const [dbLoading, setDbLoading] = useState(true);
  // 약사 채팅 목록 "거절 숨기기" 토글 — profiles.ui_preferences.hide_rejected_chats 에 영속.
  // 환자 시점에서는 미사용 (기본 false 유지, 토글 UI 도 미노출).
  const [hideRejected, setHideRejected] = useState<boolean>(false);

  /* ── DB 채팅방 로드 (로그인 사용자만) ── */
  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!user) {
      setDbRooms(null);
      setDbLoading(false);
      return;
    }

    (async () => {
      setDbLoading(true);

      // 1) consultations + 환자/약사/문답 JOIN.
      //    기본 쿼리: 내가 patient_id 또는 pharmacist_id 인 행.
      //    약사 모드(viewRole==='pharmacist')에선 미할당 pending(pharmacist_id IS NULL) 도 함께 가져옴
      //    → DashboardClient.fetchPendingRequests 와 동일한 패턴(unassigned + my 머지). 채팅 목록에서도 새 요청 인지 가능.
      const selectCols = `
          id, patient_id, pharmacist_id, status, created_at,
          patient:profiles!consultations_patient_id_fkey(id, name, avatar_url),
          pharmacist:profiles!consultations_pharmacist_id_fkey(id, name, avatar_url),
          questionnaire:ai_questionnaires(symptoms)
        `;
      const mineQuery = supabase
        .from("consultations")
        .select(selectCols)
        .or(`patient_id.eq.${user.id},pharmacist_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      const unassignedQuery =
        viewRole === "pharmacist"
          ? supabase
              .from("consultations")
              .select(selectCols)
              .is("pharmacist_id", null)
              .eq("status", "pending")
          : Promise.resolve({ data: [] as unknown[], error: null });

      const [mineRes, unRes] = await Promise.all([mineQuery, unassignedQuery]);

      if (cancelled) return;
      if (mineRes.error) {
        console.error("[chat-list] consultations failed:", mineRes.error);
        setDbRooms([]);
        setDbLoading(false);
        return;
      }
      if (unRes && "error" in unRes && unRes.error) {
        console.error("[chat-list] unassigned pending failed:", unRes.error);
      }

      // 두 결과 id 기준 머지 (중복 제거) + 약사 본인이 환자로서 보낸 요청은 미할당 측에서 자연 제외(patient_id != me 조건 없이도 기본 쿼리 측에서 이미 포함됨)
      const mineRows = (mineRes.data ?? []) as unknown as DbConsultationRow[];
      const unRows =
        unRes && "data" in unRes ? ((unRes.data ?? []) as unknown as DbConsultationRow[]) : [];
      const byId = new Map<string, DbConsultationRow>();
      for (const r of [...mineRows, ...unRows]) byId.set(r.id, r);
      const merged = Array.from(byId.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      const rows = merged;
      if (rows.length === 0) {
        setDbRooms([]);
        setDbLoading(false);
        return;
      }

      // 2) 해당 consultation들의 메시지 일괄 로드 (최신부터)
      const consIds = rows.map((r) => r.id);
      const { data: msgRows, error: msgError } = await supabase
        .from("messages")
        .select("id, consultation_id, sender_id, content, is_read, created_at")
        .in("consultation_id", consIds)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (msgError) {
        console.error("[chat-list] messages failed:", msgError);
      }

      const allMsgs = ((msgRows ?? []) as unknown as DbMessageRow[]) ?? [];

      // 2.5) 약사 카운터파트의 license_name (면허증 이름) 조회 — 환자에게 보여지는 표시 이름은 면허증 이름 우선
      const pharmacistIds = Array.from(
        new Set(
          rows
            .map((r) => r.pharmacist_id)
            .filter((id): id is string => !!id && id !== user.id),
        ),
      );
      const licenseNameByPharmId = new Map<string, string>();
      if (pharmacistIds.length > 0) {
        const { data: ppRows, error: ppErr } = await supabase
          .from("pharmacist_profiles")
          .select("id, license_name")
          .in("id", pharmacistIds);
        if (cancelled) return;
        if (ppErr) {
          console.error("[chat-list] pharmacist_profiles license_name failed:", ppErr);
        } else {
          for (const pp of (ppRows ?? []) as { id: string; license_name: string | null }[]) {
            if (pp.license_name && pp.license_name.trim()) {
              licenseNameByPharmId.set(pp.id, pp.license_name.trim());
            }
          }
        }
      }

      // 3) consultation별 마지막 메시지 + 안 읽은 카운트 집계
      const lastByCons = new Map<string, DbMessageRow>();
      const unreadByCons = new Map<string, number>();
      for (const m of allMsgs) {
        if (!lastByCons.has(m.consultation_id)) {
          lastByCons.set(m.consultation_id, m);
        }
        if (!m.is_read && m.sender_id !== user.id) {
          unreadByCons.set(
            m.consultation_id,
            (unreadByCons.get(m.consultation_id) ?? 0) + 1,
          );
        }
      }

      // 3.5) (patient_id, pharmacist_id) 페어 묶기 — 옛 데이터에 같은 페어로 row 가 여러 개
      //      남아있을 수 있어 클라이언트 측에서 합침. 페어 내에서 last_message_at 가 가장
      //      최근인 row 만 살림. pharmacist_id 가 NULL 인 row(미할당 pending 등)는 묶지
      //      않고 각각 별도 카드로 유지.
      const tsOf = (r: DbConsultationRow): number => {
        const lm = lastByCons.get(r.id)?.created_at;
        const iso = lm ?? r.created_at;
        const t = new Date(iso).getTime();
        return Number.isFinite(t) ? t : 0;
      };
      const pairWinners = new Map<string, DbConsultationRow>();
      for (const r of rows) {
        const groupKey = r.pharmacist_id
          ? `${r.patient_id}|${r.pharmacist_id}`
          : `null|${r.id}`; // null pharmacist 는 묶지 않음 (자기 자신만의 그룹)
        const prev = pairWinners.get(groupKey);
        if (!prev || tsOf(r) > tsOf(prev)) {
          pairWinners.set(groupKey, r);
        }
      }
      const survivors = Array.from(pairWinners.values());

      // 4) ChatRoom 매핑 (살아남은 row 만)
      const built: ChatRoom[] = survivors.map((r) => {
        const isPatient = r.patient_id === user.id;
        const myRole: "patient" | "pharmacist" = isPatient ? "patient" : "pharmacist";
        const counterpart = isPatient ? r.pharmacist : r.patient;
        // 환자가 보는 약사 이름은 license_name 우선, 없으면 profiles.name 폴백.
        // 환자 측에서는 " 약사" 접미사 추가 (이미 끝에 "약사"면 그대로).
        const pharmLicense = isPatient && r.pharmacist_id
          ? licenseNameByPharmId.get(r.pharmacist_id)
          : undefined;
        const rawCounterpart =
          pharmLicense ?? counterpart?.name ?? (isPatient ? "약사" : "환자");
        const counterpartName = isPatient
          ? withPharmacistSuffix(rawCounterpart)
          : rawCounterpart;
        // 이니셜은 접미사 빼고 원본 이름 첫 글자로
        const initial = rawCounterpart.trim().charAt(0) || "?";

        const symptoms = (r.questionnaire?.symptoms ?? [])
          .slice(0, 2)
          .map((label) => symptomTagStyle(label));

        const lastMsg = lastByCons.get(r.id);
        const rawLastMessage = lastMsg?.content ?? "아직 메시지가 없어요";
        const lastMessage = formatPreview(rawLastMessage, myRole);
        const lastMessageAt = lastMsg?.created_at ?? r.created_at;
        const unreadCount = unreadByCons.get(r.id) ?? 0;

        return {
          id: r.id,
          myRole,
          counterpartName,
          initial,
          symptoms,
          lastMessage,
          lastMessageAt,
          unreadCount,
          hasPrevRejection: false,
          status: r.status,
        };
      });

      setDbRooms(built);
      setDbLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, viewRole]);

  /* ── ui_preferences (hide_rejected_chats) 로드 — 약사 시점에서만 ── */
  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!user) return;
    if (viewRole !== "pharmacist") return;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("ui_preferences")
        .eq("id", user.id)
        .maybeSingle<{ ui_preferences: { hide_rejected_chats?: boolean } | null }>();
      if (cancelled) return;
      if (error) {
        console.error("[chat-list] ui_preferences fetch failed:", error);
        return;
      }
      setHideRejected(data?.ui_preferences?.hide_rejected_chats === true);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, viewRole]);

  /* 토글 클릭 — 옵티미스틱 setState 후 profiles.ui_preferences UPDATE (실패 시 롤백) */
  const toggleHideRejected = async () => {
    if (!user) return;
    const next = !hideRejected;
    setHideRejected(next);
    // 기존 ui_preferences 키 보존하면서 hide_rejected_chats 만 갱신 — SELECT 후 머지.
    const { data: cur, error: getErr } = await supabase
      .from("profiles")
      .select("ui_preferences")
      .eq("id", user.id)
      .maybeSingle<{ ui_preferences: Record<string, unknown> | null }>();
    if (getErr) {
      console.error("[chat-list] ui_preferences fetch (toggle) failed:", getErr);
      setHideRejected(!next); // 롤백
      return;
    }
    const merged = { ...(cur?.ui_preferences ?? {}), hide_rejected_chats: next };
    const { error: upErr } = await (supabase
      .from("profiles") as unknown as {
        update: (p: { ui_preferences: Record<string, unknown> }) => {
          eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
        };
      })
      .update({ ui_preferences: merged })
      .eq("id", user.id);
    if (upErr) {
      console.error("[chat-list] ui_preferences UPDATE failed:", upErr);
      setHideRejected(!next); // 롤백
    }
  };

  // 표시 대상: 로그인 + DB 로드 완료 → DB 결과 사용 / 비로그인 → Mock 폴백.
  // hideRejected=true 면 status='rejected' row 클라이언트 측 필터링 (약사 전용 토글).
  const useDb = !!user;
  const rooms: ChatRoom[] = useMemo(() => {
    const base = useDb ? (dbRooms ?? []) : MOCK_CHATS;
    return hideRejected ? base.filter((r) => r.status !== "rejected") : base;
  }, [useDb, dbRooms, hideRejected]);
  const isLoading = authLoading || (useDb && dbLoading);
  const isEmpty = !isLoading && rooms.length === 0;
  const nowIso = useDb ? undefined : MOCK_NOW_ISO;

  // 상담 개수와 관계없이 항상 목록 화면을 먼저 보여줌 (자동 진입 제거)

  const sortedChats = useMemo(() => {
    const list = [...rooms];
    if (sortKey === "recent") {
      list.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      return list;
    }
    list.sort((a, b) => {
      const aHours = hoursSince(a.lastMessageAt, nowIso);
      const bHours = hoursSince(b.lastMessageAt, nowIso);
      const aUrgent = a.unreadCount > 0 && aHours >= 24 ? 0 : 1;
      const bUrgent = b.unreadCount > 0 && bHours >= 24 ? 0 : 1;
      if (aUrgent !== bUrgent) return aUrgent - bUrgent;

      const aUnread = a.unreadCount > 0 ? 0 : 1;
      const bUnread = b.unreadCount > 0 ? 0 : 1;
      if (aUnread !== bUnread) return aUnread - bUnread;

      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
    return list;
  }, [rooms, sortKey, nowIso]);

  return (
    <div style={{ minHeight: "100dvh", background: C.sageBg, fontFamily: "'Noto Sans KR', sans-serif" }}>
      <style>{`
        @keyframes chatListUnreadPulse {
          0%, 100% { background-color: #E02020; }
          50%      { background-color: #A01010; }
        }
        .chat-list-row:hover { background: #F8F9F7; }
        .chat-list-wrap { max-width: 560px; margin: 0 auto; padding: 20px 16px 80px; }
        @media (min-width: 1200px) {
          .chat-list-wrap { max-width: 700px; }
        }
        @keyframes chatListSkel {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div className="chat-list-wrap">
        {/* 헤더 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 16, gap: 10, flexWrap: "wrap",
        }}>
          <h1 style={{
            fontSize: 22, fontWeight: 700, color: C.textDark,
            fontFamily: "'Gothic A1', sans-serif", margin: 0,
          }}>
            채팅
          </h1>
          {/* 헤더 토글 wrapper — 로딩 중에만 숨김.
              "거절 숨기기"는 약사 시점에서 항상 노출 (빈 상태에서도 끌 수 있는 탈출구).
              "긴급순/최신순"은 항상 노출 (현재 정렬 기준 시각 확인 + 멘탈 모델 일관). */}
          {!isLoading && (
            <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {viewRole === "pharmacist" && (
                <button
                  type="button"
                  onClick={toggleHideRejected}
                  aria-pressed={hideRejected}
                  style={{
                    padding: "7px 14px",
                    fontSize: 14, fontWeight: 600,
                    background: hideRejected ? C.sageDeep : C.white,
                    color: hideRejected ? C.white : C.textMid,
                    border: `1px solid ${hideRejected ? C.sageDeep : C.border}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    fontFamily: "'Noto Sans KR', sans-serif",
                  }}
                >
                  거절 숨기기
                </button>
              )}
              <div style={{ display: "inline-flex", gap: 0, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", background: C.white }}>
                {(["urgent", "recent"] as const).map((k) => {
                  const active = sortKey === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSortKey(k)}
                      style={{
                        padding: "7px 14px",
                        fontSize: 14, fontWeight: 600,
                        background: active ? C.sageDeep : C.white,
                        color: active ? C.white : C.textMid,
                        border: "none", cursor: "pointer",
                        fontFamily: "'Noto Sans KR', sans-serif",
                      }}
                    >
                      {k === "urgent" ? "긴급순" : "최신순"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <ul style={{
            listStyle: "none", padding: 0, margin: 0,
            background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
            overflow: "hidden",
          }}>
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                style={{
                  padding: 16,
                  borderBottom: i === 2 ? "none" : `1px solid ${C.borderSoft}`,
                  display: "flex", alignItems: "center", gap: 12,
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: "linear-gradient(90deg, #F4F6F3 0%, #ECEFEB 50%, #F4F6F3 100%)",
                  backgroundSize: "200% 100%",
                  animation: "chatListSkel 1.4s ease-in-out infinite",
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ height: 14, width: "40%", borderRadius: 4, background: "#ECEFEB" }} />
                  <div style={{ height: 12, width: "85%", borderRadius: 4, background: "#F2F4F1" }} />
                </div>
              </li>
            ))}
          </ul>
        ) : isEmpty ? (
          <div style={{
            marginTop: 40,
            padding: "48px 20px", borderRadius: 14,
            background: C.white, border: `1px solid ${C.border}`,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 44, marginBottom: 10, lineHeight: 1 }}>📭</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark, marginBottom: 6 }}>
              아직 상담 내역이 없어요
            </div>
            <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.6 }}>
              {useDb
                ? "상담 요청을 보내거나 수락하면 채팅이 시작됩니다"
                : "환자 상담 요청을 수락하면 채팅이 시작됩니다"}
            </div>
          </div>
        ) : (
          <ul style={{
            listStyle: "none", padding: 0, margin: 0,
            background: C.white,
            borderRadius: 14, border: `1px solid ${C.border}`,
            overflow: "hidden",
          }}>
            {sortedChats.map((room, idx) => {
              const hrs = hoursSince(room.lastMessageAt, nowIso);
              const hasUnread = room.unreadCount > 0;
              return (
                <li
                  key={room.id}
                  onClick={() => router.push(`/chat/${room.id}?role=${room.myRole}`)}
                  className="chat-list-row"
                  style={{
                    display: "flex", alignItems: "center",
                    gap: 12, padding: 16,
                    borderBottom: idx === sortedChats.length - 1 ? "none" : `1px solid ${C.borderSoft}`,
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                >
                  {/* 아바타 */}
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: C.sagePale, color: C.sageDeep,
                    fontSize: 16, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    fontFamily: "'Gothic A1', sans-serif",
                  }}>
                    {room.initial}
                  </div>

                  {/* 가운데 */}
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 16, fontWeight: hasUnread ? 700 : 600,
                        color: C.textDark, whiteSpace: "nowrap",
                      }}>
                        {room.counterpartName}
                      </span>
                      {room.hasPrevRejection && (
                        <span
                          title="이전 거절 이력 있음"
                          aria-label="이전 거절 이력 있음"
                          style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}
                        >
                          ⚠️
                        </span>
                      )}
                      {/* 상태 배지 — consultations.status 기반.
                          'completed'/'cancelled' → "상담 종료" (중성 회색),
                          'pending' → "상담 요청 중" (sage 톤),
                          'accepted'/'chatting'/'matched'/'active'/'in_progress'/'visit_scheduled' → "상담 진행 중" (sage 톤). */}
                      {(() => {
                        const label = statusBadgeLabel(room.status);
                        if (!label) return null;
                        const isEnded = label === "상담 종료" || label === "거절됨";
                        return (
                          <span
                            aria-label={label}
                            style={{
                              display: "inline-block",
                              padding: "2px 8px", borderRadius: 6,
                              fontSize: 12, fontWeight: 600,
                              background: isEnded ? "#F4F5F3" : C.sagePale,
                              color: isEnded ? "#3D4A42" : C.sageDeep,
                              border: `1px solid ${isEnded ? "rgba(94,125,108,0.18)" : C.sageLight}`,
                              whiteSpace: "nowrap", flexShrink: 0,
                              fontFamily: "'Noto Sans KR', sans-serif",
                            }}
                          >
                            {label}
                          </span>
                        );
                      })()}
                      {room.symptoms.slice(0, 2).map((s) => (
                        <span key={s.label} style={{
                          display: "inline-block",
                          padding: "2px 8px", borderRadius: 100,
                          fontSize: 12, fontWeight: 600,
                          background: s.bg, color: s.color,
                          whiteSpace: "nowrap", flexShrink: 0,
                        }}>
                          {s.label}
                        </span>
                      ))}
                    </div>
                    <div style={{
                      fontSize: 14,
                      fontWeight: hasUnread ? 500 : 400,
                      color: hasUnread ? C.textDark : C.textMid,
                      lineHeight: 1.4,
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      wordBreak: "break-word",
                    }}>
                      {room.lastMessage}
                    </div>
                  </div>

                  {/* 오른쪽 */}
                  <div style={{
                    display: "flex", flexDirection: "column",
                    alignItems: "flex-end", gap: 6,
                    flexShrink: 0, minWidth: 48,
                  }}>
                    <span style={{ fontSize: 13, color: C.textMid, whiteSpace: "nowrap" }}>
                      {fmtChatTime(room.lastMessageAt, nowIso)}
                    </span>
                    {room.unreadCount > 0 && (
                      <span
                        style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          minWidth: 20, height: 20,
                          padding: "0 6px", borderRadius: 100,
                          fontSize: 11, fontWeight: 700,
                          ...getUnreadBadgeStyle(hrs),
                        }}
                      >
                        {room.unreadCount}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function ChatListClient() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
