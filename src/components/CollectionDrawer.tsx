import { useState } from 'react';
import { Drawer, Title, Tag } from 'animal-island-ui';
import type { Species } from '../types';
import { getTaxonMeta, FILTERS } from '../constants';

interface Props {
  open: boolean;
  collection: Species[];
  onClose: () => void;
  onSelect: (s: Species) => void;
}

export function CollectionDrawer({ open, collection, onClose, onSelect }: Props) {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? collection : collection.filter((s) => s.taxon === filter);
  const sorted = [...filtered].sort((a, b) => (b.collectedAt || 0) - (a.collectedAt || 0));

  // 补充空槽营造“未集满”的仪式感
  const emptySlots = Math.max(3, (3 - (sorted.length % 3)) % 3 + 3);

  return (
    <Drawer open={open} onClose={onClose} placement="right" width={420} title="📖 我的自然图鉴">
      <div className="collection-stats">已收集 {collection.length} 个物种</div>

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
  return (
    <div className="stamp-slot filled" onClick={onClick}>
      {species.photo && !imgError ? (
        <img src={species.photo} alt={species.cn_name} onError={() => setImgError(true)} />
      ) : (
        <div className="stamp-fallback">{meta.icon}</div>
      )}
      <div className="stamp-name">{species.cn_name}</div>
    </div>
  );
}
