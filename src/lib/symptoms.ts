export interface Symptom {
  id: string;
  emoji: string;
  label: string;
}

export const SYMPTOMS: Symptom[] = [
  { id: "만성피로", emoji: "😴", label: "만성피로" },
  { id: "소화장애", emoji: "🫠", label: "소화장애" },
  { id: "불면", emoji: "🌙", label: "불면" },
  { id: "비염", emoji: "🤧", label: "비염" },
  { id: "두통", emoji: "🤕", label: "두통" },
  { id: "생리통", emoji: "🩸", label: "생리통" },
  { id: "여드름", emoji: "🧴", label: "여드름" },
  { id: "아토피", emoji: "🫲", label: "아토피" },
  { id: "우울·불안", emoji: "😶‍🌫️", label: "우울·불안" },
  { id: "안구건조", emoji: "👁️", label: "안구건조" },
  { id: "수족냉증", emoji: "🥶", label: "수족냉증" },
  { id: "붓기", emoji: "🫧", label: "붓기" },
];
