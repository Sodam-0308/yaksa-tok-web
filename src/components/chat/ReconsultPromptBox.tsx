"use client";

type Props = {
  onClickRequest: () => void;
};

export default function ReconsultPromptBox({ onClickRequest }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        margin: "8px 16px 0",
        padding: "16px 18px",
        borderRadius: 12,
        background: "#EDF4F0",
        border: "1px solid rgba(94,125,108,0.18)",
        color: "#2C3630",
        fontFamily: "'Noto Sans KR', sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "#2C3630",
          lineHeight: 1.5,
          textAlign: "center",
        }}
      >
        상담이 종료되었어요
      </div>
      <div
        style={{
          fontSize: 14,
          color: "#3D4A42",
          lineHeight: 1.5,
          marginTop: 6,
          textAlign: "center",
        }}
      >
        다시 상담이 필요하시면 재상담을 요청해 보세요
      </div>
      <button
        type="button"
        onClick={onClickRequest}
        style={{
          width: "100%",
          height: 44,
          marginTop: 12,
          borderRadius: 10,
          background: "#4A6355",
          color: "#fff",
          border: "none",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "'Noto Sans KR', sans-serif",
        }}
      >
        재상담 요청하기
      </button>
    </div>
  );
}
