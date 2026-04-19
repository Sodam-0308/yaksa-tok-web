export type QuestionType =
  | "single"
  | "multi"
  | "slider"
  | "input_row"
  | "textarea"
  | "bristol";

export interface OptionItem {
  text: string;
  emoji?: string;
}

export interface BristolOption {
  emoji?: string;
  label: string;
  desc: string;
}

export interface InputField {
  key: string;
  label: string;
  placeholder: string;
  unit: string;
  type: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  title: string;
  desc?: string;
  grid?: boolean;
  sectionLabel?: string;
  // single / multi
  options?: (string | OptionItem)[];
  // bristol
  bristolOptions?: BristolOption[];
  // slider
  min?: number;
  max?: number;
  value?: number;
  leftLabel?: string;
  rightLabel?: string;
  // input_row
  inputs?: InputField[];
  // textarea
  placeholder?: string;
  minChars?: number;
  // condition
  condition?: (answers: Record<string, unknown>) => boolean;
}

export const questions: Question[] = [
  // ── 공통 기본 ──
  {
    id: "symptoms",
    type: "multi",
    label: "질문 1",
    title: "주로 불편한 증상을<br/>모두 골라주세요",
    desc: "해당하는 것을 모두 선택해주세요.",
    grid: true,
    options: [
      "만성피로", "소화장애", "불면/수면", "여성건강/생리통",
      "피부", "비염/알레르기", "변비/장건강", "우울/불안/스트레스",
      "탈모", "체중 관리/붓기", "항노화/항산화", "면역력저하",
    ],
  },
  {
    id: "body",
    type: "input_row",
    label: "질문 2",
    title: "키와 몸무게를<br/>알려주세요",
    desc: "약사가 체질과 영양 상태를 파악하는 데 참고해요.",
    inputs: [
      { key: "height", label: "키", placeholder: "170", unit: "cm", type: "number" },
      { key: "weight", label: "몸무게", placeholder: "65", unit: "kg", type: "number" },
    ],
  },
  {
    id: "birth_year",
    type: "input_row",
    label: "질문 3",
    title: "출생연도를<br/>알려주세요",
    desc: "나이에 따라 필요한 영양소가 달라요.",
    inputs: [
      { key: "year", label: "출생연도", placeholder: "예: 1975", unit: "년생", type: "number" },
    ],
  },
  {
    id: "duration",
    type: "single",
    label: "질문 4",
    title: "이 증상이<br/>얼마나 되었나요?",
    desc: "가장 오래된 증상 기준으로 선택해주세요.",
    options: ["최근 1개월 이내", "1~3개월", "3~6개월", "6개월~1년", "1년 이상", "잘 모르겠어요"],
  },
  {
    id: "severity",
    type: "slider",
    label: "질문 5",
    title: "일상생활에<br/>얼마나 불편한가요?",
    desc: "1은 거의 괜찮음, 10은 일상이 힘든 수준이에요.",
    min: 1,
    max: 10,
    value: 5,
    leftLabel: "1 거의 괜찮음",
    rightLabel: "10 매우 힘듦",
  },
  {
    id: "hospital",
    type: "single",
    label: "질문 6",
    title: "이 증상으로 병원에<br/>가보신 적 있나요?",
    options: [
      "네, 이상 없다고 했어요",
      "네, 약을 처방받았지만 효과가 없었어요",
      "네, 현재 관리 중이에요",
      "아니요, 안 가봤어요",
    ],
  },
  {
    id: "water_amount",
    type: "single",
    label: "질문 7",
    title: "하루에 물을<br/>얼마나 마시나요?",
    desc: "커피·차 제외, 순수한 물 기준이에요.",
    options: [
      "500mL 이하 (컵 2잔 이하)",
      "500~1,000mL (컵 2~4잔)",
      "1,000~1,500mL (컵 4~6잔)",
      "1,500~2,000mL (컵 6~8잔)",
      "2,000mL 이상 (컵 8잔 이상)",
    ],
  },
  {
    id: "water_temp",
    type: "single",
    label: "질문 8",
    title: "주로 어떤 물을<br/>마시나요?",
    options: ["따뜻한 물", "미지근한 물", "상온 정수", "냉수·얼음물", "그때그때 달라요"],
  },
  {
    id: "stool_freq",
    type: "single",
    label: "질문 9",
    title: "배변은<br/>얼마나 자주 하시나요?",
    options: [
      "하루 2회 이상",
      "하루 1회",
      "2~3일에 1회",
      "4~5일에 1회",
      "일주일에 1회 이하",
      "불규칙해요",
    ],
  },
  {
    id: "stool_type",
    type: "bristol",
    label: "질문 10",
    title: "대변 형태가<br/>어떤 편인가요?",
    desc: "가장 가까운 것을 선택해주세요.",
    bristolOptions: [
      { label: "토끼똥처럼 딱딱한 덩어리", desc: "심한 변비" },
      { label: "덩어리가 뭉쳐진 소시지", desc: "약간의 변비" },
      { label: "갈라진 소시지 형태", desc: "정상" },
      { label: "부드러운 바나나 형태", desc: "가장 이상적" },
      { label: "부드러운 덩어리", desc: "약간의 설사" },
      { label: "물처럼 흐름", desc: "설사" },
    ],
  },
  {
    id: "sleep_hours",
    type: "single",
    label: "질문 11",
    title: "하루 평균<br/>몇 시간 주무시나요?",
    options: ["5시간 이하", "5~6시간", "6~7시간", "7~8시간", "8시간 이상"],
  },
  {
    id: "sleep_quality",
    type: "single",
    label: "질문 12",
    title: "자고 일어났을 때<br/>어떤 느낌인가요?",
    options: ["개운하고 상쾌해요", "그냥 그래요", "자도 자도 피곤해요", "더 피곤한 느낌이에요"],
  },
  {
    id: "meal_pattern",
    type: "multi",
    label: "질문 13",
    title: "평소 식사 패턴은<br/>어떤가요?",
    desc: "해당하는 것을 모두 선택해주세요.",
    options: [
      "하루 3끼 규칙적으로 먹어요",
      "아침을 자주 거릅니다",
      "야식을 자주 먹어요",
      "배달·외식이 잦아요",
      "하루 1번 이상 간식을 먹어요",
      "채소·과일을 잘 안 먹어요",
      "불규칙하게 먹어요",
    ],
  },
  {
    id: "meal_amount",
    type: "single",
    label: "질문 14",
    title: "평소 식사량은<br/>어느 정도인가요?",
    options: [
      "식욕이 넘쳐서 끊임없이 잘 먹어요",
      "적당히 먹어요 (공기밥 1그릇)",
      "입맛이 없는 편이에요",
      "잘 못 먹어요 (공기밥 반그릇 이하)",
    ],
  },
  {
    id: "temperature",
    type: "multi",
    label: "질문 15",
    title: "체질적으로<br/>어떤 편인가요?",
    desc: "해당하는 것을 모두 선택해주세요.",
    options: [
      "추위를 많이 타요", "더위를 많이 타요", "손발이 차요",
      "추웠다 더웠다 해요", "추위보다 더위가 좋아요", "더위보다 추위가 좋아요",
    ],
  },
  {
    id: "alcohol",
    type: "single",
    label: "질문 16",
    title: "음주는<br/>얼마나 하시나요?",
    options: ["안 함", "한 달에 1~2번", "일주일에 1~2회", "일주일에 3회 이상"],
  },
  {
    id: "caffeine",
    type: "single",
    label: "질문 17",
    title: "하루에 카페인을<br/>얼마나 마시나요?",
    desc: "커피·녹차·에너지 음료 포함이에요.",
    options: ["안 마심", "하루 1~2잔", "하루 3잔 이상"],
  },
  {
    id: "smoking",
    type: "single",
    label: "질문 18",
    title: "흡연 여부를<br/>알려주세요",
    options: ["비흡연", "과거 흡연", "현재 흡연"],
  },
  {
    id: "exercise",
    type: "single",
    label: "질문 19",
    title: "일주일에 운동을<br/>얼마나 하시나요?",
    desc: "가벼운 산책도 포함해주세요.",
    options: ["안 함", "주 1~2회", "주 3회 이상"],
  },
  {
    id: "exercise_type",
    type: "textarea",
    label: "질문 20",
    title: "주로 어떤 운동을<br/>하시나요?",
    desc: "안 하시면 비워두셔도 괜찮아요.",
    placeholder: "예: 걷기, 헬스, 요가",
    minChars: 0,
  },
  {
    id: "supplements",
    type: "multi",
    label: "질문 21",
    title: "현재 복용 중인<br/>영양제나 약이 있나요?",
    desc: "해당하는 것을 모두 선택해주세요.",
    options: [
      "종합비타민", "유산균", "비타민D", "오메가3", "마그네슘",
      "철분", "기타 영양제", "병원 처방약 복용 중", "아무것도 안 먹고 있어요",
    ],
  },

  // ── 증상별 심화 질문 ──
  {
    id: "digest_detail",
    type: "multi",
    label: "소화장애 심화",
    title: "소화 관련 증상을<br/>좀 더 알려주세요",
    desc: "해당하는 것을 모두 선택해주세요.",
    sectionLabel: "소화장애 심화 질문",
    condition: (a) => ((a.symptoms as string[]) || []).includes("소화장애"),
    options: [
      "명치가 답답하다", "위통·복통이 자주 있다", "속이 쓰리다",
      "트림이 자주 나온다", "아랫배에 가스가 많이 찬다", "자주 체한다",
      "구역질이 난다", "입냄새가 많이 난다",
      "신물이 나고 목에 뭐가 걸린 느낌", "입이 마른다",
    ],
  },
  {
    id: "digest_trigger",
    type: "multi",
    label: "소화장애 심화",
    title: "먹고 나면 특히<br/>불편한 것이 있나요?",
    condition: (a) => ((a.symptoms as string[]) || []).includes("소화장애"),
    options: [
      "찬 음식·찬물", "매운 음식", "기름진 음식", "밀가루 음식",
      "유제품 (우유·치즈)", "카페인 (커피·차)", "딱히 없어요",
    ],
  },
  {
    id: "sleep_detail",
    type: "multi",
    label: "불면 심화",
    title: "수면 관련 증상을<br/>좀 더 알려주세요",
    desc: "해당하는 것을 모두 선택해주세요.",
    sectionLabel: "불면 심화 질문",
    condition: (a) => ((a.symptoms as string[]) || []).some((s) => s.includes("불면") || s.includes("수면")),
    options: [
      "잠들기가 어려워요", "잠은 잘 드는데 오래 못 자요", "자다가 자주 깨요",
      "꿈이 너무 많아요", "악몽을 자주 꿔요", "자도 자도 피곤해요",
    ],
  },
  {
    id: "menstrual_status",
    type: "single",
    label: "여성 건강",
    title: "현재 생리 상태를<br/>알려주세요",
    sectionLabel: "여성 건강 질문",
    condition: (a) =>
      a.gender === "여성" || ((a.symptoms as string[]) || []).some((s) => s.includes("생리통") || s.includes("여성건강")),
    options: ["정상적으로 생리 중", "초경 전", "폐경 후", "임신·수유 중"],
  },
  {
    id: "menstrual_detail",
    type: "multi",
    label: "여성 건강",
    title: "생리 관련 증상을<br/>알려주세요",
    desc: "해당하는 것을 모두 선택해주세요.",
    condition: (a) => a.menstrual_status === "정상적으로 생리 중",
    options: [
      "생리통이 심하다", "생리양이 많다", "생리양이 적다",
      "생리 주기가 불규칙하다", "생리혈이 덩어리진다", "생리 전 예민하고 붓는다 (PMS)",
    ],
  },
  {
    id: "rhinitis_detail",
    type: "multi",
    label: "비염 심화",
    title: "코 관련 증상을<br/>좀 더 알려주세요",
    sectionLabel: "비염 심화 질문",
    condition: (a) => ((a.symptoms as string[]) || []).some((s) => s.includes("비염") || s.includes("알레르기")),
    options: [
      "코가 늘 막혀 있다", "맑은 콧물이 많이 흐른다", "코딱지가 많다",
      "코가 건조하다", "재채기가 자주 나온다", "모공이 크고 블랙헤드가 많다",
    ],
  },
  {
    id: "atopy_location",
    type: "multi",
    label: "아토피 심화",
    title: "아토피 증상이 주로<br/>어디에 나타나나요?",
    sectionLabel: "아토피 심화 질문",
    condition: (a) => ((a.symptoms as string[]) || []).some((s) => s.includes("아토피") || s.includes("피부")),
    options: [
      "얼굴", "목", "팔 안쪽", "다리 뒤쪽", "손·손가락", "등·가슴", "전신",
    ],
  },
  {
    id: "mental_detail",
    type: "multi",
    label: "우울·불안 심화",
    title: "마음 상태를<br/>좀 더 알려주세요",
    sectionLabel: "우울·불안 심화 질문",
    condition: (a) => ((a.symptoms as string[]) || []).some((s) => s.includes("우울") || s.includes("불안") || s.includes("스트레스")),
    options: [
      "이유 없이 기분이 가라앉아요", "의욕이 없고 무기력해요", "불안하고 초조해요",
      "짜증이 잘 나요", "집중력이 떨어져요", "가슴이 답답하거나 두근거려요",
    ],
  },
  {
    id: "headache_detail",
    type: "multi",
    label: "두통 심화",
    title: "두통 양상을<br/>좀 더 알려주세요",
    sectionLabel: "두통 심화 질문",
    condition: (a) => ((a.symptoms as string[]) || []).some((s) => s.includes("두통")),
    options: [
      "머리 전체가 무겁게 아파요", "한쪽만 욱신거려요 (편두통)", "뒷머리·목이 뻣뻣해요",
      "눈 뒤쪽이 아파요", "생리 전후로 심해져요", "스트레스 받으면 심해져요",
    ],
  },

  // ── 마무리 ──
  {
    id: "free_text",
    type: "textarea",
    label: "거의 다 왔어요",
    title: "약사에게 더 알려주고<br/>싶은 이야기가 있나요?",
    desc: "증상이 시작된 계기, 생활 패턴, 스트레스 등 자유롭게 적어주세요. 자세할수록 정확한 분석이 가능해요.",
    placeholder:
      "예) 작년부터 야근이 잦아지면서 소화가 안 되기 시작했어요. 아침에 일어나기가 너무 힘들고, 커피를 하루 3잔 이상 마시게 됐어요...",
    minChars: 50,
  },
  {
    id: "budget",
    type: "single",
    label: "마지막 질문",
    title: "월 건강관리에<br/>투자할 수 있는 금액대는?",
    desc: "약사가 맞춤 상담 시 참고해요. 부담 없이 선택해주세요.",
    options: ["3만원 이하", "3-5만원", "5-10만원", "10-20만원", "20-30만원", "30만원 이상", "아직 잘 모르겠어요"],
  },
];
