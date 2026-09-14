import { useRef, useState } from 'react';
import { Modal, Button } from 'animal-island-ui';
import type { TravelPlan, Species } from '../types';
import { getTaxonMeta } from '../constants';
import { captureAndDownload } from '../services/shareImage';

/** 单个物种展示行：配图 + 名字/观测次数 + 观察要点（图文并排，方便朋友一眼认出长什么样） */
function PosterSpeciesRow({ s }: { s: Species }) {
  const meta = getTaxonMeta(s.taxon);
  const [imgError, setImgError] = useState(false);
  return (
    <div className="poster-species-row">
      {s.photo && !imgError ? (
        <img className="poster-species-photo" src={s.photo} alt={s.cn_name} onError={() => setImgError(true)} />
      ) : (
        <div className="poster-species-photo-fallback">{meta.icon}</div>
      )}
      <div className="poster-species-info">
        <div className="poster-species-name">
          <span className="poster-species-icon">{meta.icon}</span>
          {s.cn_name}{s.count ? ` · ${s.count}次` : ''}
        </div>
        {s.observeTip && <div className="poster-species-tip">💡 {s.observeTip}</div>}
      </div>
    </div>
  );
}

interface Props {
  plan: TravelPlan | null;
  open: boolean;
  onClose: () => void;
}

/**
 * 攻略分享图。不是简单截取聊天气泡，而是专门排版的、适合发朋友圈的
 * 竖版海报——这个"生成精美内容→社交传播"的能力，是这次攻略功能里
 * "增长支撑"的核心，比单纯的产品内闭环更有传播力。
 */
export function ShareTravelPlanModal({ plan, open, onClose }: Props) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  if (!plan) return null;

  const speciesToShow = plan.isMountainous
    ? plan.elevationBands.flatMap((b) => b.species.slice(0, 3))
    : plan.speciesHighlights.slice(0, 8);

  const handleSave = async () => {
    if (!posterRef.current) return;
    setSaving(true);
    try {
      await captureAndDownload(posterRef.current, `${plan.destination}-${plan.month}月自然观察攻略.png`);
    } catch (err) {
      console.error('[Share] 生成图片失败:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} typewriter={false} footer={null} width={420} title="📤 分享攻略">
      <div className="share-poster-scroll">
        <div className="share-poster" ref={posterRef}>
          <div className="poster-header">
            <div className="poster-badge">🗺️ 自然观察攻略</div>
            <h2 className="poster-title">{plan.destination}</h2>
            <div className="poster-month">{plan.month}月 · {plan.climateZone}</div>
          </div>

          <div className="poster-credibility">📊 基于 {plan.totalObservations} 次真实观测记录生成</div>

          <p className="poster-narrative">{plan.narrative}</p>

          {plan.isMountainous ? (
            <div className="poster-bands">
              {plan.elevationBands.map((band) => (
                <div key={band.label} className="poster-band">
                  <div className="poster-band-label">
                    {band.label} ({band.minElevation}-{band.maxElevation >= 9999 ? '∞' : band.maxElevation}m)
                  </div>
                  {band.species.slice(0, 3).map((s) => (
                    <PosterSpeciesRow key={s.id} s={s} />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="poster-species-list">
              {speciesToShow.map((s) => (
                <PosterSpeciesRow key={s.id} s={s} />
              ))}
            </div>
          )}

          <div className="poster-tips">
            <div>🕐 {plan.bestTimeHint}</div>
            <div>🎒 {plan.equipmentTips}</div>
          </div>

          <div className="poster-footer">
            <span className="poster-footer-logo">🌿 自然探索家</span>
            <span className="poster-footer-sub">NATURE EXPLORER · 基于真实观测数据的 AI 自然向导</span>
          </div>
        </div>
      </div>

      <Button type="primary" block loading={saving} onClick={handleSave}>
        {saving ? '生成中…' : '💾 保存图片'}
      </Button>
    </Modal>
  );
}
