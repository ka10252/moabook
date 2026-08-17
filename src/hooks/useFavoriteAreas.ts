import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * F19 · 즐겨찾기 지역 — 자주 보는 역·지역을 프로필에 저장해두고 서가에서 한 번에 적용한다.
 *
 * localStorage가 아니라 DB에 두는 이유: 폰과 PC를 같이 쓰는 사람이 있고,
 * 앱을 지웠다 깔면 사라진다. 저장할 값이 몇 글자뿐이라 비용도 없다.
 */
export function useFavoriteAreas() {
  const { user } = useAuth();
  const [stations, setStations] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) { setStations([]); setDistricts([]); setLoaded(true); return; }
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('favorite_stations, favorite_districts')
        .eq('id', user.id)
        .maybeSingle();
      if (!alive) return;
      // 마이그레이션 전이면 컬럼이 없어 에러가 난다 — 서가가 죽지 않게 조용히 빈 값으로 둔다
      if (!error && data) {
        const row = data as { favorite_stations?: string[]; favorite_districts?: string[] };
        setStations(row.favorite_stations ?? []);
        setDistricts(row.favorite_districts ?? []);
      }
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  /** 낙관적으로 화면을 먼저 바꾸고 저장한다 — 별을 눌렀는데 반응이 늦으면 두 번 누른다 */
  const persist = useCallback(
    async (next: { stations?: string[]; districts?: string[] }) => {
      if (!user) return;
      const patch: Record<string, string[]> = {};
      if (next.stations) patch.favorite_stations = next.stations;
      if (next.districts) patch.favorite_districts = next.districts;
      await supabase.from('profiles').update(patch as never).eq('id', user.id);
    },
    [user?.id],
  );

  const toggleStation = useCallback((id: string) => {
    setStations((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      void persist({ stations: next });
      return next;
    });
  }, [persist]);

  const toggleDistrict = useCallback((name: string) => {
    setDistricts((prev) => {
      const next = prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name];
      void persist({ districts: next });
      return next;
    });
  }, [persist]);

  return {
    favStations: stations,
    favDistricts: districts,
    hasFavorites: stations.length > 0 || districts.length > 0,
    loaded,
    toggleStation,
    toggleDistrict,
  };
}
