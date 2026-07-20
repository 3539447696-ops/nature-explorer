import { useEffect, useState } from 'react';
import { Modal, Button, Tag } from 'animal-island-ui';
import type { Post, Species } from '../types';
import { getTaxonMeta } from '../constants';
import { fetchSpeciesDetail } from '../services/inaturalist';
import { CommunityService } from '../services/community';

interface Props {
  species: Species | null;
  open: boolean;
  collected: boolean;
  onClose: () => void;
  onToggleCollect: (s: Species) => void;
  onAskAI: (s: Species) => void;
  onShareSpecies: (s: Species) => void;
  /** 发帖后的刷新信号 */
  refreshKey?: number;
}

export function SpeciesDetailModal({
  species, open, collected, onClose, onToggleCollect, onAskAI, onShareSpecies, refreshKey,
}: Props) {
  const [detail, setDetail] = useState<Species | null>(species);
  const [imgError, setImgError] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    setDetail(species);
    setImgError(false);
    setPosts([]);
    if (!species) return;
    // 补全简介
    if (species.taxonId && !species.wiki) {
      fetchSpeciesDetail(species.taxonId).then((d) => {
        if (d) setDetail((prev) => (prev && prev.id === species.id ? { ...prev, ...d } : prev));
      });
    }
    // 加载该物种的用户分享（入口2）
    CommunityService.getBySpecies(species.id).then(setPosts);
  }, [species, refreshKey]);

  if (!species || !detail) return null;
  const meta = getTaxonMeta(detail.taxon);
  const obsCount = detail.observationsCount || detail.count;

  return (
    <Modal open={open} onClose={onClose} typewriter={false} footer={null} width={460}>
      <div className="detail-hero">
        {detail.photo && !imgError ? (
          <img src={detail.photo} alt={detail.cn_name} onError={() => setImgError(true)} />
        ) : (
          <div className="hero-fallback">{meta.icon}</div>
        )}
        <div className="hero-grad" />
        <div className="hero-name">
          <h2>{detail.cn_name || '未知物种'}</h2>
          <p>{detail.sci_name}</p>
        </div>
      </div>

      <div className="detail-tags">
        <Tag color={meta.color as any} variant="solid">{meta.icon} {meta.cn}</Tag>
        {detail.conservationStatus && (
          <Tag color="app-red" variant="outlined">保护状态: {detail.conservationStatus}</Tag>
        )}
        {obsCount ? <Tag color="app-teal" variant="outlined">👁️ 观测 {obsCount} 次</Tag> : null}
      </div>

      <div className="detail-section">
        <h3>📖 物种简介</h3>
        <p>{detail.wiki || '正在加载简介…'}</p>
      </div>

      {/* 入口2：该物种的用户分享 */}
      {CommunityService.available() && (
        <div className="detail-section">
          <h3>📸 大家拍到的 {detail.cn_name}（{posts.length}）</h3>
          {posts.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--animal-text-secondary)' }}>
              还没有人分享这个物种，点下方「分享」成为第一个吧！
            </p>
          ) : (
            <div className="species-posts">
              {posts.map((p) => (
                <div className="species-post-thumb" key={p.id} title={p.caption || ''}>
                  <img src={p.photoUrl} alt={detail.cn_name} loading="lazy" />
                  <div className="species-post-author">
                    {(p.userEmail || '爱好者').split('@')[0]}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="detail-actions">
        <Button type="primary" size="large" onClick={() => onToggleCollect(detail)}>
          {collected ? '✓ 已收入图鉴' : '📌 收入图鉴'}
        </Button>
        <Button size="large" onClick={() => onAskAI(detail)}>💬 问向导</Button>
      </div>
      <div className="detail-actions" style={{ marginTop: 10 }}>
        <Button block size="large" onClick={() => onShareSpecies(detail)}>
          📸 分享我拍的 {detail.cn_name}
        </Button>
      </div>
    </Modal>
  );
}
