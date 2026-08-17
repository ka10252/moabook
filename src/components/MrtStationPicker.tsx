import { useMemo, useRef, useState, useEffect } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { MRT_STATIONS, MrtStation, getStation, SG_REGION_ORDER } from '@/data/mrtStations';

interface Props {
  value: string;
  onChange: (stationId: string) => void;
  placeholder?: string;
  /** 가입 화면처럼 라벨을 바깥에서 그리는 곳에선 끈다 */
  disabled?: boolean;
}

/**
 * 집에서 가까운 MRT역을 고르는 픽커.
 *
 * 역이 100개 가까이라 select 하나로는 못 찾는다. 검색을 기본으로 두되,
 * 아무것도 안 쳤을 때는 권역별로 묶어 보여줘서 "우리 동네가 어디쯤" 감이 오게 한다.
 * 영문·한글·노선코드 어느 걸로 쳐도 걸리게 한다 — Clementi / 클레멘티 / EW 다 통한다.
 */
export function MrtStationPicker({ value, onChange, placeholder = '역 이름으로 검색 (예: Clementi, 클레멘티)', disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = getStation(value);

  // 바깥을 누르면 닫는다. 목록이 열린 채로 폼을 제출하면 뒤 내용이 가려져 헷갈린다.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hit = (s: MrtStation) =>
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.nameKo.includes(query.trim()) ||
      s.district.toLowerCase().includes(q) ||
      s.lines.some((l) => l.toLowerCase() === q);

    const matched = MRT_STATIONS.filter(hit);
    return SG_REGION_ORDER
      .map((region) => ({ region, stations: matched.filter((s) => s.region === region) }))
      .filter((g) => g.stations.length > 0);
  }, [query]);

  const total = grouped.reduce((n, g) => n + g.stations.length, 0);

  const pick = (s: MrtStation) => {
    onChange(s.id);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      {selected && !open ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="w-full h-12 px-4 rounded-xl bg-muted/50 flex items-center gap-2.5 text-left disabled:opacity-60"
        >
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm text-foreground truncate">
            {selected.name} <span className="text-muted-foreground">{selected.nameKo}</span>
          </span>
          <span className="ml-auto text-[11px] text-muted-foreground shrink-0">{selected.district}</span>
        </button>
      ) : (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            disabled={disabled}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full h-12 pl-11 pr-9 rounded-xl bg-muted/50 border-0 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary outline-none"
          />
          {(query || selected) && (
            <button
              type="button"
              onClick={() => { setQuery(''); setOpen(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
          {total === 0 ? (
            <p className="px-4 py-5 text-xs text-muted-foreground text-center">
              그런 역이 없어요. 영문·한글 어느 쪽으로 쳐도 찾을 수 있어요.
            </p>
          ) : (
            grouped.map((g) => (
              <div key={g.region}>
                <p className="sticky top-0 px-4 py-1.5 bg-muted/80 backdrop-blur text-[11px] tracking-wider text-muted-foreground">
                  {g.region}
                </p>
                {g.stations.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pick(s)}
                    className={`w-full px-4 py-2.5 flex items-center gap-2 text-left hover:bg-muted/60 ${
                      s.id === value ? 'bg-primary/10' : ''
                    }`}
                  >
                    <span className="text-sm text-foreground truncate">
                      {s.name} <span className="text-muted-foreground">{s.nameKo}</span>
                    </span>
                    <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
                      {s.lines.join('·')}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
