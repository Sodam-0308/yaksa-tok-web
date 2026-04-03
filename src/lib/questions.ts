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
  emoji: string;
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
      { text: "만성피로", emoji: "😴" },
      { text: "소화장애", emoji: "🫠" },
      { text: "불면", emoji: "🌙" },
      { text: "비염", emoji: "🤧" },
      { text: "두통", emoji: "🤕" },
      { text: "생리통", emoji: "🩸" },
      { text: "여드름", emoji: "🧴" },
      { text: "아토피", emoji: "🫲" },
      { text: "우울·불안", emoji: "😶‍🌫️" },
      { text: "안구건조", emoji: "👁️" },
      { text: "수족냉증", emoji: "🥶" },
      { text: "붓기", emoji: "🫧" },
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
    id: "duration",
    type: "single",
    label: "질문 3",
    title: "이 증상이<br/>얼마나 되었나요?",
    desc: "가장 오래된 증상 기준으로 선택해주세요.",
    options: ["최근 1개월 이내", "1~3개월", "3~6개월", "6개월~1년", "1년 이상", "잘 모르겠어요"],
  },
  {
    id: "severity",
    type: "slider",
    label: "질문 4",
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
    label: "질문 5",
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
    label: "질문 6",
    title: "하루에 물을<br/>얼마나 마시나요?",
    desc: "커피·차 제외, 순수한 물 기준이에요.",
    options: [
      { text: "500mL 이하 (컵 2잔 이하)", emoji: "🥤" },
      { text: "500~1,000mL (컵 2~4잔)", emoji: "🥤" },
      { text: "1,000~1,500mL (컵 4~6잔)", emoji: "💧" },
      { text: "1,500~2,000mL (컵 6~8잔)", emoji: "💧" },
      { text: "2,000mL 이상 (컵 8잔 이상)", emoji: "🌊" },
    ],
  },
  {
    id: "water_temp",
    type: "single",
    label: "질문 7",
    title: "주로 어떤 물을<br/>마시나요?",
    options: [
      { text: "따뜻한 물", emoji: "♨️" },
      { text: "미지근한 물", emoji: "🫗" },
      { text: "상온 정수", emoji: "💧" },
      { text: "냉수·얼음물", emoji: "🧊" },
      { text: "그때그때 달라요", emoji: "🔄" },
    ],
  },
  {
    id: "stool_freq",
    type: "single",
    label: "질문 8",
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
    label: "질문 9",
    title: "대변 형태가<br/>어떤 편인가요?",
    desc: "가장 가까운 것을 선택해주세요.",
    bristolOptions: [
      { emoji: "🫘", label: "토끼똥처럼 딱딱한 덩어리", desc: "심한 변비" },
      { emoji: "🥜", label: "덩어리가 뭉쳐진 소시지", desc: "약간의 변비" },
      { emoji: "🌽", label: "갈라진 소시지 형태", desc: "정상" },
      { emoji: "🍌", label: "부드러운 바나나 형태", desc: "가장 이상적" },
      { emoji: "☁️", label: "부드러운 덩어리", desc: "약간의 설사" },
      { emoji: "💧", label: "물처럼 흐름", desc: "설사" },
    ],
  },
  {
    id: "sleep_hours",
    type: "single",
    label: "질문 10",
    title: "하루 평균<br/>몇 시간 주무시나요?",
    options: ["5시간 이하", "5~6시간", "6~7시간", "7~8시간", "8시간 이상"],
  },
  {
    id: "sleep_quality",
    type: "single",
    label: "질문 11",
    title: "자고 일어났을 때<br/>어떤 느낌인가요?",
    options: [
      { text: "개운하고 상쾌해요", emoji: "😊" },
      { text: "그냥 그래요", emoji: "😐" },
      { text: "자도 자도 피곤해요", emoji: "😩" },
      { text: "더 피곤한 느낌이에요", emoji: "😵" },
    ],
  },
  {
    id: "meal_pattern",
    type: "multi",
    label: "질문 12",
    title: "평소 식사 패턴은<br/>어떤가요?",
    desc: "해당하는 것을 모두 선택해주세요.",
    options: [
      "하루 3끼 규칙적으로 먹어요",
      "아침을 자주 거릅니다",
      "야식을 자주 먹어요",
      "배달·외식이 잦아요",
      "채소·과일을 잘 안 먹어요",
      "불규칙하게 먹어요",
    ],
  },
  {
    id: "meal_amount",
    type: "single",
    label: "질문 13",
    title: "평소 식사량은<br/>어느 정도인가요?",
    options: [
      { text: "식욕이 넘쳐서 끊임없이 잘 먹어요", emoji: "🍚🍚" },
      { text: "적당히 먹어요 (공기밥 1그릇)", emoji: "🍚" },
      { text: "입맛이 없는 편이에요", emoji: "😕" },
      { text: "잘 못 먹어요 (공기밥 반그릇 이하)", emoji: "🥢" },
    ],
  },
  {
    id: "temperature",
    type: "multi",
    label: "질문 14",
    title: "체질적으로<br/>어떤 편인가요?",
    desc: "해당하는 것을 모두 선택해주세요.",
    options: [
      { text: "추위를 많이 타요", emoji: "🥶" },
      { text: "더위를 많이 타요", emoji: "🥵" },
      { text: "손발이 차요", emoji: "🧊" },
      { text: "추웠다 더웠다 해요", emoji: "🔄" },
      { text: "추위보다 더위가 좋아요", emoji: "☀️" },
      { text: "더위보다 추위가 좋아요", emoji: "❄️" },
    ],
  },
  {
    id: "exercise",
    type: "single",
    label: "질문 15",
    title: "일주일에 운동을<br/>얼마나 하시나요?",
    desc: "가벼운 산책도 포함해주세요.",
    options: ["거의 안 해요", "주 1~2회", "주 3~4회", "주 5회 이상"],
  },
  {
    id: "supplements",
    type: "multi",
    label: "질문 16",
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
    sectionLabel: "🫠 소화장애 심화 질문",
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
      { text: "찬 음식·찬물", emoji: "🧊" },
      { text: "매운 음식", emoji: "🌶️" },
      { text: "기름진 음식", emoji: "🍟" },
      { text: "밀가루 음식", emoji: "🍞" },
      { text: "유제품 (우유·치즈)", emoji: "🧀" },
      { text: "카페인 (커피·차)", emoji: "☕" },
      { text: "딱히 없어요", emoji: "✅" },
    ],
  },
  {
    id: "sleep_detail",
    type: "multi",
    label: "불면 심화",
    title: "수면 관련 증상을<br/>좀 더 알려주세요",
    desc: "해당하는 것을 모두 선택해주세요.",
    sectionLabel: "🌙 불면 심화 질문",
    condition: (a) => ((a.symptoms as string[]) || []).includes("불면"),
    options: [
      { text: "잠들기가 어려워요", emoji: "🛏️" },
      { text: "잠은 잘 드는데 오래 못 자요", emoji: "⏰" },
      { text: "자다가 자주 깨요", emoji: "😳" },
      { text: "꿈이 너무 많아요", emoji: "💭" },
      { text: "악몽을 자주 꿔요", emoji: "😱" },
      { text: "자도 자도 피곤해요", emoji: "😵‍💫" },
    ],
  },
  {
    id: "menstrual_status",
    type: "single",
    label: "여성 건강",
    title: "현재 생리 상태를<br/>알려주세요",
    sectionLabel: "🩸 여성 건강 질문",
    condition: (a) =>
      a.gender === "여성" || ((a.symptoms as string[]) || []).includes("생리통"),
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
      { text: "생리통이 심하다", emoji: "😣" },
      { text: "생리양이 많다", emoji: "🩸" },
      { text: "생리양이 적다", emoji: "💧" },
      { text: "생리 주기가 불규칙하다", emoji: "📅" },
      { text: "생리혈이 덩어리진다", emoji: "🔴" },
      { text: "생리 전 예민하고 붓는다 (PMS)", emoji: "😤" },
    ],
  },
  {
    id: "rhinitis_detail",
    type: "multi",
    label: "비염 심화",
    title: "코 관련 증상을<br/>좀 더 알려주세요",
    sectionLabel: "🤧 비염 심화 질문",
    condition: (a) => ((a.symptoms as string[]) || []).includes("비염"),
    options: [
      { text: "코가 늘 막혀 있다", emoji: "😤" },
      { text: "맑은 콧물이 많이 흐른다", emoji: "💧" },
      { text: "코딱지가 많다", emoji: "👃" },
      { text: "코가 건조하다", emoji: "🏜️" },
      { text: "재채기가 자주 나온다", emoji: "🤧" },
      { text: "모공이 크고 블랙헤드가 많다", emoji: "🔍" },
    ],
  },
  {
    id: "atopy_location",
    type: "multi",
    label: "아토피 심화",
    title: "아토피 증상이 주로<br/>어디에 나타나나요?",
    sectionLabel: "🫲 아토피 심화 질문",
    condition: (a) => ((a.symptoms as string[]) || []).includes("아토피"),
    options: [
      { text: "얼굴", emoji: "😶" },
      { text: "목", emoji: "🧣" },
      { text: "팔 안쪽", emoji: "💪" },
      { text: "다리 뒤쪽", emoji: "🦵" },
      { text: "손·손가락", emoji: "🤚" },
      { text: "등·가슴", emoji: "👕" },
      { text: "전신", emoji: "🧍" },
    ],
  },
  {
    id: "mental_detail",
    type: "multi",
    label: "우울·불안 심화",
    title: "마음 상태를<br/>좀 더 알려주세요",
    sectionLabel: "😶‍🌫️ 우울·불안 심화 질문",
    condition: (a) => ((a.symptoms as string[]) || []).includes("우울·불안"),
    options: [
      { text: "이유 없이 기분이 가라앉아요", emoji: "😔" },
      { text: "의욕이 없고 무기력해요", emoji: "😶" },
      { text: "불안하고 초조해요", emoji: "😰" },
      { text: "짜증이 잘 나요", emoji: "😤" },
      { text: "집중력이 떨어져요", emoji: "🌀" },
      { text: "가슴이 답답하거나 두근거려요", emoji: "💓" },
    ],
  },
  {
    id: "headache_detail",
    type: "multi",
    label: "두통 심화",
    title: "두통 양상을<br/>좀 더 알려주세요",
    sectionLabel: "🤕 두통 심화 질문",
    condition: (a) => ((a.symptoms as string[]) || []).includes("두통"),
    options: [
      { text: "머리 전체가 무겁게 아파요", emoji: "😵" },
      { text: "한쪽만 욱신거려요 (편두통)", emoji: "⚡" },
      { text: "뒷머리·목이 뻣뻣해요", emoji: "🦴" },
      { text: "눈 뒤쪽이 아파요", emoji: "👁️" },
      { text: "생리 전후로 심해져요", emoji: "📅" },
      { text: "스트레스 받으면 심해져요", emoji: "😤" },
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
    options: ["3만원 이하", "3~5만원", "5~10만원", "10만원 이상", "아직 잘 모르겠어요"],
  },
  {
    id: "pharma_gender",
    type: "single",
    label: "마지막 질문",
    title: "선호하는<br/>약사 성별이 있나요?",
    options: ["여성 약사 선호", "남성 약사 선호", "상관없어요"],
  },
];
