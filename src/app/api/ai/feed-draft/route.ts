import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

type Mode = "case" | "story";

interface DraftRequest {
  mode: Mode;
  symptom?: string;      // 증상·상황
  before?: string;       // 개선 전 상태
  after?: string;        // 개선 후·어떻게 좋아졌는지
  duration?: string;     // 개선까지 걸린 기간(라벨)
}

const CATEGORY_KEYS = [
  "digestion", "sleep", "fatigue", "skin", "pain",
  "women", "circulation", "growth", "etc",
] as const;

const CATEGORY_GUIDE = `분류 키와 의미:
- digestion: 소화·장
- sleep: 수면·마음
- fatigue: 피로·기력
- skin: 피부
- pain: 통증·염증
- women: 여성건강
- circulation: 체중관리·순환
- growth: 소아·성장
- etc: 기타`;

const RULES = `너는 약사가 작성하는 건강 개선 경험 글의 초안을 돕는 보조자다. 다음 규칙을 반드시 지켜라.
1. 의료광고법상 금지·과장 표현을 절대 쓰지 마라: "치료", "완치", "100%", "부작용 없음", "효과 보장", "최고", "유일" 등.
2. 특정 제품명·브랜드·성분명을 본문에 넣지 마라. 증상과 변화 중심으로 서술하라.
3. 단정·보장 대신 "도움이 되었다", "편해졌다고 하셨다" 같은 경험 기반 표현을 써라.
4. 과장 없이 담백하고 신뢰감 있는 약사의 톤으로 써라.
5. 본문 전체 길이는 한국어 300~500자 범위로 맞춰라.
6. 면책 문구는 넣지 마라(별도 안내가 있다).
7. 약사가 입력한 내용에 과장·금지 표현이 있으면 warnings 배열로 알려라(고치라는 제안). 없으면 빈 배열.
8. categories는 아래 분류 키 중 글 내용에 맞는 것을 최대 3개 제안하라(제안일 뿐 최종 선택은 약사가 한다).`;

function buildPrompt(body: DraftRequest): string {
  const brief = [
    body.symptom ? `증상·상황: ${body.symptom}` : "",
    body.before ? `개선 전 상태: ${body.before}` : "",
    body.after ? `개선 후·변화: ${body.after}` : "",
    body.duration ? `개선까지 걸린 기간: ${body.duration}` : "",
  ].filter(Boolean).join("\n");

  if (body.mode === "case") {
    return `${RULES}

${CATEGORY_GUIDE}

아래는 약사가 입력한 환자 개선 사례 정보다.
${brief}

이 정보를 바탕으로 환자 개선 사례 글을 작성하라.
반드시 아래 JSON 형식으로만 응답하라. 코드블럭(\`\`\`)이나 다른 설명 없이 JSON만 출력하라.
{
  "title": "사례 제목 (30자 이내)",
  "beforeDesc": "상담 전 상태 서술",
  "afterDesc": "개선 결과 서술",
  "categories": ["분류키", ...],
  "warnings": ["약사 입력의 과장/금지 표현 지적", ...]
}
beforeDesc와 afterDesc를 합친 길이가 300~500자가 되게 하라.`;
  }

  return `${RULES}

${CATEGORY_GUIDE}

아래는 약사가 입력한 본인 또는 가족의 건강 경험 정보다.
${brief}

이 정보를 바탕으로 약사의 경험 이야기 글을 작성하라.
반드시 아래 JSON 형식으로만 응답하라. 코드블럭(\`\`\`)이나 다른 설명 없이 JSON만 출력하라.
{
  "title": "글 제목 (30자 이내)",
  "body": "이야기 본문 (300~500자)",
  "changes": [{ "before": "개선 전", "after": "개선 후" }],
  "categories": ["분류키", ...],
  "warnings": ["약사 입력의 과장/금지 표현 지적", ...]
}
changes는 1~3개의 전/후 변화 쌍으로 만들어라.`;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI 기능이 설정되지 않았습니다." }, { status: 500 });
    }

    // 1) 로그인 검증
    const supa = await createSupabaseServer();
    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    // 2) 약사 검증
    const { data: prof } = await supa
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<{ role: string }>();
    if (prof?.role !== "pharmacist") {
      return NextResponse.json({ error: "약사만 사용할 수 있습니다." }, { status: 403 });
    }

    // 3) 입력 파싱
    const body = (await req.json()) as DraftRequest;
    if (body.mode !== "case" && body.mode !== "story") {
      return NextResponse.json({ error: "mode가 올바르지 않습니다." }, { status: 400 });
    }
    if (!body.symptom && !body.before && !body.after) {
      return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });
    }

    // 4) Haiku 호출
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: buildPrompt(body) }],
    });

    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();

    // 5) JSON 파싱 (혹시 모를 코드블럭 제거)
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "초안 생성에 실패했습니다. 다시 시도해주세요." }, { status: 502 });
    }

    // categories 화이트리스트 필터
    const rawCats = Array.isArray(parsed.categories) ? parsed.categories : [];
    const categories = rawCats
      .filter((c): c is string => typeof c === "string")
      .filter((c) => (CATEGORY_KEYS as readonly string[]).includes(c))
      .slice(0, 3);

    const warnings = Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((w): w is string => typeof w === "string")
      : [];

    return NextResponse.json({ ...parsed, categories, warnings });
  } catch (e) {
    console.error("[feed-draft] error:", e);
    return NextResponse.json({ error: "초안 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
