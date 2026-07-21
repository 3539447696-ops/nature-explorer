import type { Species } from '../types';
import { FALLBACK_SPECIES } from '../constants';

/* iNaturalist 开放数据 API（无需 Key，免费）
 * 文档: https://api.inaturalist.org/v1/docs/ */
const INAT_BASE = 'https://api.inaturalist.org/v1';

// 高德 Web 服务 Key（在 Vercel 环境变量 VITE_AMAP_KEY 配置）
const AMAP_KEY = import.meta.env.VITE_AMAP_KEY || '';

// 代表自然地物的中文关键词（用于识别山川湖泊/景区）
const AMAP_NATURAL_KEYWORDS = ['山', '峰', '岭', '湖', '江', '河', '溪', '瀑', '峡', '谷', '岛', '海', '林', '森林', '湿地', '自然保护区', '国家公园', '风景区', '景区', '泉', '洞'];

/* ---------- WGS-84 ↔ GCJ-02 坐标转换 ----------
 * 我们全站用 WGS-84（浏览器定位、Leaflet、iNaturalist），
 * 而高德 API 用 GCJ-02（火星坐标）。调用高德前把 WGS→GCJ，
 * 拿到高德返回的坐标后再 GCJ→WGS，保证与地图和物种查询一致。 */
const PI = 3.14159265358979324;
const A = 6378245.0;
const EE = 0.00669342162296594323;

function outOfChina(lat: number, lng: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}
function transformLat(x: number, y: number): number {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3;
  ret += ((20 * Math.sin(y * PI) + 40 * Math.sin((y / 3) * PI)) * 2) / 3;
  ret += ((160 * Math.sin((y / 12) * PI) + 320 * Math.sin((y * PI) / 30)) * 2) / 3;
  return ret;
}
function transformLng(x: number, y: number): number {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3;
  ret += ((20 * Math.sin(x * PI) + 40 * Math.sin((x / 3) * PI)) * 2) / 3;
  ret += ((150 * Math.sin((x / 12) * PI) + 300 * Math.sin((x / 30) * PI)) * 2) / 3;
  return ret;
}
/** WGS-84 → GCJ-02（送入高德前用） */
function wgs84ToGcj02(lat: number, lng: number): [number, number] {
  if (outOfChina(lat, lng)) return [lat, lng];
  let dLat = transformLat(lng - 105, lat - 35);
  let dLng = transformLng(lng - 105, lat - 35);
  const radLat = (lat / 180) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return [lat + dLat, lng + dLng];
}
/** GCJ-02 → WGS-84（拿到高德返回坐标后用，近似反解，精度足够） */
function gcj02ToWgs84(lat: number, lng: number): [number, number] {
  if (outOfChina(lat, lng)) return [lat, lng];
  const [gLat, gLng] = wgs84ToGcj02(lat, lng);
  return [lat * 2 - gLat, lng * 2 - gLng];
}

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

/** 高德逆地理编码：坐标 → 地名（国内更准，能识别景区/乡镇） */
async function reverseGeocodeAmap(lat: number, lng: number): Promise<string | null> {
  if (!AMAP_KEY) return null;
  // 传入为 WGS-84，高德用 GCJ-02，先转换再查询
  const [gLat, gLng] = wgs84ToGcj02(lat, lng);
  const loc = `${gLng.toFixed(6)},${gLat.toFixed(6)}`; // 高德是 经度,纬度
  const url = `https://restapi.amap.com/v3/geocode/regeo?key=${AMAP_KEY}&location=${loc}&extensions=all&radius=1000`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('amap regeo failed');
    const json = await res.json();
    if (json.status !== '1' || !json.regeocode) return null;
    const rc = json.regeocode;
    const ac = rc.addressComponent || {};

    // 市/区县：直辖市 city 可能为空数组，回退到 province
    const cityRaw = ac.city;
    const city = Array.isArray(cityRaw) ? '' : (cityRaw || '');
    const district = typeof ac.district === 'string' ? ac.district : '';
    const township = typeof ac.township === 'string' ? ac.township : '';
    const province = typeof ac.province === 'string' ? ac.province : '';

    // 附近景区/自然地物：优先 AOI（面状，如风景区），再看知名 POI
    let natural = '';
    const aois = Array.isArray(rc.aois) ? rc.aois : [];
    if (aois.length && typeof aois[0].name === 'string') {
      const n = aois[0].name;
      if (AMAP_NATURAL_KEYWORDS.some((k) => n.includes(k))) natural = n;
    }
    if (!natural) {
      const pois = Array.isArray(rc.pois) ? rc.pois : [];
      const scenic = pois.find(
        (p: any) => typeof p.name === 'string' && AMAP_NATURAL_KEYWORDS.some((k) => p.name.includes(k)),
      );
      if (scenic) natural = scenic.name;
    }

    // 组装：市/区县 · 乡镇（或景区）
    const region = city || district || province || '';
    const parts: string[] = [];
    if (region) parts.push(region);
    const sub = natural || township || (region === city ? district : '');
    if (sub && sub !== region) parts.push(sub);

    const uniq = parts.filter((v, i) => v && parts.indexOf(v) === i);
    if (uniq.length) return uniq.join(' · ');

    // 兜底用格式化地址
    if (typeof rc.formatted_address === 'string' && rc.formatted_address) {
      return rc.formatted_address;
    }
    return null;
  } catch {
    return null;
  }
}

/** 反向地理编码：坐标 → 地名。高德优先（国内准），失败用 OSM 兜底。 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const amap = await reverseGeocodeAmap(lat, lng);
  if (amap) return amap;
  return reverseGeocodeOSM(lat, lng);
}

/** OpenStreetMap 逆地理编码（海外兜底） */
async function reverseGeocodeOSM(lat: number, lng: number): Promise<string | null> {
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
  name: string;       // 简短显示名（列表用），如 "黄山"
  fullName: string;   // 较完整的名称，含上级地名，用于消歧
  lat: number;
  lng: number;
  isNatural: boolean; // 是否山川湖泊等自然地物（决定选中后是否套行政区）
}

// Nominatim 中属于"自然/地理要素"的 class 或 type
const NATURAL_CLASSES = ['natural', 'water', 'waterway'];
const NATURAL_TYPES = [
  'peak', 'volcano', 'mountain_range', 'ridge', 'hill', 'massif', 'saddle', 'cliff',
  'water', 'river', 'stream', 'lake', 'reservoir', 'bay', 'wetland', 'glacier',
  'valley', 'wood', 'forest', 'nature_reserve', 'national_park', 'protected_area',
  'island', 'islet', 'beach', 'spring', 'cave_entrance',
];

// 高德风景名胜/自然地物大类 typecode 前缀（11 风景名胜、19 地名地址中的自然地物等）
const AMAP_NATURAL_TYPECODE_PREFIX = ['1101', '1102', '1103', '1902', '1903'];

function amapIsNatural(name: string, typecode: string): boolean {
  if (AMAP_NATURAL_TYPECODE_PREFIX.some((p) => typecode.startsWith(p))) return true;
  return AMAP_NATURAL_KEYWORDS.some((k) => name.includes(k));
}

/** 高德输入提示（inputtips）：国内地名/POI 覆盖最全，最适合搜索框 */
async function searchPlaceAmap(q: string): Promise<PlaceResult[]> {
  if (!AMAP_KEY) return [];
  const url = `https://restapi.amap.com/v3/assistant/inputtips?key=${AMAP_KEY}&keywords=${encodeURIComponent(q)}&datatype=all`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('amap tips failed');
    const json = await res.json();
    if (json.status !== '1' || !Array.isArray(json.tips)) return [];
    const list: PlaceResult[] = [];
    for (const tip of json.tips) {
      // location 形如 "116.481028,39.989643"；部分行政区提示无 location，跳过
      const loc = typeof tip.location === 'string' ? tip.location : '';
      if (!loc || !loc.includes(',')) continue;
      const [lngStr, latStr] = loc.split(',');
      const gcjLng = parseFloat(lngStr);
      const gcjLat = parseFloat(latStr);
      if (isNaN(gcjLat) || isNaN(gcjLng)) continue;
      // 高德返回 GCJ-02，转回 WGS-84 以与地图/物种查询一致
      const [lat, lng] = gcj02ToWgs84(gcjLat, gcjLng);

      const name = tip.name || q;
      // district 形如 "安徽省黄山市" —— 作为消歧的上级地名
      const district = typeof tip.district === 'string' ? tip.district : '';
      const typecode = typeof tip.typecode === 'string' ? tip.typecode : '';

      list.push({
        name,
        fullName: district ? `${district} · ${name}` : name,
        lat,
        lng,
        isNatural: amapIsNatural(name, typecode),
      });
    }
    return list;
  } catch {
    return [];
  }
}

/** OpenStreetMap Nominatim 搜索（高德无 Key 或无结果时的兜底，海外地名也靠它） */
async function searchPlaceOSM(q: string): Promise<PlaceResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&accept-language=zh-CN,zh&addressdetails=1&namedetails=1&limit=8`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', 'Accept-Language': 'zh-CN,zh' } });
    if (!res.ok) throw new Error('search failed');
    const arr = await res.json();
    return (arr || []).map((item: any) => {
      const cls = item.class || item.category || '';
      const typ = item.type || '';
      const isNatural = NATURAL_CLASSES.includes(cls) || NATURAL_TYPES.includes(typ);
      const nd = item.namedetails || {};
      const shortName =
        nd['name:zh'] || nd.name ||
        item.name ||
        (item.display_name ? String(item.display_name).split(',')[0].trim() : q);
      const fullName = item.display_name
        ? String(item.display_name).split(',').slice(0, 3).map((s: string) => s.trim()).join(', ')
        : shortName;
      return {
        name: shortName,
        fullName,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        isNatural,
      };
    }).filter((p: PlaceResult) => !isNaN(p.lat) && !isNaN(p.lng));
  } catch {
    return [];
  }
}

/** 正向地理编码：地名 → 坐标。高德优先（国内覆盖全），无结果再用 OSM（海外兜底）。 */
export async function searchPlace(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (!q) return [];
  const amap = await searchPlaceAmap(q);
  if (amap.length > 0) return amap;
  // 高德没配 Key 或搜不到（多为海外地名）→ 用 OSM 兜底
  return searchPlaceOSM(q);
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
