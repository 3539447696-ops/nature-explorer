import type { TravelPlanRequest, TravelPlan, ElevationBand, Species } from '../types';
import { fetchSeasonalSpecies } from './inaturalist';
import { fetchElevationsBatch, isMountainousArea, ELEVATION_BANDS, getGeoInfo } from './geoinfo';
import { pickBalancedSample } from '../constants';
import { generateTravelNarrative } from './ai';

/* AI 旅行攻略生成器 —— 核心整合服务。
 * 设计原则："AI 不编数据"：所有物种、观测次数、海拔分层都来自真实数据源
 * （iNaturalist 历史观测 + Open-Meteo 海拔），AI 只负责把数据组织成有温度的文案。
 * 复用阶段 A 已经建好的工具函数（海拔批量查询/山地判断/均衡采样），不重复造轮子。 */

// 攻略场景用比"探索模式"更大的搜索半径，因为要覆盖整个目的地区域（比如一整个景区/城市）
const PLAN_RADIUS_KM = 20;

export async function generateTravelPlan(request: TravelPlanRequest): Promise<TravelPlan> {
  const { destination, lat, lng, month, days } = request;

  // 1. 拿该月份历史真实观测数据（数据可验证的核心：每条推荐都能追溯到真实观测次数）
  const { species, totalObservations } = await fetchSeasonalSpecies(lat, lng, month, PLAN_RADIUS_KM);

  // 2. 拿目的地的气候带/中心海拔（复用已有的地理信息服务）
  const geoInfo = await getGeoInfo(lat, lng);

  // 3. 判断是否山地类目的地，构建垂直分层或平铺精选
  const withCoords = species.filter((s) => s.lat != null && s.lng != null);
  let isMountainous = false;
  let elevationBands: ElevationBand[] = [];
  let speciesHighlights: Species[] = [];

  if (withCoords.length > 0) {
    const elevations = await fetchElevationsBatch(withCoords.map((s) => ({ lat: s.lat!, lng: s.lng! })));
    isMountainous = isMountainousArea(elevations);

    if (isMountainous) {
      // 按海拔归类到 山脚/半山/山顶
      const bandMap = new Map<string, Species[]>();
      withCoords.forEach((s, i) => {
        const el = elevations[i];
        if (el == null) return;
        const band =
          ELEVATION_BANDS.find((b) => el >= b.min && el < b.max) || ELEVATION_BANDS[ELEVATION_BANDS.length - 1];
        const arr = bandMap.get(band.label) || [];
        arr.push({ ...s, elevationM: el });
        bandMap.set(band.label, arr);
      });
      elevationBands = ELEVATION_BANDS.map((b) => {
        const list = (bandMap.get(b.label) || []).sort((a, bb) => (bb.count || 0) - (a.count || 0));
        const rep = list[0]; // 该带的代表坐标（观测最多的物种所在位置），供地图预标注使用
        return {
          label: b.label,
          minElevation: b.min,
          maxElevation: b.max === Infinity ? 9999 : b.max,
          lat: rep?.lat ?? lat,
          lng: rep?.lng ?? lng,
          species: pickBalancedSample(list, 6),
          observationCount: list.reduce((sum, s) => sum + (s.count || 0), 0),
        };
      }).filter((b) => b.species.length > 0);
    } else {
      speciesHighlights = pickBalancedSample(species, 10);
    }
  } else {
    speciesHighlights = pickBalancedSample(species, 10);
  }

  // 4. AI 生成有温度的文案（narrative/最佳时段/装备/路线/每个物种的观察要点）
  const narrative = await generateTravelNarrative({
    destination,
    month,
    days,
    isMountainous,
    elevationBands,
    speciesHighlights,
    totalObservations,
    climateZone: geoInfo.climateZone,
  });

  // 把 AI 生成的"物种→观察要点"映射，应用到每个物种对象上（observeTip 字段）
  const applyTips = (list: Species[]) =>
    list.map((s) => (narrative.speciesTips[s.cn_name] ? { ...s, observeTip: narrative.speciesTips[s.cn_name] } : s));

  const finalElevationBands = elevationBands.map((b) => ({ ...b, species: applyTips(b.species) }));
  const finalSpeciesHighlights = applyTips(speciesHighlights);

  return {
    destination,
    lat,
    lng,
    month,
    days,
    isMountainous,
    elevationBands: finalElevationBands,
    speciesHighlights: finalSpeciesHighlights,
    totalObservations,
    climateZone: geoInfo.climateZone,
    elevation: geoInfo.elevation,
    bestTimeHint: narrative.bestTimeHint,
    equipmentTips: narrative.equipmentTips,
    routeHint: narrative.routeHint,
    narrative: narrative.narrative,
    generatedAt: Date.now(),
  };
}
