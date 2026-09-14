/* 共享类型定义 */

// 社区分享帖子
export interface Post {
  id: string;
  userId: string;
  userEmail?: string | null;
  speciesId?: string | null;
  speciesCn?: string | null;
  speciesSci?: string | null;
  taxon?: string | null;
  photoUrl: string;
  caption?: string | null;
  location?: string | null;
  lat?: number | null;
  lng?: number | null;
  createdAt: number;
}

// iconic taxon（物种大类）
export type TaxonName =
  | 'Aves'
  | 'Plantae'
  | 'Mammalia'
  | 'Insecta'
  | 'Reptilia'
  | 'Amphibia'
  | 'Actinopterygii'
  | 'Fungi'
  | 'Mollusca'
  | 'Arachnida'
  | 'Animalia';

// 应用内部统一的物种数据结构
export interface Species {
  id: string;               // 唯一标识（inat-<taxonId> 或 fb-<id>）
  taxonId?: number | null;  // iNaturalist taxon id
  cn_name: string;          // 中文名（或通用名）
  sci_name: string;         // 学名
  taxon: string;            // 大类
  photo?: string | null;    // 图片 URL
  count?: number;           // 附近观测次数
  wiki?: string | null;     // 简介
  wikiUrl?: string | null;
  conservationStatus?: string | null;
  observationsCount?: number;
  rank?: string;
  location?: string | null; // 收集时的地点
  collectedAt?: number;     // 收集时间戳
  // 真实观测坐标（来自 iNaturalist observations 接口）
  lat?: number | null;
  lng?: number | null;
  // 地图上的展示坐标（无真实坐标时的散布兜底）
  _lat?: number;
  _lng?: number;
  // ---- 数据可解释性：让"为什么推荐这个"变得可追溯 ----
  distanceKm?: number;       // 到中心点的水平距离（平地场景展示用）
  elevationM?: number;       // 该观测点的海拔（山地场景用于分层）
  elevationBand?: string;    // 归类后的层级标签，如"🌳半山(300-800m)"（山地场景展示用）
}

// AI 对话消息
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// AI 上下文
export interface AIContext {
  currentSpecies?: Species | null;
  location?: string | null;
}

// 过滤器取值
export type FilterValue = 'all' | TaxonName;

/* ---------- AI 旅行攻略：数据结构 ---------- */

// 攻略生成请求（用户输入）
export interface TravelPlanRequest {
  destination: string; // 目的地展示名，如 "泰山"
  lat: number;
  lng: number;
  month: number;        // 出行月份 1-12（用于筛选历史同期真实观测）
  days?: number;         // 出行天数（可选，影响路线建议的详略）
}

// 海拔分层里的一段（如"半山"）
export interface ElevationBand {
  label: string;          // "🏞️ 山脚" / "🌳 半山" / "🏔️ 山顶"
  minElevation: number;
  maxElevation: number;
  lat: number;            // 该带的代表采样坐标（用于地图预标注）
  lng: number;
  species: Species[];     // 该海拔带的推荐物种（含真实观测次数）
  observationCount: number; // 该带汇总观测次数，用于"数据可信度"标注
}

// 完整的一份 AI 旅行攻略
export interface TravelPlan {
  destination: string;
  lat: number;
  lng: number;
  month: number;
  days?: number;
  isMountainous: boolean;         // 是否触发了海拔分层模式
  elevationBands: ElevationBand[]; // 山地类目的地：分层数据；非山地为空数组
  speciesHighlights: Species[];    // 非山地目的地：平铺的物种推荐（或分层模式下的"综合精选"）
  totalObservations: number;       // 总真实观测次数（核心可信度指标）
  climateZone: string;             // 气候带描述（复用 geoinfo 的推算）
  elevation: number | null;        // 目的地中心海拔
  bestTimeHint: string;            // 最佳观察时段建议（AI生成）
  equipmentTips: string;           // 装备提示（AI生成）
  routeHint: string;               // 简易路线建议（AI生成）
  narrative: string;               // 攻略正文（AI生成，有温度的文案）
  generatedAt: number;
}
