import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Species } from '../types';
import { getTaxonMeta, pickBalancedSample } from '../constants';
import { outOfChina } from '../services/inaturalist';

interface MapViewProps {
  center: [number, number] | null;
  species: Species[];
  collectedIds: Set<string>;
  onMarkerClick: (s: Species) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onMapRef?: (map: L.Map) => void;
}

/** Leaflet 地图。物种以自定义 marker 撒在用户周围。点击地图空白处可切换探索地点。 */
export function MapView({ center, species, collectedIds, onMarkerClick, onMapClick, onMapRef }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const speciesLayerRef = useRef<L.LayerGroup | null>(null);
  const lastCenterRef = useRef<string>('');
  const clickRef = useRef(onMarkerClick);
  clickRef.current = onMarkerClick;
  const mapClickRef = useRef(onMapClick);
  mapClickRef.current = onMapClick;
  // 双底图：高德只详细覆盖中国境内（境外几乎是空白瓦片、没有任何路网/地名标注），
  // 境外区域自动切换到全球覆盖的 OSM 瓦片，保证任何地方都能看到基本的地点标识。
  const amapLayerRef = useRef<L.TileLayer | null>(null);
  const osmLayerRef = useRef<L.TileLayer | null>(null);

  // 初始化地图（一次）
  useEffect(() => {
    if (mapRef.current) return;
    const initCenter = center || [39.9042, 116.4074];
    const map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      zoomSnap: 0.5,           // 更平滑的缩放挡位
      wheelDebounceTime: 40,   // 滚轮缩放防抖，减少卡顿
      markerZoomAnimation: false,
    }).setView(initCenter, 12);

    // 高德地图瓦片：中国境内全中文标注、国内加载快
    const amapLayer = L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
      maxZoom: 18,
      minZoom: 3,
      subdomains: '1234',
      updateWhenZooming: false,  // 缩放过程中不刷新瓦片，缩放更顺
      updateWhenIdle: false,     // 拖动时也加载，减少停下后才出图的空白
      keepBuffer: 6,             // 大幅增加缓存的周边瓦片，减少空白色块
    });
    // OSM 瓦片：全球覆盖，作为境外区域的底图来源。
    // OSM 使用政策要求展示版权归属，这里补一个精简的归属控件——
    // 高德瓦片没配 attribution，实际只会在切到 OSM 时才显示这行小字，不影响国内的极简界面。
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 3,
      subdomains: 'abc',
      updateWhenZooming: false,
      updateWhenIdle: false,
      keepBuffer: 6,
      attribution: '© OpenStreetMap contributors',
    });
    L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map);
    amapLayerRef.current = amapLayer;
    osmLayerRef.current = osmLayer;
    (outOfChina(initCenter[0], initCenter[1]) ? osmLayer : amapLayer).addTo(map);

    speciesLayerRef.current = L.layerGroup().addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      mapClickRef.current?.(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    onMapRef?.(map);

    // 初始化后修正一次容器尺寸（消除首次渲染的空白色块）
    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 500);

    // 监听窗口大小变化，避免容器尺寸变化导致的空白
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 用户位置变化 → 移动视野（仅在 center 真正改变时，且不带动画避免卡顿）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    const key = `${center[0].toFixed(4)},${center[1].toFixed(4)}`;
    if (key !== lastCenterRef.current) {
      lastCenterRef.current = key;
      map.setView(center, map.getZoom() || 12, { animate: false });
    }

    // 每次探索地点变化时，检查是否跨越了中国境内/境外的边界，据此切换底图瓦片源，
    // 避免"到了国外一片空白、没有任何地点标识"（高德地图境外覆盖极少）。
    const amap = amapLayerRef.current;
    const osm = osmLayerRef.current;
    if (amap && osm) {
      const outside = outOfChina(center[0], center[1]);
      if (outside && map.hasLayer(amap)) {
        map.removeLayer(amap);
        osm.addTo(map);
      } else if (!outside && map.hasLayer(osm)) {
        map.removeLayer(osm);
        amap.addTo(map);
      }
    }

    if (userMarkerRef.current) map.removeLayer(userMarkerRef.current);
    const icon = L.divIcon({
      className: '',
      html: '<div class="user-marker"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    userMarkerRef.current = L.marker(center, { icon, zIndexOffset: 1000 }).addTo(map);
  }, [center]);

  // 物种变化 → 重绘 marker
  useEffect(() => {
    const map = mapRef.current;
    const layer = speciesLayerRef.current;
    if (!map || !layer || !center) return;
    layer.clearLayers();

    const [baseLat, baseLng] = center;
    // 上限从 20 提升到 50，且用"分类均衡采样"而非简单截取前 N 个 ——
    // 避免鸟类（观测数据量通常最大）占满所有名额，导致地图上看不到其他类别。
    const MAX_MARKERS = 50;
    const displayed = pickBalancedSample(species, MAX_MARKERS);
    displayed.forEach((sp, i) => {
      let lat = sp._lat;
      let lng = sp._lng;
      if (lat == null || lng == null) {
        const angle = (i / displayed.length) * Math.PI * 2 + (i * 2.399);
        const dist = 0.008 + ((i * 37) % 30) / 1000;
        lat = baseLat + Math.cos(angle) * dist;
        lng = baseLng + Math.sin(angle) * dist * 1.3;
        sp._lat = lat;
        sp._lng = lng;
      }
      const meta = getTaxonMeta(sp.taxon);
      const collected = collectedIds.has(sp.id);
      const icon = L.divIcon({
        className: '',
        html: `<div class="species-marker ${collected ? 'collected' : ''}" style="border-color:${meta.markerColor}"><span>${meta.icon}</span></div>`,
        iconSize: [42, 42],
        iconAnchor: [21, 42],
      });
      const marker = L.marker([lat, lng], { icon });
      marker.on('click', () => clickRef.current(sp));
      layer.addLayer(marker);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [species, collectedIds]);

  return <div id="map" />;
}
