import { useState } from 'react';
import { Drawer, Title, Tag } from 'animal-island-ui';
import type { Species } from '../types';
import { getTaxonMeta, FILTERS, RARITY_CONFIG } from '../constants';

interface Props {
  open: boolean;
  collection: Species[];
  onClose: () => void;
  onSelect: (s: Species) => void;
}

// 收藏家称号阶梯：数量越多，称号越高，配一个"距下一级还差几个"的进度条
const COLLECTOR_TITLES = [
  { threshold: 0, title: '🌱 自然新手', next: 5 },
  { threshold: 5, title: '🔍 观察员', next: 15 },
  { threshold: 15, title: '🔭 资深观察员', next: 30 },
  { threshold: 30, title: '📚 自然学家', next: 60 },
  { threshold: 60, title: '🏆 博物大师', next: null as number | null },
];
function getCollectorTitle(count: number) {
  let current = COLLECTOR_TITLES[0];
  for (const t of COLLECTOR_TITLES) {
    if (count >= t.threshold) current = t;
  }
  return current;
}

export function CollectionDrawer({ open, collection, onClose, onSelect }: Props) {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? collection : collection.filter((s) => s.taxon === filter);
  const sorted = [...filtered].sort((a, b) => (b.collectedAt || 0) - (a.collectedAt || 0));

  // 补充空槽营造“未集满”的仪式感
  const emptySlots = Math.max(3, (3 - (sorted.length % 3)) % 3 + 3);
  const titleInfo = getCollectorTitle(collection.length);

  return (
    <Drawer open={open} onClose={onClose} placement="right" width={420} title="📖 我的自然图鉴">
      <div className="collection-stats">
        <div className="collector-title">{titleInfo.title}</div>
        <div className="collection-count">已收集 {collection.length} 个物种</div>
        {titleInfo.next != null && (
          <div className="collector-progress-wrap">
            <div className="collector-progress-bar">
              <div
                className="collector-progress-fill"
                style={{ width: `${Math.min(100, (collection.length / titleInfo.next) * 100)}%` }}
              />
            </div>
            <div className="collector-progress-text">再收集 {titleInfo.next - collection.length} 个解锁下一称号</div>
          </div>
        )}
      </div>

      <div className="collection-filters">
        {FILTERS.map((f) => (
          <Tag
            key={f.value}
            color={filter === f.value ? 'app-green' : 'default'}
            variant={filter === f.value ? 'solid' : 'outlined'}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Tag>
        ))}
      </div>

      {collection.length === 0 ? (
        <div className="collection-grid">
          <div className="collection-empty">还没有收集到物种<br />去地图上探索并收集吧！🔍</div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="stamp-slot empty"><div className="lock">🔒</div></div>
          ))}
        </div>
      ) : (
        <div className="collection-grid">
          {sorted.map((s) => (
            <StampSlot key={s.id} species={s} onClick={() => onSelect(s)} />
          ))}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <div key={`e-${i}`} className="stamp-slot empty"><div className="lock">🔒</div></div>
          ))}
        </div>
      )}
    </Drawer>
  );
}

function StampSlot({ species, onClick }: { species: Species; onClick: () => void }) {
  const meta = getTaxonMeta(species.taxon);
  const [imgError, setImgError] = useState(false);
  const rarity = species.rarity && species.rarity !== 'common' ? RARITY_CONFIG[species.rarity] : null;
  return (
    <div className={`stamp-slot filled ${species.rarity ? `rarity-${species.rarity}` : ''}`} onClick={onClick}>
      {rarity && <div className="stamp-rarity-badge" style={{ background: rarity.color }}>{rarity.icon}</div>}
      {species.photo && !imgError ? (
        <img src={species.photo} alt={species.cn_name} onError={() => setImgError(true)} />
      ) : (
        <div className="stamp-fallback">{meta.icon}</div>
      )}
      <div className="stamp-name">{species.cn_name}</div>
    </div>
  );
}
