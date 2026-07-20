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
      wiki: t.wikipedia_summary ? stripHtml(t.wikipedia_summary) : null,
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
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh-CN&zoom=10`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('geocode failed');
    const json = await res.json();
    const a = json.address || {};
    const parts = [
      a.city || a.town || a.county || a.state_district || a.state,
      a.suburb || a.village || a.neighbourhood,
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : (json.display_name || '未知区域');
  } catch {
    return null;
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
