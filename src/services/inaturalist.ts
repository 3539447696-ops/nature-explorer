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
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh-CN,zh&zoom=12`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', 'Accept-Language': 'zh-CN,zh' } });
    if (!res.ok) throw new Error('geocode failed');
    const json = await res.json();
    const a = json.address || {};
    const big = a.city || a.town || a.municipality || a.county || a.state_district || a.state || a.province;
    const small = a.district || a.suburb || a.village || a.neighbourhood || a.road;
    const parts = [big, small].filter(Boolean);
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
