import { useState } from 'react';
import { Card, Tag } from 'animal-island-ui';
import type { Species } from '../types';
import { getTaxonMeta } from '../constants';

interface SpeciesCardProps {
  species: Species;
  collected: boolean;
  onClick: () => void;
}

export function SpeciesCard({ species, collected, onClick }: SpeciesCardProps) {
  const meta = getTaxonMeta(species.taxon);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="species-card" onClick={onClick}>
      <Card hoverable color="default" style={{ padding: 10 }}>
        {species.photo && !imgError ? (
          <img className="thumb" src={species.photo} alt={species.cn_name} loading="lazy" onError={() => setImgError(true)} />
        ) : (
          <div className="thumb-fallback">{meta.icon}</div>
        )}
        <div className="cn-name">{species.cn_name || '未知物种'}</div>
        <div className="sci-name">{species.sci_name || ''}</div>
        {/* 数据可解释性：距离/海拔层级 + 观测次数，让"为什么推荐这个"变得可追溯 */}
        {(species.elevationBand || species.distanceKm != null || species.count) && (
          <div className="card-meta">
            {species.elevationBand
              ? species.elevationBand
              : species.distanceKm != null
                ? `📍约${species.distanceKm}km`
                : ''}
            {species.count ? ` · 观测${species.count}次` : ''}
          </div>
        )}
        <div style={{ marginTop: 6 }}>
          <Tag size="small" color={meta.color as any} variant="solid">
            {meta.icon} {meta.cn}
          </Tag>
        </div>
      </Card>
      {collected && <div className="card-collected">✓</div>}
    </div>
  );
}
