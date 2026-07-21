import { useState, useRef } from 'react';
import { searchPlace, type PlaceResult } from '../services/inaturalist';

interface Props {
  onSelect: (place: PlaceResult) => void;
}

/** 地点搜索框：输入地名 → 下拉结果 → 点击跳转到该地点探索。 */
export function SearchBar({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = (q: string) => {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    // 输入防抖，停止输入 500ms 后再搜索
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      const res = await searchPlace(q);
      setResults(res);
      setLoading(false);
      setOpen(true);
    }, 500);
  };

  const pick = (r: PlaceResult) => {
    onSelect(r);
    setOpen(false);
    setQuery(r.name);
  };

  return (
    <div className="search-bar">
      <div className="search-input-wrap">
        <span className="search-icon">🔍</span>
        <input
          className="search-input"
          value={query}
          placeholder="搜索地点：拉萨、黄山、西湖…"
          onChange={(e) => doSearch(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
        />
        {query && (
          <button className="search-clear" onClick={() => { setQuery(''); setResults([]); setOpen(false); }}>✕</button>
        )}
      </div>
      {open && (
        <div className="search-results">
          {loading ? (
            <div className="search-empty">搜索中…</div>
          ) : results.length === 0 ? (
            <div className="search-empty">没有找到，换个关键词试试</div>
          ) : (
            results.map((r, i) => (
              <div className="search-item" key={i} onClick={() => pick(r)}>
                <span className="search-item-icon">{r.isNatural ? '⛰️' : '📍'}</span>
                <span className="search-item-text">
                  <span className="search-item-name">{r.name}</span>
                  {r.fullName && r.fullName !== r.name && (
                    <span className="search-item-sub">{r.fullName}</span>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
