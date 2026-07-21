import type { Species } from '../types';
import { FALLBACK_SPECIES } from '../constants';

/* iNaturalist 开放数据 API（无需 Key，免费）
 * 文档: https://api.inaturalist.org/v1/docs/ */
const INAT_BASE = 'https://api.inaturalist.org/v1';

export interface NearbyResult {
  data: Species[];
  source: 'inat' | 'inat-empty' | 'fallback';
}

/** 获取坐标附近被观测到的物种（按观测次数排序 → 当地常见/代表性物种） */
export async function fetchNearbySpecies(
  lat: number,
  lng: number,
  radiusKm = 30,
  iconicTaxon: string | null = null,
): Promise<NearbyResult> {
  const params = new URLSearchParams({
    lat: lat.toFixed(5),
    lng: lng.toFixed(5),
    radius: String(radiusKm),
    quality_grade: 'research',
    locale: 'zh-CN',
    per_page: '50',
    order: 'desc',
    order_by: 'count',
  });
  if (iconicTaxon && iconicTaxon !== 'all') params.set('iconic_taxa', iconicTaxon);

  const url = `${INAT_BASE}/observations/species_counts?${params.toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`iNaturalist API ${res.status}`);
    const json = await res.json();
    if (!json.results || json.results.length === 0) return { data: [], source: 'inat-empty' };
    return { data: json.results.map(normalizeSpeciesCount), source: 'inat' };
  } catch (err) {
    clearTimeout(timeout);
    console.warn('[iNaturalist] 请求失败，使用离线数据:', (err as Error).message);
    return { data: filterFallback(iconicTaxon), source: 'fallback' };
  }
}

function normalizeSpeciesCount(item: any): Species {
  const t = item.taxon || {};
  const photo = t.default_photo
    ? (t.default_photo.medium_url || t.default_photo.url || '').replace('square', 'medium')
    : null;
  return {
    id: 'inat-' + t.id,
    taxonId: t.id,
    cn_name: t.preferred_common_name || t.english_common_name || t.name,
    sci_name: t.name,
    taxon: t.iconic_taxon_name || 'Animalia',
    photo,
    count: item.count || 0,
    wiki: t.wikipedia_summary ? stripHtml(t.wikipedia_summary) : null,
    rank: t.rank,
  };
}

/** 获取单个物种详情（含维基百科简介、保护状态等） */
export async function fetchSpeciesDetail(taxonId: number): Promise<Partial<Species> | null> {
  try {
    const res = await fetch(`${INAT_BASE}/taxa/${taxonId}?locale=zh-CN`);
    if (!res.ok) throw new Error(`taxa API ${res.status}`);
    const json = await res.json();
    const t = json.results && json.results[0];
    if (!t) return null;
    return {
      id: 'inat-' + t.id,
      taxonId: t.id,
      cn_name: t.preferred_common_name || t.name,
      sci_name: t.name,
      taxon: t.iconic_taxon_name || 'Animalia',
      photo: t.default_photo ? (t.default_photo.medium_url || t.default_photo.url) : null,
      wiki: t.wikipedia_summary ? stripHtml(t.wikipedia_summary) : defaultWiki(t.preferred_common_name || t.name, t.iconic_taxon_name),
      wikiUrl: t.wikipedia_url || null,
      conservationStatus: t.conservation_status ? t.conservation_status.status_name : null,
      observationsCount: t.observations_count || 0,
      rank: t.rank,
    };
  } catch (err) {
    console.warn('[iNaturalist] 详情请求失败:', (err as Error).message);
    return null;
  }
}

/** 反向地理编码：坐标 → 地名（OpenStreetMap Nominatim） */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  // zoom=14 更靠近地物级；addressdetails+namedetails 拿到地点名称与自然地标
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=zh-CN,zh&zoom=14&addressdetails=1&namedetails=1`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', 'Accept-Language': 'zh-CN,zh' } });
    if (!res.ok) throw new Error('geocode failed');
    const json = await res.json();
    const a = json.address || {};

    // 行政区：优先市/区/县级，避免出现"辽宁省"这种过大范围
    const region =
      a.city || a.town || a.municipality || a.county || a.district ||
      a.suburb || a.village || a.state_district ||
      // 省级作为最后兜底
      a.state || a.province || a.region || '';

    // 自然地标：优先 address 里的自然字段
    let natural =
      a.peak || a.mountain || a.mountain_range || a.hill ||
      a.valley || a.water || a.river || a.stream || a.lake || a.bay ||
      a.wood || a.forest || a.nature_reserve || a.national_park ||
      a.protected_area || a.park || a.island || a.glacier || a.wetland;

    // 若没有，尝试用返回的地点名（当该点本身是自然地物时）
    if (!natural && json.name) {
      const cat = json.category || '';
      const typ = json.type || '';
      // 只在明显是自然/地理要素时采用 name，避免把马路、建筑当地标
      if (['natural', 'water', 'waterway', 'leisure', 'boundary', 'place'].includes(cat) ||
          ['peak', 'volcano', 'water', 'river', 'valley', 'wood', 'forest', 'nature_reserve',
           'national_park', 'protected_area', 'bay', 'wetland', 'glacier', 'ridge', 'cliff'].includes(typ)) {
        natural = json.name;
      }
    }

    const parts: string[] = [];
    if (region) parts.push(region);
    if (natural && natural !== region) parts.push(natural);
    else {
      const sub = a.suburb || a.district || a.village || a.town;
      if (sub && sub !== region) parts.push(sub);
    }

    const uniq = parts.filter((v, i) => parts.indexOf(v) === i);
    if (uniq.length) return uniq.join(' · ');

    if (json.display_name) {
      const segs = String(json.display_name).split(',').map((s: string) => s.trim()).filter(Boolean);
      return segs.slice(0, 2).reverse().join(' · ');
    }
    return '未知区域';
  } catch {
    return null;
  }
}

/** 正向地理编码：地名 → 坐标（用于搜索框） */
export interface PlaceResult {
  name: string;
  lat: number;
  lng: number;
}
export async function searchPlace(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&accept-language=zh-CN,zh&limit=6`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', 'Accept-Language': 'zh-CN,zh' } });
    if (!res.ok) throw new Error('search failed');
    const arr = await res.json();
    return (arr || []).map((item: any) => ({
      name: item.display_name
        ? String(item.display_name).split(',').slice(0, 3).join(', ')
        : (item.name || q),
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    })).filter((p: PlaceResult) => !isNaN(p.lat) && !isNaN(p.lng));
  } catch {
    return [];
  }
}

function filterFallback(iconicTaxon: string | null): Species[] {
  if (!iconicTaxon || iconicTaxon === 'all') return FALLBACK_SPECIES.slice();
  return FALLBACK_SPECIES.filter((s) => s.taxon === iconicTaxon);
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
}

// 当维基百科没有简介时，生成一段基于类别的友好默认介绍，避免详情页空白
function defaultWiki(name: string, taxon?: string): string {
  const map: Record<string, string> = {
    Aves: `${name} 是一种鸟类。想深入了解它的习性、鸣声或迁徙？点下方「💬 问向导」问问 AI 吧～`,
    Plantae: `${name} 是一种植物。它的形态、花期与生长环境等更多细节，可以点「💬 问向导」了解更多。`,
    Mammalia: `${name} 是一种哺乳动物。关于它的食性、栖息地和行为，欢迎点「💬 问向导」深入探索。`,
    Insecta: `${name} 是一种昆虫。它的生命周期、习性与生态作用，点「💬 问向导」可以了解更多。`,
    Reptilia: `${name} 是一种爬行动物。更多关于它的特征与习性，点「💬 问向导」问问看。`,
    Amphibia: `${name} 是一种两栖动物。它的生活史和栖息环境很有意思，点「💬 问向导」了解更多。`,
    Fungi: `${name} 是一种真菌。关于它的分布与特征，点「💬 问向导」可以了解更多。`,
  };
  return map[taxon || ''] || `${name} 暂无详细简介。点下方「💬 问向导」，让 AI 为你科普它的故事吧～`;
}
