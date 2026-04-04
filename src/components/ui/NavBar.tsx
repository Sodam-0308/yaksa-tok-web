"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface NavBarProps {
  /** "landing" = 랜딩 네비게이션 (로고 + 링크), "page" = 서브페이지 (뒤로가기 + 타이틀) */
  variant?: "landing" | "page";
  title?: string;
  onBack?: () => void;
}

export default function NavBar({
  variant = "landing",
  title,
  onBack,
}: NavBarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (variant === "page") {
    return (
      <nav className="fixed top-0 left-0 right-0 z-100 px-6 h-14 flex items-center gap-3 bg-sage-bg/95 backdrop-blur-xl border-b border-border">
        <button
          onClick={onBack ?? (() => window.history.back())}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-transparent border-none cursor-pointer text-xl text-text-mid hover:bg-sage-pale transition-colors"
          aria-label="뒤로가기"
        >
          ←
        </button>
        {title && (
          <div className="flex-1 font-heading text-base font-bold text-text-dark">
            {title}
          </div>
        )}
      </nav>
    );
  }

  return (
    <nav
      className={`
        fixed top-0 left-0 right-0 z-100
        px-6 md:px-10 h-[60px]
        flex items-center justify-between
        bg-sage-bg/90 backdrop-blur-[20px]
        border-b border-border
        transition-shadow duration-200
        ${scrolled ? "shadow-[0_2px_20px_rgba(74,99,85,0.06)]" : ""}
      `}
    >
      <Link
        href="/"
        className="font-heading text-xl font-extrabold text-sage-deep no-underline tracking-[-0.5px]"
      >
        약사톡<span className="text-terra">.</span>
      </Link>
      <div className="flex items-center gap-4">
        <Link
          href="/#how"
          className="hidden md:block text-sm text-text-mid no-underline hover:text-text-dark transition-colors"
        >
          이용방법
        </Link>
        <Link
          href="/#pharmacists"
          className="hidden md:block text-sm text-text-mid no-underline hover:text-text-dark transition-colors"
        >
          약사 소개
        </Link>
        <Link
          href="/signup"
          className="px-5 py-2 bg-sage-deep text-white rounded-full text-[14px] font-medium no-underline hover:bg-sage-mid transition-colors"
        >
          시작하기
        </Link>
      </div>
    </nav>
  );
}
