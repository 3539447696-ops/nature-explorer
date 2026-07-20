import { useEffect, useRef, useState } from 'react';
import { Drawer, Input, Button } from 'animal-island-ui';
import type { ChatMessage, Species } from '../types';
import { aiChat, buildSuggestions } from '../services/ai';

interface Props {
  open: boolean;
  onClose: () => void;
  currentSpecies: Species | null;
  location: string | null;
}

interface DisplayMsg {
  role: 'user' | 'bot';
  content: string;
}

export function AIDrawer({ open, onClose, currentSpecies, location }: Props) {
  const [messages, setMessages] = useState<DisplayMsg[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const historyRef = useRef<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const welcomedRef = useRef(false);

  // 打开时给欢迎语
  useEffect(() => {
    if (open && !welcomedRef.current) {
      welcomedRef.current = true;
      const welcome = currentSpecies
        ? `你好呀！🦉 我是你的自然向导。看到你在关注「${currentSpecies.cn_name}」，有什么想了解的尽管问我～`
        : '你好呀！🦉 我是你的自然向导，专门解答关于动植物、鸟类和大自然的一切问题。今天想探索点什么呢？';
      setMessages([{ role: 'bot', content: welcome }]);
    } else if (open && currentSpecies && welcomedRef.current) {
      // 已经欢迎过，但用户从新物种点进来，追加一句
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        const line = `我们来聊聊「${currentSpecies.cn_name}」吧！有什么想知道的？`;
        if (last && last.content === line) return prev;
        return [...prev, { role: 'bot', content: line }];
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentSpecies?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || typing) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    historyRef.current.push({ role: 'user', content: q });
    setTyping(true);

    const reply = await aiChat(historyRef.current, q, { currentSpecies, location });
    setTyping(false);
    setMessages((prev) => [...prev, { role: 'bot', content: reply }]);
    historyRef.current.push({ role: 'assistant', content: reply });
  };

  const suggestions = buildSuggestions(currentSpecies);

  return (
    <Drawer open={open} onClose={onClose} placement="right" width={430} title="🦉 自然向导">
      <div className="ai-messages">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role === 'user' ? 'user' : 'bot'}`}>{m.content}</div>
        ))}
        {typing && (
          <div className="msg bot typing"><span /><span /><span /></div>
        )}
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
