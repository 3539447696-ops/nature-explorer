import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type L from 'leaflet';
import { Tag, Notification, Loading } from 'animal-island-ui';
import { useAuth } from './contexts/AuthContext';
import { AuthPage } from './components/AuthPage';
import { MapView } from './components/MapView';
import { SearchBar } from './components/SearchBar';
import { SpeciesCard } from './components/SpeciesCard';
import { SpeciesDetailModal } from './components/SpeciesDetailModal';
import { CollectionDrawer } from './components/CollectionDrawer';
import { AIDrawer } from './components/AIDrawer';
import { UserDrawer } from './components/UserDrawer';
import { CommunityDrawer } from './components/CommunityDrawer';
import { SharePanel } from './components/SharePanel';
import {
  fetchNearbySpecies, reverseGeocode, isScenicAreaName, haversineDistanceKm, RADIUS_BY_SCENE,
  type PlaceResult,
} from './services/inaturalist';
import { CollectionService } from './services/collection';
import { getGeoInfo, fetchElevationsBatch, isMountainousArea, getElevationBandLabel, type GeoInfo } from './services/geoinfo';
import { FILTERS, DEFAULT_LATLNG, getTaxonMeta, countByTaxon, pickBalancedSample } from './constants';
import type { Species } from './types';

// 底部列表默认精选数量：旅行者需要"快速掌握重点"，不是"看到全部"
const TOP_N_SPECIES = 12;

export default function App() {
  const { user, loading: authLoading, configured } = useAuth();

  // 认证门禁：配置了云端且未登录 → 显示登录页（可跳过）
  const [skippedAuth, setSkippedAuth] = useState(false);
  const showAuth = configured && !user && !skippedAuth;

  // 地图与数据状态
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [geoInfo, setGeoInfo] = useState<GeoInfo | null>(null);
  const [species, setSpecies] = useState<Species[]>([]);
  const [loadingSpecies, setLoadingSpecies] = useState(false);
  const [filter, setFilter] = useState('all');
  const [trayOpen, setTrayOpen] = useState(true);
  const mapRef = useRef<L.Map | null>(null);

  // 各分类数量统计，用于过滤器 Tag 加实时角标（如"🐦鸟类 23"）
  const taxonCounts = useMemo(() => countByTaxon(species), [species]);

  // 底部列表默认只显示 Top N（分类均衡精选），点击"查看全部"才展开完整列表
  const [showAllSpecies, setShowAllSpecies] = useState(false);
  const displaySpecies = useMemo(
    () => (showAllSpecies ? species : pickBalancedSample(species, TOP_N_SPECIES)),
    [species, showAllSpecies],
  );

  // 图鉴
  const [collection, setCollection] = useState<Species[]>([]);
  const collectedIds = new Set(collection.map((s) => s.id));
  const collectionRef = useRef<Species[]>([]);
  collectionRef.current = collection;

  // 弹窗状态
  const [detailSpecies, setDetailSpecies] = useState<Species | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSpecies, setAiSpecies] = useState<Species | null>(null);
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const [showMapHint, setShowMapHint] = useState(true);
  // 社区
  const [communityOpen, setCommunityOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSpecies, setShareSpecies] = useState<Species | null>(null);
  const [communityRefresh, setCommunityRefresh] = useState(0);

  const userId = user?.id ?? null;

  /* ---------- 启动定位 ---------- */
  useEffect(() => {
    if (showAuth) return; // 未通过门禁不加载
    locateUser();
    const t = setTimeout(() => setSplashGone(true), 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAuth]);

  /* ---------- 加载图鉴（登录状态变化时） ---------- */
  useEffect(() => {
    if (showAuth) return;
    (async () => {
      // 登录后先把本地收藏合并上云
      if (userId) {
        const migrated = await CollectionService.migrateLocalToCloud(userId);
        if (migrated > 0) Notification.success(`已把 ${migrated} 个本地收藏同步到云端 ☁️`);
      }
      const all = await CollectionService.getAll(userId);
      setCollection(all);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, showAuth]);

  /* ---------- 物种加载 ---------- */
  // 记录本次实际生效的搜索半径 + 是否山地分层模式，供标题区展示范围说明
  const [rangeInfo, setRangeInfo] = useState<{ radiusKm: number; isMountainous: boolean } | null>(null);

  const loadSpecies = useCallback(async (lat: number, lng: number, flt: string, placeName?: string | null) => {
    setLoadingSpecies(true);
    setTrayOpen(true);
    setShowAllSpecies(false); // 新一批数据，重新从"精选"视图开始看

    // 场景化半径：景区/自然地物用更大范围覆盖整个景区，城市/日常场景贴合"步行可达"直觉
    const isScenic = isScenicAreaName(placeName);
    const baseRadius = isScenic ? RADIUS_BY_SCENE.scenic : RADIUS_BY_SCENE.city;

    const result = await fetchNearbySpecies(lat, lng, baseRadius, flt);
    let data = result.data;

    // 用真实观测坐标批量查海拔 → 判断是否山地地形 → 给每个物种标注"距离"或"海拔层级"
    const withCoords = data.filter((s) => s.lat != null && s.lng != null);
    let mountainous = false;
    if (withCoords.length > 0) {
      const elevations = await fetchElevationsBatch(withCoords.map((s) => ({ lat: s.lat!, lng: s.lng! })));
      mountainous = isMountainousArea(elevations);
      const elevationMap = new Map<string, number>();
      withCoords.forEach((s, i) => {
        if (elevations[i] != null) elevationMap.set(s.id, elevations[i]!);
      });
      data = data.map((s) => {
        if (s.lat == null || s.lng == null) return s;
        const elevation = elevationMap.get(s.id);
        if (mountainous && elevation != null) {
          return { ...s, elevationM: elevation, elevationBand: getElevationBandLabel(elevation) };
        }
        const distanceKm = haversineDistanceKm(lat, lng, s.lat, s.lng);
        return { ...s, distanceKm: Math.round(distanceKm * 10) / 10 };
      });
    }

    setSpecies(data);
    setLoadingSpecies(false);
    setRangeInfo({ radiusKm: result.usedRadiusKm ?? baseRadius, isMountainous: mountainous });
    if (result.source === 'fallback') {
      Notification.info({ message: '未能连接实时数据库', description: '已展示离线示例物种' });
    } else if (data.length === 0) {
      Notification.info('这附近暂无记录，换个位置试试～');
    } else if (result.usedRadiusKm && result.usedRadiusKm > baseRadius) {
      // 触发了半径智能降级：告知用户数据来自更大范围，避免"这也算附近？"的困惑
      Notification.info(`这附近记录较少，已自动扩大搜索范围到 ${result.usedRadiusKm}km 🔍`);
    }
  }, []);

  /* ---------- 定位 ---------- */
  const locateUser = useCallback(() => {
    const applyLocation = async (lat: number, lng: number) => {
      setCenter([lat, lng]);
      setGeoInfo(null);
      const name = await reverseGeocode(lat, lng);
      setLocationName(name);
      loadSpecies(lat, lng, filter, name);
      getGeoInfo(lat, lng).then(setGeoInfo);
    };
    if (!navigator.geolocation) {
      applyLocation(DEFAULT_LATLNG[0], DEFAULT_LATLNG[1]);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => applyLocation(pos.coords.latitude, pos.coords.longitude),
      () => {
        Notification.warning('定位失败，使用默认位置（北京）');
        applyLocation(DEFAULT_LATLNG[0], DEFAULT_LATLNG[1]);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [filter, loadSpecies]);

  /* ---------- 在地图当前中心刷新 ---------- */
  const refreshHere = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    setCenter([c.lat, c.lng]);
    setGeoInfo(null);
    const name = await reverseGeocode(c.lat, c.lng);
    setLocationName(name);
    loadSpecies(c.lat, c.lng, filter, name);
    getGeoInfo(c.lat, c.lng).then(setGeoInfo);
  }, [filter, loadSpecies]);

  /* ---------- 点击地图任意位置 → 探索该地点 ----------
   * presetName: 若传入（如搜索选中"黄山"），直接用它作标题，不再反查行政区；
   *             为空时才回退到 reverseGeocode。 */
  const exploreLocation = useCallback(async (lat: number, lng: number, presetName?: string) => {
    setShowMapHint(false);
    setCenter([lat, lng]);
    setGeoInfo(null);
    Notification.info('正在探索这个地点…');
    let name: string | null;
    if (presetName) {
      name = presetName;
      setLocationName(presetName);
    } else {
      name = await reverseGeocode(lat, lng);
      setLocationName(name);
    }
    loadSpecies(lat, lng, filter, name);
    getGeoInfo(lat, lng).then(setGeoInfo);
  }, [filter, loadSpecies]);

  /* ---------- 搜索框选中一个地点 ---------- */
  const onSearchSelect = useCallback((p: PlaceResult) => {
    // 自然地物（山川湖泊景点）→ 用其本名作标题，避免被套进行政区划；
    // 普通地址 → 传入较完整的名称，同样直接展示搜索到的地名。
    const title = p.isNatural ? p.name : (p.fullName || p.name);
    exploreLocation(p.lat, p.lng, title);
  }, [exploreLocation]);

  /* ---------- 切换分类 ---------- */
  const changeFilter = useCallback((f: string) => {
    setFilter(f);
    if (center) loadSpecies(center[0], center[1], f, locationName);
  }, [center, loadSpecies, locationName]);

  /* ---------- AI 向导内跳转到攻略目的地探索（供 AIDrawer 里"开始探索"按钮调用） ---------- */
  const handleExplorePlanDestination = useCallback((lat: number, lng: number, destination: string) => {
    setAiOpen(false);
    exploreLocation(lat, lng, destination);
  }, [exploreLocation]);

  /* ---------- 打开物种详情 ---------- */
  const openDetail = useCallback((s: Species) => {
    setDetailSpecies(s);
    setDetailOpen(true);
  }, []);

  /* ---------- 收集 / 取消收集 ---------- */
  const toggleCollect = useCallback(async (s: Species) => {
    // 用最新的 collection 判断是否已收集，避免闭包过期
    const already = collectionRef.current.some((x) => x.id === s.id);
    if (already) {
      await CollectionService.remove(s.id, userId);
      setCollection((prev) => prev.filter((x) => x.id !== s.id));
      Notification.info('已从图鉴中移除');
    } else {
      const ok = await CollectionService.add({ ...s, location: locationName }, userId);
      if (ok) {
        setCollection((prev) => [{ ...s, location: locationName, collectedAt: Date.now() }, ...prev]);
        celebrate(getTaxonMeta(s.taxon).icon);
        Notification.success(`🎉 「${s.cn_name}」已收入图鉴！`);
      }
    }
  }, [userId, locationName]);

  /* ---------- 从详情问 AI ---------- */
  const askAI = useCallback((s: Species) => {
    setDetailOpen(false);
    setAiSpecies(s);
    setAiOpen(true);
  }, []);

  /* ---------- 从物种详情分享 ---------- */
  const shareSpeciesFromDetail = useCallback((s: Species) => {
    setDetailOpen(false);
    setShareSpecies(s);
    setShareOpen(true);
  }, []);

  /* ---------- 发帖成功后 ---------- */
  const onPosted = useCallback(() => {
    setCommunityRefresh((v) => v + 1);
    Notification.success('🎉 分享成功！已发布到社区');
  }, []);

  const avatarLetter = (user?.email || '游')[0].toUpperCase();

  /* ---------- 门禁：登录页 ---------- */
  if (authLoading) {
    return <div className="center-loading"><Loading /></div>;
  }
  if (showAuth) {
    return <AuthPage onSkip={() => setSkippedAuth(true)} />;
  }

  return (
    <div className="app-shell">
      {/* 启动屏 */}
      {!splashGone && (
        <div className={`splash ${center ? 'hide' : ''}`}>
          <div className="splash-inner">
            <div className="splash-logo">🌿</div>
            <div className="splash-title">自然探索家</div>
            <div className="splash-sub">NATURE EXPLORER</div>
          </div>
        </div>
      )}

      {/* 地图 */}
      <MapView
        center={center}
        species={species}
        collectedIds={collectedIds}
        onMarkerClick={openDetail}
        onMapClick={exploreLocation}
        onMapRef={(m) => (mapRef.current = m)}
      />

      {/* 顶栏 */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-logo">🌿</span>
          <div className="brand-text">
            <strong>自然探索家</strong>
            <small>{locationName ? `📍 ${locationName}` : '正在定位…'}</small>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="round-btn" title="回到我的位置" onClick={locateUser}>📍</button>
          <button className="round-btn" title="自然社区" onClick={() => setCommunityOpen(true)}>🌍</button>
          <button className="round-btn" title="我的图鉴" onClick={() => setCollectionOpen(true)}>
            📖{collection.length > 0 && <span className="count-badge">{collection.length}</span>}
          </button>
          <div className="avatar-btn" title="我的" onClick={() => setUserDrawerOpen(true)}>
            {avatarLetter}
          </div>
        </div>
      </header>

      {/* 地点搜索框 */}
      <SearchBar onSelect={onSearchSelect} />

      {/* 分类过滤（带实时数量角标，方便一眼看出哪类多哪类少） */}
      <div className="filter-bar">
        {FILTERS.map((f) => {
          const count = f.value === 'all' ? species.length : (taxonCounts[f.value] || 0);
          return (
            <Tag
              key={f.value}
              color={filter === f.value ? 'app-green' : 'default'}
              variant={filter === f.value ? 'solid' : 'outlined'}
              onClick={() => changeFilter(f.value)}
            >
              {f.label}{count > 0 ? ` ${count}` : ''}
            </Tag>
          );
        })}
      </div>

      {/* 点击地图探索的引导提示 */}
      {showMapHint && (
        <div className="map-hint" onClick={() => setShowMapHint(false)}>
          👆 点击地图上任意位置，探索那里的动植物（比如拉萨、三亚、你的家乡…）
          <span className="map-hint-close">✕</span>
        </div>
      )}

      {/* 底部物种托盘 */}
      <div className={`tray ${trayOpen ? 'open' : ''}`}>
        <div className="tray-handle" onClick={() => setTrayOpen((v) => !v)} />
        <div className="tray-header">
          <h2 onClick={() => setTrayOpen((v) => !v)}>
            {loadingSpecies ? '正在探索附近的生物…' : locationName ? `${locationName}附近的生物` : '附近的生物'}
            {!loadingSpecies && species.length > TOP_N_SPECIES && (
              <span className="tray-subtitle">
                {showAllSpecies ? ` · 共 ${species.length} 种` : ` · 精选 ${Math.min(TOP_N_SPECIES, species.length)}/${species.length} 种`}
              </span>
            )}
          </h2>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="suggestion-chip" onClick={refreshHere}>🔄 刷新</button>
            <button className="tray-toggle-btn" onClick={() => setTrayOpen((v) => !v)}>
              {trayOpen ? '收起 ▾' : '展开 ▴'}
            </button>
          </div>
        </div>

        {/* 地点自然信息 + 当前搜索范围说明（解决"为什么附近有这个物种"的困惑） */}
        {geoInfo && (
          <div className="geo-info">
            <span className="geo-chip">🧭 {geoInfo.latText}, {geoInfo.lngText}</span>
            {geoInfo.elevation != null && (
              <span className="geo-chip">⛰️ 海拔 {geoInfo.elevation} m</span>
            )}
            <span className="geo-chip">{geoInfo.climateZone}</span>
            {rangeInfo && (
              <span className="geo-chip geo-chip-range">
                🔍 搜索范围 {rangeInfo.radiusKm}km{rangeInfo.isMountainous ? '（按海拔分层）' : ''}
              </span>
            )}
            <div className="geo-hint">🌿 {geoInfo.climateHint}</div>
            <div className="geo-hint geo-source-hint">
              📊 以下物种数据来自 iNaturalist 全球公民科学社区的真实观测记录
            </div>
          </div>
        )}
        <div className="tray-list">
          {loadingSpecies ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-card" />)
          ) : species.length === 0 ? (
            <div className="tray-empty">这附近暂时没有找到记录，试着移动地图或切换分类～</div>
          ) : (
            <>
              {displaySpecies.map((s) => (
                <SpeciesCard key={s.id} species={s} collected={collectedIds.has(s.id)} onClick={() => openDetail(s)} />
              ))}
              {species.length > TOP_N_SPECIES && (
                <button className="show-more-btn" onClick={() => setShowAllSpecies((v) => !v)}>
                  {showAllSpecies ? '▴ 收起，只看精选' : `▾ 查看全部 ${species.length} 种`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* AI 浮动按钮 */}
      <button className="ai-fab" onClick={() => { setAiSpecies(null); setAiOpen(true); }}>
        <span className="ai-fab-icon">💬</span>
        <span>自然向导</span>
      </button>

      {/* 弹窗们 */}
      <SpeciesDetailModal
        species={detailSpecies}
        open={detailOpen}
        collected={detailSpecies ? collectedIds.has(detailSpecies.id) : false}
        onClose={() => setDetailOpen(false)}
        onToggleCollect={toggleCollect}
        onAskAI={askAI}
        onShareSpecies={shareSpeciesFromDetail}
        refreshKey={communityRefresh}
      />
      <CollectionDrawer
        open={collectionOpen}
        collection={collection}
        onClose={() => setCollectionOpen(false)}
        onSelect={(s) => { setCollectionOpen(false); openDetail(s); }}
      />
      <AIDrawer
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        currentSpecies={aiSpecies}
        location={locationName}
        centerLat={center?.[0] ?? null}
        centerLng={center?.[1] ?? null}
        onExploreDestination={handleExplorePlanDestination}
      />
      <UserDrawer
        open={userDrawerOpen}
        onClose={() => setUserDrawerOpen(false)}
        collectionCount={collection.length}
        onLoginRequest={() => setSkippedAuth(false)}
      />
      <CommunityDrawer
        open={communityOpen}
        onClose={() => setCommunityOpen(false)}
        onShareClick={() => { setShareSpecies(null); setShareOpen(true); }}
        refreshKey={communityRefresh}
      />
      <SharePanel
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        presetSpecies={shareSpecies}
        location={locationName}
        lat={center?.[0] ?? null}
        lng={center?.[1] ?? null}
        onPosted={onPosted}
      />
    </div>
  );
}

/* 集章庆祝动画 */
function celebrate(icon: string) {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;inset:0;z-index:4000;pointer-events:none;display:flex;align-items:center;justify-content:center';
  el.innerHTML = `<div style="font-size:120px;animation:stampPop .8s ease forwards">${icon}</div>`;
  if (!document.getElementById('stamp-pop-style')) {
    const style = document.createElement('style');
    style.id = 'stamp-pop-style';
    style.textContent =
      '@keyframes stampPop{0%{transform:scale(0) rotate(-30deg);opacity:0}50%{transform:scale(1.3) rotate(10deg);opacity:1}70%{transform:scale(.95)}100%{transform:scale(1.1);opacity:0}}';
    document.head.appendChild(style);
  }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 800);
}
