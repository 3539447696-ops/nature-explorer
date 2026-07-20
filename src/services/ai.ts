import type { ChatMessage, AIContext, Species } from '../types';
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
