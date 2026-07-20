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
