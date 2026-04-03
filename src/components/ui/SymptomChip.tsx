"use client";

interface SymptomChipProps {
  emoji: string;
  label: string;
  selected?: boolean;
  onClick?: () => void;
}

export default function SymptomChip({
  emoji,
  label,
  selected = false,
  onClick,
}: SymptomChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3.5 py-3
        bg-white border-[1.5px] rounded-[14px]
        cursor-pointer text-left font-body
        transition-all duration-200 ease-out
        hover:border-sage-light hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(74,99,85,0.08)]
        ${
          selected
            ? "border-sage-mid bg-sage-pale -translate-y-0.5 shadow-[0_6px_20px_rgba(74,99,85,0.1)]"
            : "border-border"
        }
      `}
    >
      <span className="text-xl shrink-0">{emoji}</span>
      <span className="text-[13px] font-medium text-text-dark">{label}</span>
    </button>
  );
}
