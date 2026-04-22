"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter } from "next/navigation";

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
   타입 & Mock
   ══════════════════════════════════════════ */

interface ChatRoom {
  id: string;
  patientName: string;
  /** 아바타 이니셜 (한글 1자 권장) */
  initial: string;
  /** 증상 태그 */
  symptoms: { label: string; bg: string; color: string }[];
  /** 마지막 메시지 미리보기 */
  lastMessage: string;
  /** 환자 마지막 메시지 시각 (ISO) */
  lastMessageAt: string;
  /** 약사 답장 필요한 안 읽은 메시지 수 (환자가 보낸 미읽음) */
  unreadCount: number;
  /** ⚠️ 거절 이력 있는 환자 (재요청) */
  hasPrevRejection: boolean;
}

const NOW_ISO = "2026-04-21T10:00:00+09:00";

const MOCK_CHATS: ChatRoom[] = [
  {
    id: "c-2",
    patientName: "박○○",
    initial: "박",
    symptoms: [{ label: "소화장애", bg: "#FAEEDA", color: "#854F0B" }],
    lastMessage: "약사님, 어제 알려주신 유산균 먹고 속이 좀 편해졌는데 아직 점심 이후에는 더부룩해요.",
    lastMessageAt: "2026-04-19T14:20:00+09:00",
    unreadCount: 5,
    hasPrevRejection: false,
  },
  {
    id: "c-9",
    patientName: "조○○",
    initial: "조",
    symptoms: [{ label: "탈모", bg: "#FAECE7", color: "#993C1D" }],
    lastMessage: "추천해주신 영양제 관련해서 질문이 있어요. 언제쯤 효과를 볼 수 있나요?",
    lastMessageAt: "2026-04-20T08:30:00+09:00",
    unreadCount: 1,
    hasPrevRejection: false,
  },
  {
    id: "c-1",
    patientName: "김○○",
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
  {
    id: "c-7",
    patientName: "윤○○",
    initial: "윤",
    symptoms: [
      { label: "소화장애", bg: "#FAEEDA", color: "#854F0B" },
      { label: "만성피로", bg: "#EAF3DE", color: "#3B6D11" },
    ],
    lastMessage: "약사 김서연: 오늘 방문하실 때 꼭 아침 드시고 오세요.",
    lastMessageAt: "2026-04-20T19:12:00+09:00",
    unreadCount: 0,
    hasPrevRejection: false,
  },
  {
    id: "c-3",
    patientName: "이○○",
    initial: "이",
    symptoms: [{ label: "관절통", bg: "#E1F5EE", color: "#0F6E56" }],
    lastMessage: "오메가3 복용 시작한 지 2주째인데 아침 손가락 강직이 좀 덜한 것 같아요.",
    lastMessageAt: "2026-04-18T11:05:00+09:00",
    unreadCount: 0,
    hasPrevRejection: false,
  },
  {
    id: "c-12",
    patientName: "장○○",
    initial: "장",
    symptoms: [{ label: "소화장애", bg: "#FAEEDA", color: "#854F0B" }],
    lastMessage: "다시 상담 신청드립니다. 이번엔 증상이 좀 달라서요.",
    lastMessageAt: "2026-04-21T06:50:00+09:00",
    unreadCount: 1,
    hasPrevRejection: true,
  },
];

/* ══════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════ */

function hoursSince(iso: string, nowIso = NOW_ISO): number {
  const then = new Date(iso).getTime();
  const now = new Date(nowIso).getTime();
  if (Number.isNaN(then) || Number.isNaN(now)) return 0;
  return Math.max(0, (now - then) / 3_600_000);
}

/** 카카오톡 스타일 시간 표시 */
function fmtChatTime(iso: string, nowIso = NOW_ISO): string {
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

type SortKey = "urgent" | "recent";

/* ══════════════════════════════════════════
   메인
   ══════════════════════════════════════════ */

function Content() {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("urgent");

  // 채팅방이 1개뿐이면 바로 해당 방으로 이동
  useEffect(() => {
    if (MOCK_CHATS.length === 1) {
      router.replace(`/chat/${MOCK_CHATS[0].id}?role=pharmacist`);
    }
  }, [router]);

  const sortedChats = useMemo(() => {
    const list = [...MOCK_CHATS];
    if (sortKey === "recent") {
      // 마지막 대화 최신순
      list.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      return list;
    }
    // urgent: 24h+ unread → unread → 최신
    list.sort((a, b) => {
      const aHours = hoursSince(a.lastMessageAt);
      const bHours = hoursSince(b.lastMessageAt);
      const aUrgent = a.unreadCount > 0 && aHours >= 24 ? 0 : 1;
      const bUrgent = b.unreadCount > 0 && bHours >= 24 ? 0 : 1;
      if (aUrgent !== bUrgent) return aUrgent - bUrgent;

      const aUnread = a.unreadCount > 0 ? 0 : 1;
      const bUnread = b.unreadCount > 0 ? 0 : 1;
      if (aUnread !== bUnread) return aUnread - bUnread;

      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
    return list;
  }, [sortKey]);

  const isEmpty = MOCK_CHATS.length === 0;

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
          {!isEmpty && (
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
          )}
        </div>

        {isEmpty ? (
          <div style={{
            marginTop: 40,
            padding: "48px 20px", borderRadius: 14,
            background: C.white, border: `1px solid ${C.border}`,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 44, marginBottom: 10, lineHeight: 1 }}>📭</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark, marginBottom: 6 }}>
              아직 진행 중인 채팅이 없어요
            </div>
            <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.6 }}>
              환자 상담 요청을 수락하면 채팅이 시작됩니다
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
              const hrs = hoursSince(room.lastMessageAt);
              const hasUnread = room.unreadCount > 0;
              return (
                <li
                  key={room.id}
                  onClick={() => router.push(`/chat/${room.id}?role=pharmacist`)}
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
                        {room.patientName}
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
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
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
                      {fmtChatTime(room.lastMessageAt)}
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
