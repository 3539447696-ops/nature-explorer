/* 地点自然信息 service
 * 提供：海拔（Open-Meteo 高程 API，免费无 Key）、气候带（按纬度推算）、经纬度格式化。
 * 用于点开地点时展示与动植物相关的自然背景。
 */

export interface GeoInfo {
  latText: string;      // 格式化纬度，如 "39.90°N"
  lngText: string;      // 格式化经度，如 "116.41°E"
  elevation: number | null; // 海拔（米）
  climateZone: string;  // 气候带
  climateHint: string;  // 与动植物相关的一句话说明
}

/** 格式化经纬度为带方向的字符串 */
function formatLatLng(lat: number, lng: number): { latText: string; lngText: string } {
  const latText = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
  const lngText = `${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`;
  return { latText, lngText };
}

/** 根据纬度推算气候带 + 生态说明 */
function climateByLatitude(lat: number): { zone: string; hint: string } {
  const abs = Math.abs(lat);
  if (abs < 10) {
    return { zone: '🌴 热带雨林带', hint: '全年高温多雨，物种极其丰富，常见色彩艳丽的鸟类与阔叶植物。' };
  } else if (abs < 23.5) {
    return { zone: '🌺 热带 / 亚热带', hint: '温暖湿润，四季常绿植物多，是众多留鸟与昆虫的乐园。' };
  } else if (abs < 35) {
    return { zone: '🍊 亚热带', hint: '夏热冬温，常绿与落叶植物混生，鸟类种类多样。' };
  } else if (abs < 50) {
    return { zone: '🍂 温带', hint: '四季分明，落叶林为主，是许多候鸟迁徙途经或繁殖之地。' };
  } else if (abs < 66.5) {
    return { zone: '🌲 寒温带 / 亚寒带', hint: '冬季漫长寒冷，针叶林广布，物种相对单一但独具特色。' };
  } else {
    return { zone: '❄️ 寒带 / 极地', hint: '气候严酷，植被稀疏，动物多有厚毛/脂肪等御寒适应。' };
  }
}

/** 获取海拔（Open-Meteo Elevation API，免费无需 Key） */
async function fetchElevation(lat: number, lng: number): Promise<number | null> {
  try {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = await res.json();
    const el = json.elevation?.[0];
    return typeof el === 'number' ? Math.round(el) : null;
  } catch {
    return null;
  }
}

/** 获取某坐标的自然背景信息 */
export async function getGeoInfo(lat: number, lng: number): Promise<GeoInfo> {
  const { latText, lngText } = formatLatLng(lat, lng);
  const { zone, hint } = climateByLatitude(lat);
  const elevation = await fetchElevation(lat, lng);
  return {
    latText,
    lngText,
    elevation,
    climateZone: zone,
    climateHint: hint,
  };
}
