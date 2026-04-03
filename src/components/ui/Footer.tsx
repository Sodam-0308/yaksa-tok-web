import Link from "next/link";

export default function Footer() {
  return (
    <footer className="px-6 pt-10 pb-8 bg-text-dark text-white/40">
      <div className="max-w-[800px] mx-auto flex flex-col gap-5">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div className="font-heading text-lg font-extrabold text-white">
            약사톡<span className="text-terra">.</span>
          </div>
          <div className="flex gap-5 flex-wrap">
            <Link
              href="#"
              className="text-[13px] text-white/40 no-underline hover:text-white/80 transition-colors"
            >
              이용약관
            </Link>
            <Link
              href="#"
              className="text-[13px] text-white/40 no-underline hover:text-white/80 transition-colors"
            >
              개인정보처리방침
            </Link>
            <Link
              href="#"
              className="text-[13px] text-white/40 no-underline hover:text-white/80 transition-colors"
            >
              자주 묻는 질문
            </Link>
          </div>
        </div>
        <div className="text-xs leading-[1.7] pt-5 border-t border-white/[0.06]">
          약사톡은 의료 행위를 하지 않으며, 영양 상담 연결 서비스를 제공합니다.
          본 서비스는 의사의 진료를 대체하지 않습니다.
        </div>
        <div className="text-[11px] text-white/25">
          &copy; 2026 약사톡. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
