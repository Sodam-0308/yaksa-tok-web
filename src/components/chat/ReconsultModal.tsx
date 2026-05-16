"use client";

type Props = {
  open: boolean;
  onClose: () => void;
  onChooseNewSymptom: () => void;
};

export default function ReconsultModal({ open, onClose, onChooseNewSymptom }: Props) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: 16,
          padding: "28px 24px 24px",
          maxWidth: 340,
          width: "100%",
          margin: "0 16px",
          boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
          fontFamily: "'Noto Sans KR', sans-serif",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 18,
            color: "#3D4A42",
            lineHeight: 1,
            padding: 0,
            fontFamily: "'Noto Sans KR', sans-serif",
          }}
        >
          ✕
        </button>

        <div
          style={{
            fontSize: 32,
            textAlign: "center",
            marginBottom: 8,
            lineHeight: 1,
          }}
        >
          👋
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#2C3630",
            textAlign: "center",
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          어떤 상담을 이어가시겠어요?
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            disabled
            aria-disabled
            style={{
              position: "relative",
              height: 48,
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              background: "#F4F6F3",
              color: "#7A8A80",
              border: "none",
              cursor: "not-allowed",
              fontFamily: "'Noto Sans KR', sans-serif",
              textAlign: "center",
              padding: "0 88px 0 16px",
            }}
          >
            같은 증상으로 이어서
            <span
              aria-hidden
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 11,
                color: "#9CA3AF",
                background: "#fff",
                padding: "2px 8px",
                borderRadius: 6,
                border: "1px solid rgba(94,125,108,0.14)",
                fontWeight: 600,
                fontFamily: "'Noto Sans KR', sans-serif",
              }}
            >
              준비 중
            </span>
          </button>

          <button
            type="button"
            onClick={onChooseNewSymptom}
            style={{
              height: 48,
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              background: "#4A6355",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontFamily: "'Noto Sans KR', sans-serif",
            }}
          >
            새 증상으로 상담
          </button>
        </div>
      </div>
    </div>
  );
}
