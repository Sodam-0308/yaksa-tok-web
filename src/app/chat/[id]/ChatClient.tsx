"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";

interface Message {
  id: string;
  sender: "patient" | "pharmacist";
  content: string;
  time: string;
  isRead: boolean;
}

const DEMO_MESSAGES: Message[] = [
  {
    id: "1",
    sender: "pharmacist",
    content: "안녕하세요, 김서연 약사입니다. 문답 내용 잘 확인했어요. 만성피로와 소화불량이 주요 증상이시군요.",
    time: "오전 10:02",
    isRead: true,
  },
  {
    id: "2",
    sender: "patient",
    content: "네, 맞아요. 아침에 일어나기가 너무 힘들고 밥 먹으면 항상 더부룩해요.",
    time: "오전 10:05",
    isRead: true,
  },
  {
    id: "3",
    sender: "pharmacist",
    content: "혹시 현재 복용 중인 영양제가 있으신가요? 그리고 평소 식사는 규칙적으로 하시는 편인지 궁금해요.",
    time: "오전 10:08",
    isRead: true,
  },
  {
    id: "4",
    sender: "patient",
    content: "종합비타민이랑 유산균 먹고 있어요. 식사는 아침은 거의 못 먹고 점심, 저녁만 먹어요.",
    time: "오전 10:12",
    isRead: true,
  },
  {
    id: "5",
    sender: "pharmacist",
    content: "아, 그러시군요. 아침 공복이 길면 소화 기능이 더 약해질 수 있어요. 현재 드시는 유산균 종류도 한번 확인해 볼게요. 약국에 방문하시면 더 자세히 상담드릴 수 있어요.",
    time: "오전 10:15",
    isRead: true,
  },
  {
    id: "6",
    sender: "patient",
    content: "네! 이번 주 토요일에 방문해도 될까요?",
    time: "오전 10:18",
    isRead: false,
  },
];

const PHARMACIST_INFO = {
  name: "김서연 약사",
  pharmacy: "초록숲 약국",
  avatar: "👩‍⚕️",
  status: "online" as const,
};

export default function ChatClient() {
  return (
    <Suspense>
      <ChatContent />
    </Suspense>
  );
}

function ChatContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const chatId = params.id as string;
  const role = searchParams.get("role") === "pharmacist" ? "pharmacist" : "patient";

  const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours < 12 ? "오전" : "오후";
    const h = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const timeStr = `${ampm} ${h}:${String(minutes).padStart(2, "0")}`;

    const newMsg: Message = {
      id: String(Date.now()),
      sender: role,
      content: text,
      time: timeStr,
      isRead: false,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInput("");

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleRole = () => {
    const newRole = role === "patient" ? "pharmacist" : "patient";
    router.replace(`/chat/${chatId}?role=${newRole}`);
  };

  const hasUnreadByPharmacist = messages.some((m) => m.sender === "patient" && !m.isRead);

  return (
    <div className="chat-page">
      {/* Header */}
      <nav className="chat-nav">
        <button
          className="nav-back"
          onClick={() => router.back()}
          aria-label="뒤로가기"
        >
          ←
        </button>
        <div className="chat-nav-center">
          <div className="chat-avatar">{PHARMACIST_INFO.avatar}</div>
          <div className="chat-nav-info">
            <div className="chat-nav-name">
              {role === "patient" ? PHARMACIST_INFO.name : "홍길동 님"}
            </div>
            <div className="chat-nav-pharmacy">
              {role === "patient" ? PHARMACIST_INFO.pharmacy : "만성피로 · 소화불량"}
            </div>
          </div>
        </div>
        <div className="chat-nav-status">
          <span className="status-dot online" />
          <span className="status-label">접속 중</span>
        </div>
      </nav>

      {/* Role toggle (demo) */}
      <div className="chat-role-toggle">
        <button
          className={`role-btn${role === "patient" ? " active" : ""}`}
          onClick={() => role !== "patient" && toggleRole()}
        >
          환자 화면
        </button>
        <button
          className={`role-btn${role === "pharmacist" ? " active" : ""}`}
          onClick={() => role !== "pharmacist" && toggleRole()}
        >
          약사 화면
        </button>
      </div>

      {/* Status banner */}
      {role === "patient" && (
        <div className={`chat-status-banner${hasUnreadByPharmacist ? " waiting" : " read"}`}>
          {hasUnreadByPharmacist
            ? "약사가 확인 중입니다"
            : "약사가 읽었습니다"}
        </div>
      )}
      {role === "pharmacist" && (
        <div className="chat-status-banner pharmacist-banner">
          환자의 AI 문답 요약을 확인하고 상담을 시작하세요
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        <div className="chat-date-divider">
          <span>오늘</span>
        </div>
        {messages.map((msg) => {
          const isMine = msg.sender === role;
          return (
            <div
              key={msg.id}
              className={`chat-bubble-wrap${isMine ? " mine" : " theirs"}`}
            >
              {!isMine && (
                <div className="bubble-avatar">
                  {role === "patient" ? PHARMACIST_INFO.avatar : "🙂"}
                </div>
              )}
              <div className="bubble-col">
                {!isMine && (
                  <div className="bubble-name">
                    {role === "patient" ? PHARMACIST_INFO.name : "홍길동"}
                  </div>
                )}
                <div className="bubble-row">
                  {isMine && (
                    <div className="bubble-meta mine-meta">
                      {msg.isRead && (
                        <span className="read-receipt">읽음</span>
                      )}
                      <span className="bubble-time">{msg.time}</span>
                    </div>
                  )}
                  <div className={`chat-bubble${isMine ? " mine" : " theirs"}`}>
                    {msg.content}
                  </div>
                  {!isMine && (
                    <div className="bubble-meta">
                      <span className="bubble-time">{msg.time}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-bar">
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder="메시지를 입력하세요..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          className="chat-send-btn"
          onClick={sendMessage}
          disabled={!input.trim()}
          aria-label="전송"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
