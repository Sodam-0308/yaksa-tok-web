export type Category =
  | "첫 인사"
  | "방문 안내"
  | "영양제 설명"
  | "생활 가이드"
  | "팔로업"
  | "기타";

export const CATEGORIES: Category[] = [
  "첫 인사",
  "방문 안내",
  "영양제 설명",
  "생활 가이드",
  "팔로업",
  "기타",
];

export const CATEGORY_STYLE: Record<Category, { bg: string; color: string }> = {
  "첫 인사":     { bg: "#EDF4F0", color: "#4A6355" },
  "방문 안내":   { bg: "#FFF8E1", color: "#B06D00" },
  "영양제 설명": { bg: "#E6F1FB", color: "#185FA5" },
  "생활 가이드": { bg: "#FBF5F1", color: "#C06B45" },
  "팔로업":      { bg: "#EEEDFE", color: "#534AB7" },
  "기타":        { bg: "#F0F0F0", color: "#555555" },
};

export interface Template {
  id: string;
  category: Category;
  title: string;
  content: string;
}

export const INITIAL_TEMPLATES: Template[] = [
  {
    id: "t-1",
    category: "첫 인사",
    title: "인사 및 문답 확인",
    content:
      "안녕하세요, 김서연 약사입니다. 문답 내용 잘 확인했어요. 궁금한 점 편하게 물어봐 주세요!",
  },
  {
    id: "t-2",
    category: "방문 안내",
    title: "방문 일정 안내",
    content:
      "약국 방문 시 현재 복용 중인 영양제가 있으시면 함께 가져와 주세요. 체질에 맞게 조정해드릴게요.",
  },
  {
    id: "t-3",
    category: "영양제 설명",
    title: "유산균 복용법",
    content:
      "유산균은 공복에 드시는 게 가장 효과적이에요. 아침 식사 30분 전이 좋습니다.",
  },
  {
    id: "t-4",
    category: "생활 가이드",
    title: "카페인 줄이기",
    content:
      "카페인은 하루 2잔 이하로 줄여보세요. 오후 2시 이후에는 되도록 피하시는 게 수면에 도움이 됩니다.",
  },
  {
    id: "t-5",
    category: "팔로업",
    title: "복용 확인",
    content:
      "영양제 복용 시작하신 지 2주 됐는데, 혹시 변화가 느껴지시나요? 불편한 점 있으면 말씀해주세요.",
  },
];
