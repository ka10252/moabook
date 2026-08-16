import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import { Book } from '@/types/book';
import { getStation, MRT_STATIONS, MrtStation } from '@/data/mrtStations';
import { useTheme } from '@/hooks/useTheme';

/**
 * 책을 "가까운 MRT역" 단위로 실제 지도에 띄우는 뷰.
 *
 * 왜 정확한 위치가 아니라 역인가 —
 * 자전거 앱은 자전거가 길가에 있으니 좌표를 그대로 찍어도 된다. 책은 남의 집에 있다.
 * 책마다 핀을 찍으면 지도가 곧 주소록이 되고, 한 사람이 10권을 올리면 그 집 위에
 * 핀이 10개 겹쳐 위치가 더 선명해진다. 역 단위 마커는 반대로 움직인다 —
 * 책이 모일수록 마커 숫자만 커지고 개인은 흐려진다.
 *
 * 마커가 역의 실제 좌표에 찍히는 건 괜찮다. 역은 공공장소이고, 확대해도
 * 드러나는 건 역뿐이라 집 위치로 이어지지 않는다.
 *
 * 타일은 CARTO Voyager(라이트) / Dark Matter(다크)의 **라벨 없는 판**이다.
 * 색은 Voyager 그대로(도로·녹지·물이 구분됨) 두고 글자만 뺐다.
 * 라벨 있는 판을 쓰면 타일이 그린 역 이름과 우리가 그린 역 이름이 **같은 자리에 두 번** 찍힌다.
 * 그래서 **역 이름은 우리가 전담한다**(mrtStations.ts 109개역).
 *
 * 타일이 주는 역 표시에 기대지 않는 이유:
 *  ① 라이트·다크가 같은 규칙으로 보인다. Voyager는 라이트에만 역이 있고 다크판이 없어
 *     테마를 바꾸면 역이 통째로 사라졌다.
 *  ② 어느 줌에서 어떤 역을 보여줄지 우리가 정한다. 타일에 맡기면 통제가 안 된다.
 *  ③ 타일 제공자를 바꿔도 역 표시는 그대로 남는다.
 *
 * 무료·키 없음이지만 대량 트래픽은 정책 위반이라, 유저가 늘면 URL 한 줄만 갈아끼운다.
 */

const SG_CENTER: L.LatLngExpression = [1.3421, 103.8198];
const SG_BOUNDS = L.latLngBounds([1.16, 103.55], [1.50, 104.12]);

const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
} as const;
const TILE_ATTR = '&copy; OpenStreetMap &copy; CARTO';

/**
 * 역 레이어 표시 규칙.
 * 109개를 다 띄우면 축소했을 때 점 밭이 되고, 이름까지 붙이면 서로 겹쳐 아무것도 못 읽는다.
 *  - 12 미만: 아예 안 그린다 (섬 전체가 보이는 단계)
 *  - 12: 점만
 *  - 13 이상: 점 + 역 이름
 * 그리고 책이 있는 역은 우리 책 마커가 이미 그 자리를 쓰므로 건너뛴다.
 */
const ZOOM_DOTS = 12;
const ZOOM_LABELS = 13;

interface Props {
  books: Book[];
  onSelectBook: (book: Book) => void;
  myStationId?: string | null;
}

interface Cluster {
  station: MrtStation;
  books: Book[];
}

/** 마커 = 흰 원 + 책 아이콘 + 권수 배지. 자전거 앱 핀과 같은 읽기 방식이다. */
function markerHtml(count: number, active: boolean) {
  const ring = active ? 'var(--moa-marker-active)' : 'var(--moa-marker)';
  return `
    <div class="moa-marker${active ? ' is-active' : ''}" style="--ring:${ring}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 2h11a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Zm0 2a1 1 0 0 0-1 1v11.17A2.99 2.99 0 0 1 6 16h11V4H6Zm0 14a1 1 0 1 0 0 2h11v-2H6Z"/>
      </svg>
      <span class="moa-marker-count">${count}</span>
    </div>`;
}

/**
 * 마커를 누르면 뜨는 말풍선. Leaflet 팝업은 정적 HTML만 받으므로
 * DOM을 직접 만들어 클릭 핸들러를 붙인다(문자열 HTML이면 책을 눌러도 아무 일이 없다).
 */
function buildPopup(c: Cluster, onPick: (book: Book) => void): HTMLElement {
  const root = document.createElement('div');
  root.className = 'moa-pop';

  const head = document.createElement('div');
  head.className = 'moa-pop-head';
  head.innerHTML =
    `<b>${c.station.name}</b><span>${c.station.nameKo}</span>` +
    `<em>${c.books.length}권</em>`;
  root.appendChild(head);

  const list = document.createElement('div');
  list.className = 'moa-pop-list';
  c.books.slice(0, 8).forEach((book) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'moa-pop-row';
    const thumb = book.cover
      ? `<img src="${book.cover}" alt="" loading="lazy">`
      : `<span class="moa-pop-noimg"></span>`;
    row.innerHTML =
      `<span class="moa-pop-thumb">${thumb}</span>` +
      `<span class="moa-pop-meta">` +
      `<span class="moa-pop-title"></span>` +
      `<span class="moa-pop-author"></span>` +
      `</span>` +
      (book.status === 'rented' ? `<span class="moa-pop-tag">대여중</span>` : '');
    // 제목·저자는 textContent로 넣는다 — 책 제목에 <를 쓴 사람이 있어도 안전하게.
    (row.querySelector('.moa-pop-title') as HTMLElement).textContent = book.title;
    (row.querySelector('.moa-pop-author') as HTMLElement).textContent = book.author;
    row.addEventListener('click', () => onPick(book));
    list.appendChild(row);
  });
  root.appendChild(list);

  if (c.books.length > 8) {
    const more = document.createElement('p');
    more.className = 'moa-pop-more';
    more.textContent = `아래 목록에서 ${c.books.length}권 모두 보기`;
    root.appendChild(more);
  }
  return root;
}

export function BookMapView({ books, onSelectBook, myStationId }: Props) {
  const clusters = useMemo<Cluster[]>(() => {
    const byStation = new Map<string, Book[]>();
    books.forEach((b) => {
      const id = b.owner?.mrtStation;
      if (!id) return;
      const arr = byStation.get(id);
      if (arr) arr.push(b);
      else byStation.set(id, [b]);
    });
    return Array.from(byStation.entries())
      .map(([id, list]) => ({ station: getStation(id), books: list }))
      .filter((c): c is Cluster => !!c.station)
      .sort((a, b) => b.books.length - a.books.length);
  }, [books]);

  const unplaced = useMemo(() => books.filter((b) => !b.owner?.mrtStation).length, [books]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const stationLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const tileRef = useRef<L.TileLayer | null>(null);
  const { theme } = useTheme();
  // 마커 클릭 콜백은 ref로 잡는다. deps에 넣으면 부모가 리렌더될 때마다 마커를 다시 그린다.
  const selectRef = useRef(onSelectBook);
  selectRef.current = onSelectBook;

  /* 지도 생성 — 한 번만 */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: SG_CENTER,
      zoom: 11,
      minZoom: 10,
      maxZoom: 17,
      maxBounds: SG_BOUNDS,
      maxBoundsViscosity: 0.8,
      zoomControl: false,
      attributionControl: true,
      // 손가락 조작 — 드래그로 이동, 핀치로 확대/축소
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      // 한 손가락 스크롤은 페이지를 넘기게 둔다. 지도가 세로 스크롤을 먹으면
      // 서가에서 아래로 못 내려가 갇힌다.
      tap: true,
    });
    tileRef.current = L.tileLayer(TILES.light, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    // 역 레이어를 먼저 깔아 책 마커가 항상 그 위에 오게 한다.
    stationLayerRef.current = L.layerGroup().addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // 컨테이너가 늦게 크기를 잡으면 타일이 회색으로 남는다.
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  /* 테마가 바뀌면 타일만 갈아끼운다 — 지도를 다시 만들면 보던 위치가 날아간다 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileRef.current) return;
    tileRef.current.setUrl(theme === 'dark' ? TILES.dark : TILES.light);
  }, [theme]);

  /* 마커 갱신 */
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    markersRef.current.clear();

    clusters.forEach((c) => {
      const icon = L.divIcon({
        html: markerHtml(c.books.length, false),
        className: 'moa-marker-wrap',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      const marker = L.marker([c.station.lat, c.station.lon], {
        icon,
        title: `${c.station.name} ${c.books.length}권`,
        riseOnHover: true,
      });

      // 마커를 누르면 그 자리에서 무슨 책이 있는지 바로 보이게 한다.
      // 아래 목록까지 내려가서 확인하게 만들면 지도를 쓰는 의미가 없다.
      marker.bindPopup(() => buildPopup(c, (book) => {
        marker.closePopup();
        selectRef.current(book);
      }), { maxWidth: 260, minWidth: 230, closeButton: true, autoPanPadding: [24, 24] });

      marker.on('click', () => setSelectedId(c.station.id));
      marker.addTo(layer);
      markersRef.current.set(c.station.id, marker);
    });

    // 내 역 — 여기가 내 기준이라는 표시. 반경 원은 "이 정도가 우리 동네" 감각만 준다.
    const mine = getStation(myStationId);
    if (mine) {
      L.circle([mine.lat, mine.lon], {
        radius: 1200,
        color: 'hsl(var(--primary))',
        weight: 1.4,
        dashArray: '5 4',
        fillOpacity: 0.05,
        interactive: false,
      }).addTo(layer);
    }
  }, [clusters, myStationId]);

  /* MRT역 레이어 — 타일이 안 그려주니 우리가 그린다 */
  useEffect(() => {
    const map = mapRef.current;
    const layer = stationLayerRef.current;
    if (!map || !layer) return;

    // 책이 있는 역은 점을 안 찍는다(책 마커가 그 자리를 쓴다).
    // 다만 **이름은 보여준다** — 어느 역인지 모르면 지도를 볼 이유가 없다.
    // 마커와 겹치지 않게 이름만 마커 아래로 내린다.
    const taken = new Set(clusters.map((c) => c.station.id));

    const draw = () => {
      layer.clearLayers();
      const zoom = map.getZoom();
      if (zoom < ZOOM_DOTS) return;
      const showLabel = zoom >= ZOOM_LABELS;
      const bounds = map.getBounds().pad(0.15);

      MRT_STATIONS.forEach((s) => {
        if (!bounds.contains([s.lat, s.lon])) return;

        if (taken.has(s.id)) {
          if (!showLabel) return;
          L.marker([s.lat, s.lon], {
            icon: L.divIcon({
              html: `<span class="moa-st-lbl-below">${s.name}</span>`,
              className: 'moa-st',
              iconSize: [0, 0],
              iconAnchor: [0, -22],
            }),
            interactive: false,
            keyboard: false,
          }).addTo(layer);
          return;
        }

        const html = showLabel
          ? `<span class="moa-st-dot"></span><span class="moa-st-lbl">${s.name}</span>`
          : `<span class="moa-st-dot"></span>`;
        L.marker([s.lat, s.lon], {
          icon: L.divIcon({ html, className: 'moa-st', iconSize: [14, 14], iconAnchor: [7, 7] }),
          interactive: false,
          keyboard: false,
        }).addTo(layer);
      });
    };

    draw();
    map.on('zoomend moveend', draw);
    return () => { map.off('zoomend moveend', draw); };
  }, [clusters]);

  /* 결과가 바뀌면 보이는 범위를 결과에 맞춘다 — 필터를 걸었는데 화면 밖이면 빈 지도로 보인다 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || clusters.length === 0) return;
    const bounds = L.latLngBounds(clusters.map((c) => [c.station.lat, c.station.lon] as [number, number]));
    const mine = getStation(myStationId);
    if (mine) bounds.extend([mine.lat, mine.lon]);
    // maxZoom 13 — 역이 한 곳뿐일 때 14로 당기면 주변이 안 보이고
    // 타일의 역 이름이 우리 마커 밑에 깔려 "무슨 역인지" 읽을 수가 없다.
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13, animate: false });
  }, [clusters, myStationId]);

  /* 선택 강조 — 마커를 다시 만들지 않고 클래스만 바꾼다 */
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const pill = marker.getElement()?.querySelector('.moa-marker');
      pill?.classList.toggle('is-active', id === selectedId);
    });
  }, [selectedId, clusters]);

  /* 필터가 바뀌어 고른 역이 사라지면 선택을 푼다 */
  useEffect(() => {
    if (selectedId && !clusters.some((c) => c.station.id === selectedId)) setSelectedId(null);
  }, [clusters, selectedId]);

  return (
    <div className="px-4 pb-2">
      {/* 지도가 주인공이다. 마커를 누르면 팝업에서 책을 볼 수 있으니
          아래에 목록을 또 두면 같은 정보가 두 번 나오고 지도만 좁아진다. */}
      <div className="relative rounded-2xl overflow-hidden border border-border">
        <div
          ref={containerRef}
          className="w-full moa-map"
          style={{ height: 'clamp(400px, 66vh, 660px)' }}
        />
      </div>

      {clusters.length === 0 && (
        <div className="py-10 text-center">
          <MapPin className="w-7 h-7 mx-auto mb-2.5 text-faint" />
          <p className="text-sm text-muted-foreground">지도에 띄울 책이 없어요.</p>
          <p className="text-xs text-faint mt-1.5">
            {unplaced > 0
              ? '책 주인이 아직 가까운 역을 설정하지 않았어요. 프로필에서 설정하면 지도에 나타나요.'
              : '필터를 바꾸거나 다른 책장을 골라보세요.'}
          </p>
        </div>
      )}

      {unplaced > 0 && clusters.length > 0 && (
        <p className="mt-2.5 px-1 text-[11px] text-faint">
          {unplaced}권은 주인이 가까운 역을 설정하지 않아 지도에 없어요. 목록 보기에서는 보여요.
        </p>
      )}
    </div>
  );
}
