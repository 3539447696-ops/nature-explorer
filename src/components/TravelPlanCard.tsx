import { Card, Tag, Button } from 'animal-island-ui';
import type { TravelPlan } from '../types';
import { getTaxonMeta } from '../constants';

interface Props {
  plan: TravelPlan;
  onExplore: () => void;
  onShare: () => void;
  onReset: () => void;
}

/**
 * 攻略结果卡片。核心设计：数据可解释性——每一条推荐都能看到真实观测次数，
 * 山地类目的地按海拔垂直分层展示（山脚/半山/山顶），而不是笼统地堆一起。
 */
export function TravelPlanCard({ plan, onExplore, onShare, onReset }: Props) {
  return (
    <div className="travel-plan-card">
      <Card>
        <div className="plan-header">
          <button className="plan-back-btn" onClick={onReset}>← 重新制定</button>
          <h2>{plan.destination} · {plan.month}月自然观察攻略</h2>
          <div className="plan-credibility">📊 基于 {plan.totalObservations} 次真实观测记录生成</div>
        </div>

        <p className="plan-narrative">{plan.narrative}</p>

        <div className="plan-meta-row">
          <span className="geo-chip">{plan.climateZone}</span>
          {plan.elevation != null && <span className="geo-chip">⛰️ 海拔 {plan.elevation}m</span>}
          {plan.isMountainous && <span className="geo-chip geo-chip-range">🏔️ 已按海拔分层</span>}
        </div>

        {plan.isMountainous ? (
          <div className="elevation-bands">
            {plan.elevationBands.map((band) => (
              <div key={band.label} className="elevation-band">
                <div className="band-title">
                  {band.label} ({band.minElevation}-{band.maxElevation >= 9999 ? '∞' : band.maxElevation}m)
                  <span className="band-count"> · {band.observationCount}次观测</span>
                </div>
                <div className="band-species">
                  {band.species.map((s) => {
                    const meta = getTaxonMeta(s.taxon);
                    return (
                      <Tag key={s.id} size="small" color={meta.color as any} variant="outlined">
                        {meta.icon} {s.cn_name} · {s.count || 0}次
                      </Tag>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="species-highlights">
            {plan.speciesHighlights.map((s) => {
              const meta = getTaxonMeta(s.taxon);
              return (
                <Tag key={s.id} size="small" color={meta.color as any} variant="outlined">
                  {meta.icon} {s.cn_name} · {s.count || 0}次
                </Tag>
              );
            })}
          </div>
        )}

        <div className="plan-tips">
          <div className="tip-item">🕐 <strong>最佳时段：</strong>{plan.bestTimeHint}</div>
          <div className="tip-item">🎒 <strong>装备建议：</strong>{plan.equipmentTips}</div>
          <div className="tip-item">🗺️ <strong>路线建议：</strong>{plan.routeHint}</div>
        </div>

        <div className="plan-actions">
          <Button type="primary" block onClick={onExplore}>🔍 开始探索</Button>
          <Button block onClick={onShare}>📤 分享攻略</Button>
        </div>
      </Card>
    </div>
  );
}
