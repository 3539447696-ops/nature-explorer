import type { ChatMessage, AIContext, Species, ElevationBand } from '../types';
import { matchOfflineKnowledge } from '../constants';

/* AI 自然向导服务。
 * 优先使用环境变量配置的 OpenAI 兼容接口；未配置或失败时降级到内置离线问答。 */

const BASE_URL = import.meta.env.VITE_AI_BASE_URL || '';
const API_KEY = import.meta.env.VITE_AI_API_KEY || '';
const MODEL = import.meta.env.VITE_AI_MODEL || 'gpt-4o-mini';

export function aiConfigured(): boolean {
  return !!(BASE_URL && API_KEY && MODEL);
}

function buildSystemPrompt(ctx?: AIContext): string {
  let p = `你是「自然向导」，一位友好、博学且充满热情的自然科普助手，专注于动植物、鸟类、生态与自然旅行知识。
请遵循以下原则：
1. 用亲切、生动、易懂的语言回答，适当使用 emoji 让内容更活泼。
2. 回答要准确、有科学依据，但避免过于学术化的术语堆砌。
3. 回答尽量简洁（通常 2-4 句话），除非用户要求详细展开。
4. 如果用户问的是当前正在查看的某个物种，结合它的特点回答。
5. 始终使用简体中文回答。`;
  if (ctx?.currentSpecies) {
    const s = ctx.currentSpecies;
    p += `\n\n当前用户正在查看的物种是：${s.cn_name}（学名 ${s.sci_name}，类别：${s.taxon}）。`;
  }
  if (ctx?.location) p += `\n用户当前所在的大致位置是：${ctx.location}。`;
  return p;
}

/** 发送消息，返回 AI 回复 */
export async function aiChat(
  history: ChatMessage[],
  userMessage: string,
  ctx?: AIContext,
): Promise<string> {
  if (aiConfigured()) {
    try {
      return await callRealAPI(history, userMessage, ctx);
    } catch (err) {
      console.warn('[AI] 真实接口失败，降级离线:', (err as Error).message);
      return offlineReply(userMessage) + '\n\n（提示：AI 接口调用失败，以上为内置回答。）';
    }
  }
  return offlineReply(userMessage);
}

async function callRealAPI(history: ChatMessage[], userMessage: string, ctx?: AIContext): Promise<string> {
  const base = BASE_URL.replace(/\/+$/, '');
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(ctx) },
    ...history.slice(-8),
    { role: 'user', content: userMessage },
  ];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    signal: controller.signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.7, max_tokens: 600 }),
  });
  clearTimeout(timeout);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = await res.json();
  const reply = json.choices?.[0]?.message?.content;
  if (!reply) throw new Error('返回内容为空');
  return reply.trim();
}

function offlineReply(userMessage: string): string {
  const matched = matchOfflineKnowledge(userMessage);
  if (matched) return matched;
  const short = userMessage.slice(0, 20) + (userMessage.length > 20 ? '…' : '');
  return `这是个好问题！🌿 我在离线模式下的知识有限，暂时无法详细回答“${short}”。\n\n你可以试试问我：鸟类为什么迁徙？蒲公英种子怎么飞散？蜜蜂如何传粉？如需完整智能问答，可在环境变量中配置 AI 接口。`;
}

/** 根据当前物种生成推荐提问 */
export function buildSuggestions(currentSpecies?: Species | null): string[] {
  if (currentSpecies) {
    return [
      `${currentSpecies.cn_name}有什么特点？`,
      `${currentSpecies.cn_name}吃什么？`,
      `怎么分辨${currentSpecies.cn_name}？`,
      '它对生态有什么作用？',
    ];
  }
  return ['鸟类为什么会迁徙？', '蒲公英种子怎么飞散？', '蜜蜂是怎么传粉的？', '我该怎么保护身边的自然？'];
}

/* ---------- AI 旅行攻略文案生成 ----------
 * 核心原则："AI 不编数据，只把真实数据讲成有温度的文案"——
 * 所有物种名字、观测次数、海拔分层都是真实数据，AI 只负责组织语言。 */

export interface TravelNarrativeInput {
  destination: string;
  month: number;
  days?: number;
  isMountainous: boolean;
  elevationBands: ElevationBand[];
  speciesHighlights: Species[];
  totalObservations: number;
  climateZone: string;
}

export interface TravelNarrativeResult {
  narrative: string;
  bestTimeHint: string;
  equipmentTips: string;
  routeHint: string;
  speciesTips: Record<string, string>; // 物种中文名 → 一句实用的观察要点
}

export async function generateTravelNarrative(input: TravelNarrativeInput): Promise<TravelNarrativeResult> {
  if (!aiConfigured()) return offlineTravelNarrative(input);
  try {
    return await callTravelNarrativeAPI(input);
  } catch (err) {
    console.warn('[AI] 攻略文案生成失败，使用离线兜底:', (err as Error).message);
    return offlineTravelNarrative(input);
  }
}

async function callTravelNarrativeAPI(input: TravelNarrativeInput): Promise<TravelNarrativeResult> {
  const dataDesc = input.isMountainous
    ? input.elevationBands
        .map((b) => `${b.label}(海拔${b.minElevation}-${b.maxElevation}m，${b.observationCount}次观测): ${b.species.map((s) => s.cn_name).join('、')}`)
        .join('；')
    : `代表性物种: ${input.speciesHighlights.map((s) => `${s.cn_name}(观测${s.count || 0}次)`).join('、')}`;

  // 需要 AI 逐一生成"观察要点"的重点物种（最多取 8 个，避免 prompt 过长/超时）
  const tipTargets = (
    input.isMountainous
      ? input.elevationBands.flatMap((b) => b.species)
      : input.speciesHighlights
  ).slice(0, 8).map((s) => s.cn_name);

  const prompt = `你是"自然探索家"App 的 AI 自然向导，兼具博物学家的专业度和亲切的表达方式。
请根据以下真实数据（来自 iNaturalist 公民科学社区），为用户生成一份 ${input.month} 月去"${input.destination}"的自然观察攻略。

真实数据（必须基于这些数据，不要编造未提及的物种）：
- 目的地：${input.destination}，气候带：${input.climateZone}
- 历史 ${input.month} 月真实观测记录：共 ${input.totalObservations} 次${input.days ? `，用户预计游玩 ${input.days} 天` : ''}
- ${dataDesc}

请只输出一个 JSON 对象（不要 markdown 代码块，不要任何多余文字），字段如下：
{
  "narrative": "150字以内、有温度、吸引人的攻略导语，需提及至少2-3个具体物种名字",
  "bestTimeHint": "最佳观察时段建议，30字以内",
  "equipmentTips": "结合当地气候/地形的装备建议，40字以内",
  "routeHint": "简易路线建议，40字以内",
  "speciesTips": {
    "物种中文名1": "一句15-25字的实用观察要点（识别特征/活动习性/是否需要保持距离或有无毒性风险等，挑最有用的一点说）",
    "物种中文名2": "..."
  }
}
speciesTips 请针对这些物种逐一生成，不要遗漏，也不要编造列表外的物种：${tipTargets.join('、')}`;

  const base = BASE_URL.replace(/\/+$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    signal: controller.signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 900,
    }),
  });
  clearTimeout(timeout);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = await res.json();
  const text = (json.choices?.[0]?.message?.content || '').trim();
  const cleaned = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  const fallback = offlineTravelNarrative(input);
  return {
    narrative: parsed.narrative || fallback.narrative,
    bestTimeHint: parsed.bestTimeHint || fallback.bestTimeHint,
    equipmentTips: parsed.equipmentTips || fallback.equipmentTips,
    routeHint: parsed.routeHint || fallback.routeHint,
    speciesTips: (parsed.speciesTips && typeof parsed.speciesTips === 'object') ? parsed.speciesTips : fallback.speciesTips,
  };
}

// 按大类的通用观察要点兜底（AI 未配置/失败时使用，仍是有实际参考价值的科普知识，不是空话）
const GENERIC_TIPS_BY_TAXON: Record<string, string> = {
  Aves: '清晨或黄昏最活跃，保持安静、勿用闪光灯，远距离用望远镜观察即可',
  Plantae: '注意识别叶形与花期特征，部分植物可能有毒，不要随意采摘或触碰汁液',
  Mammalia: '性情警觉，多在晨昏活动，保持至少10米以上距离，切勿投喂',
  Insecta: '细看复眼与翅纹是识别关键，蜂类/毒蛾幼虫等勿用手直接触碰',
  Reptilia: '体温随环境变化，晴天石缝/枯木附近较易发现，勿伸手抓取',
  Amphibia: '雨后或近水处活跃，皮肤敏感，观察后请勿用手接触',
  Actinopterygii: '水质清澈处更易观察到，静立不惊扰水面为佳',
  Fungi: '注意菌盖与菌褶形态，切勿采食未确认可食用的野生菌类',
};

/** AI 未配置或调用失败时的离线兜底文案（仍然基于真实数据组织语言，不是假数据） */
function offlineTravelNarrative(input: TravelNarrativeInput): TravelNarrativeResult {
  const allSpecies = input.isMountainous
    ? input.elevationBands.flatMap((b) => b.species)
    : input.speciesHighlights;
  const topNames = allSpecies.slice(0, 3).map((s) => s.cn_name);
  const namesText = topNames.length ? `，比如${topNames.join('、')}` : '';

  const speciesTips: Record<string, string> = {};
  allSpecies.slice(0, 8).forEach((s) => {
    speciesTips[s.cn_name] = GENERIC_TIPS_BY_TAXON[s.taxon] || '观察时保持适当距离，不打扰、不投喂、不采摘';
  });

  return {
    narrative: `${input.month}月的${input.destination}，历史上已有${input.totalObservations}次真实观测记录${namesText}。${input.climateZone}的气候条件下，这里的自然生态值得细细探索——带上好奇心出发吧！`,
    bestTimeHint: '清晨6-8点或黄昏5-7点，是野生动物活动最活跃的时段',
    equipmentTips: `建议携带望远镜、相机和适合${input.climateZone}气候的衣物`,
    routeHint: input.isMountainous ? '建议从山脚开始，循序渐进向上探索各海拔层' : '建议在目的地周边多个观察点分散探索',
    speciesTips,
  };
}
