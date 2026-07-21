import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Species } from '../types';
import { getTaxonMeta } from '../constants';

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

  // 初始化地图（一次）
  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      zoomSnap: 0.5,           // 更平滑的缩放挡位
      wheelDebounceTime: 40,   // 滚轮缩放防抖，减少卡顿
      markerZoomAnimation: false,
    }).setView(center || [39.9042, 116.4074], 12);

    // 高德地图瓦片：中国境内全中文标注、国内加载快
    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
      maxZoom: 18,
      minZoom: 3,
      subdomains: '1234',
      updateWhenZooming: false,  // 缩放过程中不刷新瓦片，缩放更顺
      updateWhenIdle: false,     // 拖动时也加载，减少停下后才出图的空白
      keepBuffer: 6,             // 大幅增加缓存的周边瓦片，减少空白色块
    }).addTo(map);

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
    species.slice(0, 20).forEach((sp, i) => {
      let lat = sp._lat;
      let lng = sp._lng;
      if (lat == null || lng == null) {
        const angle = (i / 20) * Math.PI * 2 + (i * 2.399);
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
