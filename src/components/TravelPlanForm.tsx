import { useState } from 'react';
import { Card, Button, Title } from 'animal-island-ui';
import { SearchBar } from './SearchBar';
import type { PlaceResult } from '../services/inaturalist';

interface Props {
  onGenerate: (destinationName: string, lat: number, lng: number, month: number) => void;
  loading: boolean;
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

/**
 * 轻量化攻略输入表单：目的地"选"不"填"（复用现有 SearchBar 的地名搜索能力），
 * 月份用点选的 Chip，而不是完整的日期选择器 —— 尽量降低用户输入成本。
 */
export function TravelPlanForm({ onGenerate, loading }: Props) {
  const [destination, setDestination] = useState<PlaceResult | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const handleGenerate = () => {
    if (!destination) return;
    const name = destination.isNatural ? destination.name : (destination.fullName || destination.name);
    onGenerate(name, destination.lat, destination.lng, month);
  };

  return (
    <div className="travel-plan-form">
      <Card>
        <div className="form-header">
          <Title level={3}>🗺️ 制定自然探索攻略</Title>
          <p className="form-hint">选好目的地和月份，AI 会基于真实观测数据生成一份自然观察攻略</p>
        </div>

        <div className="form-field">
          <label className="form-label">📍 目的地</label>
          <SearchBar onSelect={setDestination} />
          {destination && (
            <div className="selected-place">✓ 已选择：{destination.isNatural ? destination.name : (destination.fullName || destination.name)}</div>
          )}
        </div>

        <div className="form-field">
          <label className="form-label">📅 出行月份</label>
          <div className="month-picker">
            {MONTH_LABELS.map((label, i) => (
              <button
                key={i}
                type="button"
                className={`month-chip ${month === i + 1 ? 'active' : ''}`}
                onClick={() => setMonth(i + 1)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Button type="primary" block size="large" loading={loading} disabled={!destination} onClick={handleGenerate}>
          {loading ? 'AI 正在生成攻略…' : '✨ 生成攻略'}
        </Button>
      </Card>
    </div>
  );
}
