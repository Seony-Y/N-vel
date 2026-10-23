/*
 * 사용자가 채팅방마다 고를 수 있는 모델 목록.
 * 가격은 1M 토큰당 달러 (2026-10 기준). 바뀌면 여기만 수정하면 된다.
 * credits = 행동 1회에 차감할 크레딧. 1크레딧 = 판매가 $0.001, 원가의 약 2배 (근거: docs/PRICING.md)
 */

export interface ChatModel {
  id: string;
  label: string;
  description: string;
  inputPrice: number;
  outputPrice: number;
  credits: number;
  /** 안전 분류기 거절 시 서버 측 자동 재시도 지원 여부 */
  supportsFallback: boolean;
  /** 응답 길이 지침. 비싼 모델일수록 길고 섬세하게 (출력 토큰이 늘어 원가도 늘어난다) */
  length: { narrator: string; suspect: string };
}

export const CHAT_MODELS: ChatModel[] = [
  {
    id: "claude-haiku-5-5",
    label: "Haiku 5.5",
    description: "가장 빠르고 저렴함. 기본 모델",
    inputPrice: 0.1,
    outputPrice: 0.5,
    credits: 1,
    supportsFallback: false,
    length: {
      narrator: "4~6문장. 보이는 것과 분위기를 구체적으로, 찾은 단서는 내용을 빠짐없이",
      suspect: "2~4문장. 질문에 답하고 감정이나 태도를 한 번쯤 드러내기",
    },
  },
  {
    id: "claude-sonnet-5-5",
    label: "Sonnet 5.5",
    description: "품질과 비용의 균형",
    inputPrice: 2,
    outputPrice: 10,
    credits: 15,
    supportsFallback: true,
    length: {
      narrator: "6~9문장, 두세 문단. 소리·냄새·빛 같은 감각 묘사와 사물의 세부(흠집, 위치, 상태)까지",
      suspect: "3~6문장. 말투와 표정·몸짓 묘사를 곁들이고, 대답 속에 인물의 감정과 사정이 묻어나게",
    },
  },
  {
    id: "claude-opus-5-5",
    label: "Opus 5.5",
    description: "더 섬세한 연기와 긴 설정 이해",
    inputPrice: 4,
    outputPrice: 20,
    credits: 30,
    supportsFallback: true,
    length: {
      narrator: "8~12문장, 두세 문단. 소설처럼 장면을 펼쳐 감각·세부·긴장감을 살리고, 단서는 그 의미를 곱씹을 여지를 남기며",
      suspect: "4~8문장. 표정·몸짓·말끝의 변화까지 연기하고, 숨기는 것이 있다면 미묘한 망설임으로 드러나게",
    },
  },
  {
    id: "claude-fable-5-1",
    label: "Fable 5.1",
    description: "최고 성능. 비용이 가장 큼",
    inputPrice: 10,
    outputPrice: 50,
    credits: 75,
    supportsFallback: true,
    length: {
      narrator: "10~14문장, 세 문단 안팎. 한 편의 추리소설 장면처럼 공간·인물의 흔적·시간의 흐름을 풍부하게",
      suspect: "5~9문장. 인물의 과거와 감정이 배어나는 깊은 연기. 회상, 반문, 침묵 같은 리듬도 활용",
    },
  },
];

export const DEFAULT_CHAT_MODEL = process.env.CHAT_MODEL ?? "claude-haiku-5-5";

/*
 * 실제 원가 계산 (관리자 화면·내부 가격 기준용). 1M 토큰당 달러.
 * 선택 목록에 없는 모델도 거절 시 자동 재시도(fallback)로 쓰일 수 있어 함께 둔다.
 * 캐시 쓰기는 입력 가격의 1.25배, 캐시 읽기는 0.1배.
 */
const PRICES: Record<string, { input: number; output: number }> = {
  ...Object.fromEntries(CHAT_MODELS.map((m) => [m.id, { input: m.inputPrice, output: m.outputPrice }])),
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
};

interface UsageLike {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/** 이 응답의 원가 (백만분의 1달러). 모르는 모델은 Opus 가격으로 넉넉하게 잡는다 */
export function costMicros(model: string, u: UsageLike): number {
  const p = PRICES[model] ?? PRICES[model.replace(/-\d{8}$/, "")] ?? { input: 5, output: 25 };
  const dollars =
    (u.input_tokens * p.input + (u.cache_creation_input_tokens ?? 0) * p.input * 1.25 + (u.cache_read_input_tokens ?? 0) * p.input * 0.1 + u.output_tokens * p.output) / 1e6;
  return Math.round(dollars * 1e6);
}

export const formatUsd = (micros: number) => `$${(micros / 1e6).toFixed(micros < 1_000_000 ? 4 : 2)}`;

export function getChatModel(id: string | null | undefined): ChatModel {
  return (
    CHAT_MODELS.find((m) => m.id === id) ??
    CHAT_MODELS.find((m) => m.id === DEFAULT_CHAT_MODEL) ??
    CHAT_MODELS[0]
  );
}
