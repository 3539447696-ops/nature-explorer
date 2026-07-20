import type { Species } from './types';

/* 大类配置：图标、中文名、以及对应 animal-island-ui 的 Card/Tag 配色 */
export interface TaxonMeta {
  icon: string;
  cn: string;
  color: string;   // animal-island-ui CardColor / TagColor 命名
  markerColor: string; // 地图标记描边色（hex）
}

export const TAXON_CONFIG: Record<string, TaxonMeta> = {
  Aves:           { icon: '🐦', cn: '鸟类',     color: 'app-blue',   markerColor: '#889df0' },
  Plantae:        { icon: '🌱', cn: '植物',     color: 'app-green',  markerColor: '#8ac68a' },
  Mammalia:       { icon: '🦊', cn: '哺乳动物', color: 'app-orange', markerColor: '#e59266' },
  Insecta:        { icon: '🦋', cn: '昆虫',     color: 'purple',     markerColor: '#b77dee' },
  Reptilia:       { icon: '🦎', cn: '爬行动物', color: 'lime-green', markerColor: '#d1da49' },
  Amphibia:       { icon: '🐸', cn: '两栖动物', color: 'app-teal',   markerColor: '#82d5bb' },
  Actinopterygii: { icon: '🐟', cn: '鱼类',     color: 'app-blue',   markerColor: '#5bb8d4' },
  Fungi:          { icon: '🍄', cn: '真菌',     color: 'app-red',    markerColor: '#fc736d' },
  Mollusca:       { icon: '🐚', cn: '软体动物', color: 'app-yellow', markerColor: '#f7cd67' },
  Arachnida:      { icon: '🕷️', cn: '蛛形类',   color: 'brown',      markerColor: '#9a835a' },
  Animalia:       { icon: '🐾', cn: '动物',     color: 'warm-peach-pink', markerColor: '#e18c6f' },
};

export function getTaxonMeta(taxon: string): TaxonMeta {
  return TAXON_CONFIG[taxon] || { icon: '🌿', cn: '生物', color: 'default', markerColor: '#9f927d' };
}

// 顶部分类过滤器
export const FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'Aves', label: '🐦 鸟类' },
  { value: 'Plantae', label: '🌱 植物' },
  { value: 'Mammalia', label: '🦊 哺乳' },
  { value: 'Insecta', label: '🦋 昆虫' },
];

// 默认位置（定位失败时）：北京
export const DEFAULT_LATLNG: [number, number] = [39.9042, 116.4074];

/* ---------- 离线降级数据（网络/API 失败时使用） ---------- */
export const FALLBACK_SPECIES: Species[] = [
  {
    id: 'fb-13858', cn_name: '家燕', sci_name: 'Hirundo rustica', taxon: 'Aves',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Hirundo_rustica_-Saxony%2C_Germany-8.jpg/400px-Hirundo_rustica_-Saxony%2C_Germany-8.jpg',
    wiki: '家燕是一种广泛分布的候鸟，以其分叉的尾羽和敏捷的飞行著称。常在人类建筑屋檐下筑巢，以飞行中的昆虫为食，是农田的好帮手。',
  },
  {
    id: 'fb-12727', cn_name: '树麻雀', sci_name: 'Passer montanus', taxon: 'Aves',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Tree_Sparrow_Japan_Flip.jpg/400px-Tree_Sparrow_Japan_Flip.jpg',
    wiki: '树麻雀是城市与乡村最常见的鸟类之一，头顶栗褐色、脸颊有黑斑。适应力极强，常成群活动，杂食性。',
  },
  {
    id: 'fb-14886', cn_name: '白鹡鸰', sci_name: 'Motacilla alba', taxon: 'Aves',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Motacilla_alba_02_II.jpg/400px-Motacilla_alba_02_II.jpg',
    wiki: '白鹡鸰体态纤细，尾巴上下摆动是它的标志性动作。常在水边、草地行走觅食昆虫，鸣声清脆。',
  },
  {
    id: 'fb-8021', cn_name: '珠颈斑鸠', sci_name: 'Spilopelia chinensis', taxon: 'Aves',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Spilopelia_chinensis_-_Kaeng_Krachan.jpg/400px-Spilopelia_chinensis_-_Kaeng_Krachan.jpg',
    wiki: '珠颈斑鸠颈部有黑底白斑如珍珠项链，是城市公园常见鸟。鸣声低沉如“咕咕咕”，性格温顺。',
  },
  {
    id: 'fb-48662', cn_name: '蒲公英', sci_name: 'Taraxacum officinale', taxon: 'Plantae',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Dandelion_%28Taraxacum_officinale%29.jpg/400px-Dandelion_%28Taraxacum_officinale%29.jpg',
    wiki: '蒲公英开黄色花，果实为带绒毛的种子可随风飘散。全株可入药，嫩叶可食，是极具生命力的先锋植物。',
  },
  {
    id: 'fb-47603', cn_name: '车前草', sci_name: 'Plantago asiatica', taxon: 'Plantae',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Plantago_major_20050703_248.jpg/400px-Plantago_major_20050703_248.jpg',
    wiki: '车前草叶片呈莲座状贴地生长，穗状花序直立。常见于路边、田野，耐踩踏，是传统药用植物。',
  },
  {
    id: 'fb-55745', cn_name: '狗尾草', sci_name: 'Setaria viridis', taxon: 'Plantae',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Setaria_viridis_20050807_248.jpg/400px-Setaria_viridis_20050807_248.jpg',
    wiki: '狗尾草因毛茸茸的圆锥花序形似狗尾而得名，是最常见的野草之一，适应性强，遍布荒地与田埂。',
  },
  {
    id: 'fb-51702', cn_name: '西方蜜蜂', sci_name: 'Apis mellifera', taxon: 'Insecta',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Apis_mellifera_flying2.jpg/400px-Apis_mellifera_flying2.jpg',
    wiki: '西方蜜蜂是重要的传粉昆虫，过着高度社会化的群体生活。采集花蜜酿蜜，对农业生态系统至关重要。',
  },
  {
    id: 'fb-58583', cn_name: '菜粉蝶', sci_name: 'Pieris rapae', taxon: 'Insecta',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Pieris_rapae_-_Kelheim_003.jpg/400px-Pieris_rapae_-_Kelheim_003.jpg',
    wiki: '菜粉蝶翅膀白色带黑点，是最常见的蝴蝶之一。幼虫（菜青虫）取食十字花科植物，成虫访花传粉。',
  },
  {
    id: 'fb-46017', cn_name: '七星瓢虫', sci_name: 'Coccinella septempunctata', taxon: 'Insecta',
    photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Coccinella_septempunctata_qtl1.jpg/400px-Coccinella_septempunctata_qtl1.jpg',
    wiki: '七星瓢虫红色鞘翅上有七个黑点，是著名的益虫，捕食蚜虫，被誉为“活农药”。',
  },
];

/* 内置离线科普问答（无 AI API 时降级使用） */
export const OFFLINE_KNOWLEDGE: { keys: string[]; answer: string }[] = [
  { keys: ['迁徙', '候鸟', '飞走', '南飞'], answer: '许多鸟类会随季节迁徙，主要是为了追逐食物和适宜的气候。🍂 秋天北方变冷、食物减少，鸟儿便飞往温暖的南方越冬；春天再返回北方繁殖。它们依靠太阳、星辰、地磁场甚至地标来导航，堪称大自然的导航大师！' },
  { keys: ['蒲公英', '种子', '飞散', '绒毛'], answer: '蒲公英的种子顶端有一簇白色绒毛（冠毛），就像小降落伞。🪂 当风吹过，种子随风飘散到远方，帮助植物扩大分布范围。这是植物“借助风力传播”的经典策略。' },
  { keys: ['传粉', '蜜蜂', '授粉', '花'], answer: '传粉是植物繁殖的关键一步。🐝 蜜蜂、蝴蝶等昆虫在采蜜时，身上会沾满花粉，飞到另一朵花时把花粉带过去，帮助植物结出果实和种子。全球约 3/4 的农作物都依赖动物传粉！' },
  { keys: ['麻雀', '城市', '适应'], answer: '麻雀是最成功的“城市居民”之一。🏙️ 它们杂食、胆大、繁殖快，能在建筑缝隙筑巢，适应人类环境。正因如此，麻雀几乎遍布全世界的城镇乡村。' },
  { keys: ['瓢虫', '益虫', '蚜虫'], answer: '瓢虫是花园里的“守护者”！🐞 一只瓢虫一生能吃掉数千只蚜虫，因此被称为“活农药”。它们鲜艳的颜色其实是一种警告，提醒天敌“我不好吃”。' },
  { keys: ['保护', '濒危', '生态', '环保'], answer: '保护身边的自然，从小事做起：🌍 不干扰野生动物、不采摘野花野草、减少使用一次性塑料、在阳台种些本地植物为昆虫和鸟类提供栖息地。记录你观察到的物种也是公民科学的重要贡献哦。' },
];

export function matchOfflineKnowledge(question: string): string | null {
  const q = question.toLowerCase();
  for (const item of OFFLINE_KNOWLEDGE) {
    if (item.keys.some((k) => q.includes(k.toLowerCase()))) return item.answer;
  }
  return null;
}
