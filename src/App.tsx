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
import { OnboardingGuide } from './components/OnboardingGuide';
import { ShareCollectionModal } from './components/ShareCollectionModal';
import { UserDrawer } from './components/UserDrawer';
import { CommunityDrawer } from './components/CommunityDrawer';
import { SharePanel } from './components/SharePanel';
import {
  fetchNearbySpecies, reverseGeocode, isScenicAreaName, haversineDistanceKm, RADIUS_BY_SCENE,
  type PlaceResult,
} from './services/inaturalist';
import { CollectionService } from './services/collection';
import { getGeoInfo, fetchElevationsBatch, isMountainousArea, getElevationBandLabel, type GeoInfo } from './services/geoinfo';
import { FILTERS, DEFAULT_LATLNG, getTaxonMeta, countByTaxon, pickBalancedSample, assignRarity } from './constants';
import type { Species, TravelPlan } from './types';
import { PLAN_RADIUS_KM } from './services/travelPlan';

// 底部列表默认精选数量：旅行者需要"快速掌握重点"，不是"看到全部"
const TOP_N_SPECIES = 12;
const ONBOARDING_KEY = 'nature-explorer-onboarding-done';

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

  // 首次使用新手引导：三个任务——探索/查看详情/收集，走完核心价值路径
  const [onboardingDone, setOnboardingDone] = useState(() => localStorage.getItem(ONBOARDING_KEY) === '1');
  const [hasExploredManually, setHasExploredManually] = useState(false);
  const [hasViewedDetail, setHasViewedDetail] = useState(false);
  const onboardingAllDone = hasExploredManually && hasViewedDetail && collection.length > 0;

  // 图鉴分享：追踪"本次探索会话"新收集到的物种，累积到阈值主动引导分享战绩
  const SESSION_SHARE_THRESHOLD = 3;
  const [sessionCollected, setSessionCollected] = useState<Species[]>([]);
  const [showShareHint, setShowShareHint] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [shareCollectionOpen, setShareCollectionOpen] = useState(false);

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

    setSpecies(assignRarity(data));
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
    setHasExploredManually(true); // 新手任务①：主动探索过一个地点
    // 探索新地点 = 开始新的一次"出行会话"，重置本次收获追踪
    setSessionCollected([]);
    setShowShareHint(false);
    setHintDismissed(false);
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

  /* ---------- AI 向导内跳转到攻略目的地探索（知行合一：直接用攻略里已生成的推荐物种数据，
   * 而不是重新查询"当前"数据——保证用户在地图上看到的，正是攻略里推荐的那些真实观测点。 ---------- */
  const handleExplorePlanDestination = useCallback((plan: TravelPlan) => {
    setAiOpen(false);
    setShowMapHint(false);
    setSessionCollected([]);
    setShowShareHint(false);
    setHintDismissed(false);
    setCenter([plan.lat, plan.lng]);
    setLocationName(plan.destination);
    setFilter('all');
    setShowAllSpecies(false);
    setTrayOpen(true);

    // 攻略里的物种已经带真实坐标（来自 fetchSeasonalSpecies），直接注入，不重新发请求
    const planSpecies = plan.isMountainous
      ? plan.elevationBands.flatMap((b) => b.species)
      : plan.speciesHighlights;
    setSpecies(assignRarity(planSpecies));
    setRangeInfo({ radiusKm: PLAN_RADIUS_KM, isMountainous: plan.isMountainous });

    // 气候/海拔信息攻略里也已经有了，直接用现成数据组装，不必再查一次
    setGeoInfo({
      latText: `${Math.abs(plan.lat).toFixed(2)}°${plan.lat >= 0 ? 'N' : 'S'}`,
      lngText: `${Math.abs(plan.lng).toFixed(2)}°${plan.lng >= 0 ? 'E' : 'W'}`,
      elevation: plan.elevation,
      climateZone: plan.climateZone,
      climateHint: plan.narrative,
    });
    Notification.success(`已跳转到「${plan.destination}」，地图上标注的正是攻略推荐的观测点 🗺️`);
  }, []);

  /* ---------- 打开物种详情 ---------- */
  const openDetail = useCallback((s: Species) => {
    setDetailSpecies(s);
    setDetailOpen(true);
    setHasViewedDetail(true); // 新手任务②：查看过物种详情
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
        // 稀有度越高，收集反馈越隆重——制造"抽到好东西"的惊喜感
        const rarity = s.rarity || 'common';
        celebrate(getTaxonMeta(s.taxon).icon, rarity);
        if (rarity === 'epic') {
          Notification.success({ message: `💎 史诗发现！「${s.cn_name}」`, description: '这是这片区域很少被记录到的物种，很难得！' });
        } else if (rarity === 'rare') {
          Notification.success({ message: `🔵 稀有收获！「${s.cn_name}」`, description: '已收入图鉴，这个不常见哦～' });
        } else {
          Notification.success(`🎉 「${s.cn_name}」已收入图鉴！`);
        }
        // 追踪本次会话新收获，累积到阈值主动引导分享战绩（这才是真正适合发社交平台的内容）
        setSessionCollected((prev) => {
          const next = [...prev, s];
          if (next.length >= SESSION_SHARE_THRESHOLD && !hintDismissed) setShowShareHint(true);
          return next;
        });
      }
    }
  }, [userId, locationName, hintDismissed]);

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

      {/* 首次使用新手任务引导 */}
      {!onboardingDone && (
        <OnboardingGuide
          tasks={[
            { key: 'explore', icon: '🗺️', label: '探索一个地点', done: hasExploredManually },
            { key: 'view', icon: '🔍', label: '查看一个物种详情', done: hasViewedDetail },
            { key: 'collect', icon: '📖', label: '收集你的第一个物种', done: collection.length > 0 },
          ]}
          allDone={onboardingAllDone}
          onAllDone={() => {
            localStorage.setItem(ONBOARDING_KEY, '1');
            setOnboardingDone(true);
          }}
        />
      )}

      {/* 本次收获达到阈值 → 主动引导分享战绩（这才是真正适合发朋友圈的内容） */}
      {showShareHint && (
        <div className="collect-share-hint" onClick={() => setShareCollectionOpen(true)}>
          <span className="collect-share-hint-text">🎉 本次已发现 {sessionCollected.length} 种生物！记录下这次的收获吧</span>
          <div className="collect-share-hint-actions">
            <button className="collect-share-hint-btn" onClick={(e) => { e.stopPropagation(); setShareCollectionOpen(true); }}>
              📤 生成分享图
            </button>
            <button
              className="collect-share-hint-close"
              onClick={(e) => { e.stopPropagation(); setShowShareHint(false); setHintDismissed(true); }}
            >
              ✕
            </button>
          </div>
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
      <ShareCollectionModal
        species={sessionCollected}
        location={locationName}
        open={shareCollectionOpen}
        onClose={() => setShareCollectionOpen(false)}
      />
    </div>
  );
}

/* 集章庆祝动画。稀有度越高，动画越隆重（更大、停留更久、带光效），
 * 制造"这次抽到好东西了"的惊喜感，强化收集的游戏感。 */
function celebrate(icon: string, rarity: 'common' | 'uncommon' | 'rare' | 'epic' = 'common') {
  const isEpic = rarity === 'epic';
  const isRare = rarity === 'rare';
  const fontSize = isEpic ? 160 : isRare ? 136 : 120;
  const duration = isEpic ? 1.3 : isRare ? 1.0 : 0.8;
  const glow = isEpic
    ? 'filter:drop-shadow(0 0 24px #b77dee) drop-shadow(0 0 44px #b77dee);'
    : isRare
      ? 'filter:drop-shadow(0 0 16px #5b9bd4);'
      : '';

  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;inset:0;z-index:4000;pointer-events:none;display:flex;align-items:center;justify-content:center';
  el.innerHTML = `<div style="font-size:${fontSize}px;${glow}animation:stampPop ${duration}s ease forwards">${icon}</div>`;
  if (!document.getElementById('stamp-pop-style')) {
    const style = document.createElement('style');
    style.id = 'stamp-pop-style';
    style.textContent =
      '@keyframes stampPop{0%{transform:scale(0) rotate(-30deg);opacity:0}50%{transform:scale(1.3) rotate(10deg);opacity:1}70%{transform:scale(.95)}100%{transform:scale(1.1);opacity:0}}';
    document.head.appendChild(style);
  }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration * 1000);
}
