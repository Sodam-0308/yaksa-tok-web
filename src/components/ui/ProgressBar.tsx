interface ProgressBarProps {
  /** 0~100 */
  percent: number;
}

export default function ProgressBar({ percent }: ProgressBarProps) {
  return (
    <div className="fixed top-14 left-0 right-0 z-99 h-[3px] bg-border">
      <div
        className="h-full bg-sage-deep rounded-r-[3px] transition-[width] duration-400"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
