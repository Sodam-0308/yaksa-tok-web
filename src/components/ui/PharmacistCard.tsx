"use client";

import Link from "next/link";

export interface PharmacistData {
  id: string;
  name: string;
  avatar: string;
  pharmacyName: string;
  location: string;
  distance: string;
  walkTime: string;
  matchRate?: number;
  specialties: { label: string; variant: TagVariant; isMatch?: boolean }[];
  caseCount: number;
  avgResponseTime: string;
  badge?: string;
}

type TagVariant = "sage" | "terra" | "lavender" | "rose" | "blue" | "match";

const tagStyles: Record<TagVariant, string> = {
  sage: "bg-sage-pale text-sage-deep",
  terra: "bg-terra-light text-terra-dark",
  lavender: "bg-[#EEEDFE] text-[#534AB7]",
  rose: "bg-[#FBEAF0] text-[#993556]",
  blue: "bg-[#E6F1FB] text-[#185FA5]",
  match: "bg-terra-pale text-terra border border-[rgba(192,107,69,0.2)]",
};

interface PharmacistCardProps {
  data: PharmacistData;
  onRequestConsult?: (name: string) => void;
}

export default function PharmacistCard({
  data,
  onRequestConsult,
}: PharmacistCardProps) {
  return (
    <Link
      href={`/pharmacist/${data.id}`}
      className="block bg-white border border-border rounded-[18px] p-5 no-underline text-text-dark transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(74,99,85,0.08)] hover:border-sage-light"
    >
      {/* Top: Avatar + Info */}
      <div className="flex items-start gap-3.5 mb-3.5">
        <div className="w-[52px] h-[52px] rounded-full bg-sage-pale flex items-center justify-center text-[22px] shrink-0">
          {data.avatar}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-heading text-base font-bold">
              {data.name}
            </span>
            {data.badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-terra-light text-terra-dark">
                {data.badge}
              </span>
            )}
          </div>
          <div className="text-[13px] text-text-muted mb-1.5">
            {data.pharmacyName} · {data.location}
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-sage-deep font-medium bg-sage-pale px-2.5 py-[3px] rounded-full">
            📍 {data.distance} · {data.walkTime}
          </span>
        </div>
      </div>

      {/* Match Rate */}
      {data.matchRate !== undefined && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] text-text-muted">내 증상 매칭률</span>
          <div className="flex-1 h-1 bg-border rounded-sm overflow-hidden">
            <div
              className="h-full bg-terra rounded-sm transition-[width] duration-600"
              style={{ width: `${data.matchRate}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-terra">
            {data.matchRate}%
          </span>
        </div>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3.5">
        {data.specialties.map((s) => (
          <span
            key={s.label}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${tagStyles[s.variant]}`}
          >
            {s.isMatch && "✦ "}
            {s.label}
          </span>
        ))}
      </div>

      {/* Bottom */}
      <div className="flex items-center justify-between pt-3.5 border-t border-border">
        <div className="flex gap-4">
          <span className="text-xs text-text-muted">
            개선 사례 <strong className="text-text-dark font-semibold">{data.caseCount}건</strong>
          </span>
          <span className="text-xs text-text-muted">
            평균 답변 <strong className="text-text-dark font-semibold">{data.avgResponseTime}</strong>
          </span>
        </div>
        <button
          className="px-4.5 py-2 bg-sage-deep text-white border-none rounded-full text-[13px] font-medium cursor-pointer hover:bg-sage-mid transition-colors font-body"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRequestConsult?.(data.name);
          }}
        >
          상담 요청
        </button>
      </div>
    </Link>
  );
}
