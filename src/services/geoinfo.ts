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

/** 判断是否位于中国大致范围内（用于启用更精细的区域气候判断） */
function inChina(lat: number, lng: number): boolean {
  return lat >= 18 && lat <= 54 && lng >= 73 && lng <= 135;
}

/**
 * 综合气候带推算：结合纬度、经度（季风/干旱/高原分区）与海拔。
 * 目标是让新疆、银川、江南、青藏、东北等地给出各不相同的生态描述，
 * 而不是所有温带都统一成"四季分明、落叶林、候鸟迁徙"。
 */
function climateZone(
  lat: number,
  lng: number,
  elevation: number | null,
): { zone: string; hint: string } {
  const absLat = Math.abs(lat);

  // —— 高海拔优先：青藏高原及各地高山 ——
  if (elevation != null && elevation >= 3000) {
    return {
      zone: '🏔️ 高原 / 高山带',
      hint: '海拔高、空气稀薄、昼夜温差大，多高山草甸与耐寒植物，栖息着雪雀、岩羊等高原特有物种。',
    };
  }
  if (elevation != null && elevation >= 2000 && absLat < 45) {
    return {
      zone: '⛰️ 山地气候',
      hint: '随海拔升高气温递减，植被垂直分带明显，从山林到灌丛，常见山鸟与耐寒植物。',
    };
  }

  // —— 中国区域精细化：按经度粗分季风区 / 西北干旱区 / 高原区 ——
  if (inChina(lat, lng)) {
    // 西北干旱/半干旱区（大致新疆、河西、内蒙西部、宁夏一带：经度偏西且纬度中高）
    if (lng < 106 && lat >= 35) {
      if (lng < 96) {
        return {
          zone: '🏜️ 温带干旱区',
          hint: '深居内陆、降水稀少，以荒漠、戈壁和绿洲为主，胡杨、梭梭耐旱，鸟兽多逐水草而居。',
        };
      }
      return {
        zone: '🌾 温带半干旱草原',
        hint: '雨水偏少、蒸发旺盛，以草原与灌丛为主，是百灵、沙鸡等草原鸟类和黄羊的家园。',
      };
    }

    // 东北（高纬季风区）
    if (lat >= 42 && lng >= 120) {
      return {
        zone: '🌲 温带针阔混交林',
        hint: '冬季严寒漫长、夏季短暂，针阔混交林广布，是东北虎、马鹿与众多繁殖候鸟的栖息地。',
      };
    }

    // 华北暖温带（季风区）
    if (lat >= 33) {
      return {
        zone: '🍂 暖温带季风区',
        hint: '四季分明、雨热同期，以落叶阔叶林为主，是华北平原众多候鸟春秋迁徙的必经之路。',
      };
    }

    // 华中 / 江南亚热带（季风区）
    if (lat >= 23.5) {
      return {
        zone: '🍊 亚热带季风区',
        hint: '夏热冬暖、雨量充沛，常绿阔叶林繁茂，竹林密布，物种丰富，白鹭、画眉等鸟类常见。',
      };
    }

    // 华南 / 海南热带
    return {
      zone: '🌴 热带 / 南亚热带',
      hint: '全年温暖湿润，雨林与季雨林发育，色彩艳丽的鸟类、蝴蝶与阔叶植物极为丰富。',
    };
  }

  // —— 中国以外：回退到基于纬度的全球通用分带 ——
  if (absLat < 10) {
    return { zone: '🌴 热带雨林带', hint: '全年高温多雨，物种极其丰富，常见色彩艳丽的鸟类与阔叶植物。' };
  } else if (absLat < 23.5) {
    return { zone: '🌺 热带 / 亚热带', hint: '温暖湿润，四季常绿植物多，是众多留鸟与昆虫的乐园。' };
  } else if (absLat < 35) {
    return { zone: '🍊 亚热带', hint: '夏热冬温，常绿与落叶植物混生，鸟类种类多样。' };
  } else if (absLat < 50) {
    return { zone: '🍂 温带', hint: '四季分明，落叶林为主，是许多候鸟迁徙途经或繁殖之地。' };
  } else if (absLat < 66.5) {
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
  // 先取海拔，再结合纬度/经度/海拔综合判断气候带
  const elevation = await fetchElevation(lat, lng);
  const { zone, hint } = climateZone(lat, lng, elevation);
  return {
    latText,
    lngText,
    elevation,
    climateZone: zone,
    climateHint: hint,
  };
}
