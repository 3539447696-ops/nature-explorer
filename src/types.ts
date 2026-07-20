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
  // 地图上的展示坐标（前端分布）
  _lat?: number;
  _lng?: number;
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
