interface StepProgressProps {
  totalSteps: number;
  currentStep: number; // 1-indexed
}

export default function StepProgress({
  totalSteps,
  currentStep,
}: StepProgressProps) {
  return (
    <div className="flex gap-1.5 mb-8">
      {Array.from({ length: totalSteps }).map((_, i) => {
        const step = i + 1;
        let style = "bg-border";
        if (step < currentStep) style = "bg-sage-bright";
        if (step === currentStep) style = "bg-sage-deep";
        return (
          <div
            key={i}
            className={`h-[3px] flex-1 rounded-[3px] transition-all duration-400 ${style}`}
          />
        );
      })}
    </div>
  );
}
