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
      preferCanvas: true,     // 用 canvas 渲染，性能更好
      fadeAnimation: true,
    }).setView(center || [39.9042, 116.4074], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      minZoom: 3,
      subdomains: 'abcd',
      updateWhenIdle: true,     // 拖动停止后再加载瓦片，减少卡顿
      keepBuffer: 2,
    }).addTo(map);

    // 物种 marker 用图层组统一管理
    speciesLayerRef.current = L.layerGroup().addTo(map);

    // 点击地图空白处 → 切换到该地点探索
    map.on('click', (e: L.LeafletMouseEvent) => {
      mapClickRef.current?.(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    onMapRef?.(map);

    // 修复容器尺寸导致的渲染问题（绿色大色块的常见原因之一）
    setTimeout(() => map.invalidateSize(), 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 用户位置变化 → 移动视野 + 更新用户标记
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    // 保留当前缩放级别，只在首次或跨度大时才 setView
    map.setView(center, map.getZoom() || 13, { animate: true });
    map.invalidateSize();

    if (userMarkerRef.current) map.removeLayer(userMarkerRef.current);
    const icon = L.divIcon({
      className: '',
      html: '<div class="user-marker"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    userMarkerRef.current = L.marker(center, { icon, zIndexOffset: 1000 }).addTo(map);
  }, [center]);

  // 物种变化 → 重绘 marker（用图层组，避免逐个操作卡顿）
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
  }, [species, collectedIds, center]);

  return <div id="map" />;
}
