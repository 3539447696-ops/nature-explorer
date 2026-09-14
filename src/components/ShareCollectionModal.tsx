import { useRef, useState } from 'react';
import { Modal, Button } from 'animal-island-ui';
import type { Species } from '../types';
import { getTaxonMeta, RARITY_CONFIG } from '../constants';
import { captureAndDownload } from '../services/shareImage';

interface Props {
  species: Species[]; // 本次会话新收集到的物种
  location: string | null;
  open: boolean;
  onClose: () => void;
}

/**
 * 图鉴收获战绩分享图。这是真正适合发朋友圈/小红书的内容——
 * 不是"这里有什么"的知识科普，而是"我今天发现了什么"的个人成就展示，
 * 天然具有社交货币属性（展示见识、生活情趣、去了哪里玩）。
 */
export function ShareCollectionModal({ species, location, open, onClose }: Props) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  if (species.length === 0) return null;

  const handleSave = async () => {
    if (!posterRef.current) return;
    setSaving(true);
    try {
      await captureAndDownload(posterRef.current, `我的自然发现-${location || '未知地点'}.png`);
    } catch (err) {
      console.error('[Share] 生成图鉴图片失败:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} typewriter={false} footer={null} width={420} title="📤 分享本次发现">
      <div className="share-poster-scroll">
        <div className="collection-poster" ref={posterRef}>
          <div className="poster-header">
            <div className="poster-badge">🎉 本次探索发现</div>
            <h2 className="poster-title">{location || '未知地点'}</h2>
            <div className="poster-month">发现了 {species.length} 种生物</div>
          </div>

          <div className="collection-poster-grid">
            {species.map((s) => {
              const meta = getTaxonMeta(s.taxon);
              const rarity = s.rarity && s.rarity !== 'common' ? RARITY_CONFIG[s.rarity] : null;
              return (
                <div key={s.id} className="collection-poster-cell">
                  {rarity && (
                    <div className="collection-poster-rarity" style={{ background: rarity.color }}>{rarity.icon}</div>
                  )}
                  {s.photo ? (
                    <img className="collection-poster-photo" src={s.photo} alt={s.cn_name} crossOrigin="anonymous" />
                  ) : (
                    <div className="collection-poster-photo-fallback">{meta.icon}</div>
                  )}
                  <div className="collection-poster-name">{s.cn_name}</div>
                </div>
              );
            })}
          </div>

          <div className="poster-footer">
            <span className="poster-footer-logo">🌿 自然探索家</span>
            <span className="poster-footer-sub">NATURE EXPLORER · 记录每一次自然发现</span>
          </div>
        </div>
      </div>

      <Button type="primary" block loading={saving} onClick={handleSave}>
        {saving ? '生成中…' : '💾 保存图片'}
      </Button>
    </Modal>
  );
}
