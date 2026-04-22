"use client";

import { useEffect, useState } from "react";

interface Props {
  images: string[];
  startIndex?: number;
  onClose: () => void;
}

export default function PhotoLightbox({ images, startIndex = 0, onClose }: Props) {
  const [idx, setIdx] = useState(
    Math.min(Math.max(startIndex, 0), Math.max(images.length - 1, 0)),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      else if (e.key === "ArrowRight") setIdx((i) => Math.min(images.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [images.length, onClose]);

  if (!images.length) return null;

  const hasPrev = idx > 0;
  const hasNext = idx < images.length - 1;

  const navBtn: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 48,
    height: 48,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.15)",
    color: "#fff",
    border: "none",
    fontSize: 24,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    lineHeight: 1,
  };

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="사진 크게 보기"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="닫기"
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.15)",
          color: "#fff",
          border: "none",
          fontSize: 20,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          lineHeight: 1,
        }}
      >
        ✕
      </button>

      {hasPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIdx((i) => Math.max(0, i - 1));
          }}
          aria-label="이전 사진"
          style={{ ...navBtn, left: 20 }}
        >
          ‹
        </button>
      )}
      {hasNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIdx((i) => Math.min(images.length - 1, i + 1));
          }}
          aria-label="다음 사진"
          style={{ ...navBtn, right: 20 }}
        >
          ›
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[idx]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "90vw",
          maxHeight: "85vh",
          objectFit: "contain",
          borderRadius: 8,
          userSelect: "none",
        }}
      />

      {images.length > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            color: "#fff",
            fontSize: 14,
            background: "rgba(0,0,0,0.5)",
            padding: "4px 12px",
            borderRadius: 12,
            pointerEvents: "none",
          }}
        >
          {idx + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
