"use client";

import { useState } from "react";

/** 다음 우편번호 SDK 글로벌 타입 (키 없이 무료 사용 — postcode.v2.js). */
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    daum?: any;
  }
}

const SDK_SRC = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
const SDK_SCRIPT_ID = "daum-postcode-sdk";

/** SDK 가 로딩 안 됐으면 1회만 삽입하고 로딩을 기다린다.
 *  이미 window.daum?.Postcode 가 있으면 즉시 resolve.
 *  같은 id 의 script 가 이미 있으면 그 onload 를 기다린다. */
function ensureDaumPostcode(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("not in browser"));
  }
  if (window.daum?.Postcode) return Promise.resolve();

  const existing = document.getElementById(SDK_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      const onLoad = () => {
        if (window.daum?.Postcode) resolve();
        else reject(new Error("daum.Postcode not ready"));
      };
      existing.addEventListener("load", onLoad, { once: true });
      existing.addEventListener("error", () => reject(new Error("sdk load error")), { once: true });
      // 이미 load 가 끝났는데 daum 이 비어 있으면 즉시 reject (대부분 없음)
      if (window.daum?.Postcode) resolve();
    });
  }

  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.id = SDK_SCRIPT_ID;
    s.src = SDK_SRC;
    s.async = true;
    s.onload = () => {
      if (window.daum?.Postcode) resolve();
      else reject(new Error("daum.Postcode not ready after onload"));
    };
    s.onerror = () => reject(new Error("sdk load error"));
    document.body.appendChild(s);
  });
}

type AddressSearchButtonProps = {
  onSelect: (roadAddress: string) => void;
  label?: string;
};

/** 약국 주소 검색 공통 버튼 — 다음 우편번호 팝업을 띄워 roadAddress (없으면 jibunAddress) 를 부모로 전달.
 *  외부에서 받은 onSelect 로 부모의 주소 state 를 갱신하면 됨. */
export default function AddressSearchButton({ onSelect, label }: AddressSearchButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await ensureDaumPostcode();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new window.daum.Postcode({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        oncomplete: (data: any) => {
          const addr: string =
            (typeof data?.roadAddress === "string" && data.roadAddress.trim()) ||
            (typeof data?.jibunAddress === "string" && data.jibunAddress.trim()) ||
            "";
          if (addr) onSelect(addr);
        },
      }).open();
    } catch (err) {
      console.error("[AddressSearchButton] postcode SDK load failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 48,
        padding: "0 16px",
        borderRadius: 10,
        background: "#4A6355",
        color: "#fff",
        border: "none",
        fontSize: 14,
        fontWeight: 700,
        cursor: loading ? "default" : "pointer",
        fontFamily: "'Noto Sans KR', sans-serif",
        whiteSpace: "nowrap",
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? "여는 중..." : label ?? "주소 검색"}
    </button>
  );
}
