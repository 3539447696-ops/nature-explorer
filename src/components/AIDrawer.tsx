import { useEffect, useRef, useState } from 'react';
import { Drawer, Input, Button } from 'animal-island-ui';
import type { ChatMessage, Species, TravelPlan } from '../types';
import { aiChat, buildSuggestions } from '../services/ai';
import { generateTravelPlan } from '../services/travelPlan';
import { getTaxonMeta } from '../constants';

interface Props {
  open: boolean;
  onClose: () => void;
  currentSpecies: Species | null;
  location: string | null;
  centerLat: number | null;
  centerLng: number | null;
  onExploreDestination: (plan: TravelPlan) => void;
}

interface PlanTarget {
  name: string;
  lat: number;
  lng: number;
}

interface DisplayMsg {
  role: 'user' | 'bot';
  kind?: 'text' | 'plan-prompt' | 'plan-loading' | 'plan-result';
  content?: string;
  planTarget?: PlanTarget;
  planData?: TravelPlan;
}

/**
 * AI 自然向导抽屉。核心设计：AI 主动感知用户当前在探索的地点，
 * 主动引导生成一份自然观察攻略（内嵌在对话流里，不需要另开独立页面/Tab）——
 * 这是"AI 主动 Agent"而不是"被动问答工具"的关键差异化体现。
 */
export function AIDrawer({ open, onClose, currentSpecies, location, centerLat, centerLng, onExploreDestination }: Props) {
  const [messages, setMessages] = useState<DisplayMsg[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const historyRef = useRef<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const welcomedRef = useRef(false);
  const lastPlanPromptLocationRef = useRef<string | null>(null);

  // 打开时给欢迎语 + 主动感知当前地点，引导生成攻略
  useEffect(() => {
    if (!open) return;
    const canPrompt = !!location && centerLat != null && centerLng != null;

    if (!welcomedRef.current) {
      welcomedRef.current = true;
      const welcome = currentSpecies
        ? `你好呀！🦉 我是你的自然向导。看到你在关注「${currentSpecies.cn_name}」，有什么想了解的尽管问我～`
        : '你好呀！🦉 我是你的自然向导，专门解答关于动植物、鸟类和大自然的一切问题。今天想探索点什么呢？';
      const initial: DisplayMsg[] = [{ role: 'bot', kind: 'text', content: welcome }];
      if (!currentSpecies && canPrompt) {
        initial.push({
          role: 'bot',
          kind: 'plan-prompt',
          content: `✨ 想了解「${location}」的自然观察攻略吗？`,
          planTarget: { name: location!, lat: centerLat!, lng: centerLng! },
        });
        lastPlanPromptLocationRef.current = location;
      }
      setMessages(initial);
      return;
    }

    if (currentSpecies) {
      // 用户从新物种点进来，追加一句（物种问答优先，不打断为攻略引导）
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        const line = `我们来聊聊「${currentSpecies.cn_name}」吧！有什么想知道的？`;
        if (last && last.kind !== 'plan-prompt' && last.content === line) return prev;
        return [...prev, { role: 'bot', kind: 'text', content: line }];
      });
    } else if (canPrompt && location !== lastPlanPromptLocationRef.current) {
      // 已经欢迎过，用户换了个新地点探索 → 追加新的攻略引导
      lastPlanPromptLocationRef.current = location;
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          kind: 'plan-prompt',
          content: `✨ 想了解「${location}」的自然观察攻略吗？`,
          planTarget: { name: location!, lat: centerLat!, lng: centerLng! },
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentSpecies?.id, location]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || typing) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', kind: 'text', content: q }]);
    historyRef.current.push({ role: 'user', content: q });
    setTyping(true);

    const reply = await aiChat(historyRef.current, q, { currentSpecies, location });
    setTyping(false);
    setMessages((prev) => [...prev, { role: 'bot', kind: 'text', content: reply }]);
    historyRef.current.push({ role: 'assistant', content: reply });
  };

  /** 点击"生成攻略"引导卡片：把这条消息就地替换为 loading → 结果，全程在对话流内完成 */
  const generatePlanInline = async (target: PlanTarget, msgIndex: number) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === msgIndex ? { role: 'bot', kind: 'plan-loading', content: `正在为「${target.name}」生成自然观察攻略…` } : m,
      ),
    );
    try {
      const month = new Date().getMonth() + 1;
      const plan = await generateTravelPlan({ destination: target.name, lat: target.lat, lng: target.lng, month });
      setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { role: 'bot', kind: 'plan-result', planData: plan } : m)));
    } catch (err) {
      console.error('[AIDrawer] 攻略生成失败:', err);
      setMessages((prev) =>
        prev.map((m, i) => (i === msgIndex ? { role: 'bot', kind: 'text', content: '抱歉，攻略生成失败了，请稍后再试～' } : m)),
      );
    }
  };

  const suggestions = buildSuggestions(currentSpecies);

  return (
    <Drawer open={open} onClose={onClose} placement="right" width={430} title="🦉 自然向导">
      <div className="ai-messages">
        {messages.map((m, i) => {
          if (m.kind === 'plan-prompt' && m.planTarget) {
            return (
              <div key={i} className="ai-plan-prompt">
                <div className="plan-prompt-text">{m.content}</div>
                <Button size="small" type="primary" onClick={() => generatePlanInline(m.planTarget!, i)}>
                  ✨ 生成攻略
                </Button>
              </div>
            );
          }
          if (m.kind === 'plan-loading') {
            return (
              <div key={i} className="msg bot plan-loading-msg">
                {m.content}
                <span className="ai-plan-loading-dots"><span /><span /><span /></span>
              </div>
            );
          }
          if (m.kind === 'plan-result' && m.planData) {
            return (
              <AIPlanResultCard
                key={i}
                plan={m.planData}
                onExplore={() => onExploreDestination(m.planData!)}
              />
            );
          }
          return (
            <div key={i} className={`msg ${m.role === 'user' ? 'user' : 'bot'}`}>{m.content}</div>
          );
        })}
        {typing && <div className="msg bot typing"><span /><span /><span /></div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="ai-suggestions">
        {suggestions.map((s) => (
          <button key={s} className="suggestion-chip" onClick={() => send(s)}>{s}</button>
        ))}
      </div>

      <div className="ai-input-row">
        <Input
          value={input}
          placeholder="问问关于自然的任何问题…"
          onChange={(e) => setInput((e.target as HTMLInputElement).value)}
          onKeyDown={(e: any) => { if (e.key === 'Enter') send(input); }}
        />
        <Button type="primary" onClick={() => send(input)}>发送</Button>
      </div>
    </Drawer>
  );
}

// 通用自然观察伦理守则：几乎所有攻略都适用，不依赖 AI 生成，保证稳定可靠
const OBSERVE_ETIQUETTE = [
  '保持安全距离，不主动靠近、追赶或触碰野生动植物',
  '不投喂、不采摘、不带走，观察即可，尽量不留下痕迹',
  '轻声慢行，避免使用闪光灯或模拟叫声打扰动物正常活动',
];

/** 单个物种的紧凑展示行：名字 + 观测次数 + 一句观察要点 */
function SpeciesTipRow({ s }: { s: Species }) {
  const meta = getTaxonMeta(s.taxon);
  return (
    <div className="species-tip-row">
      <div className="species-tip-name">
        <span className="species-tip-icon">{meta.icon}</span>
        <span>{s.cn_name}</span>
        <span className="species-tip-count">· {s.count || 0}次</span>
      </div>
      {s.observeTip && <div className="species-tip-text">💡 {s.observeTip}</div>}
    </div>
  );
}

/** 内嵌在对话流里的紧凑版攻略结果卡片（不是独立页面，是一条特殊样式的"聊天消息"） */
function AIPlanResultCard({ plan, onExplore }: { plan: TravelPlan; onExplore: () => void }) {
  const speciesToShow = plan.isMountainous
    ? plan.elevationBands.flatMap((b) => b.species.slice(0, 3))
    : plan.speciesHighlights.slice(0, 8);

  return (
    <div className="ai-plan-result">
      <div className="plan-result-title">🗺️ {plan.destination} · {plan.month}月观察攻略</div>
      <div className="plan-result-credibility">📊 基于 {plan.totalObservations} 次真实观测记录</div>
      <p className="plan-result-narrative">{plan.narrative}</p>

      {plan.isMountainous ? (
        <div className="plan-result-bands">
          {plan.elevationBands.map((band) => (
            <div key={band.label} className="plan-result-band">
              <span className="band-label-mini">{band.label}</span>
              <div className="species-tip-list">
                {band.species.slice(0, 3).map((s) => (
                  <SpeciesTipRow key={s.id} s={s} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="species-tip-list">
          {speciesToShow.map((s) => (
            <SpeciesTipRow key={s.id} s={s} />
          ))}
        </div>
      )}

      <div className="plan-result-tip">🕐 {plan.bestTimeHint}</div>
      <div className="plan-result-tip">🎒 {plan.equipmentTips}</div>

      {/* 通用观察须知：静态守则，稳定可靠，不依赖 AI 生成质量 */}
      <div className="plan-etiquette">
        <div className="plan-etiquette-title">🌿 观察须知</div>
        {OBSERVE_ETIQUETTE.map((tip, i) => (
          <div key={i} className="plan-etiquette-item">· {tip}</div>
        ))}
      </div>

      <Button size="small" type="primary" block onClick={onExplore}>🔍 开始探索这里</Button>
    </div>
  );
}
