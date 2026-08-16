/**
 * 싱가포르 MRT 역 목록.
 *
 * 책 위치를 "거주 지역(planning area)"이 아니라 "집에서 가까운 역"으로 잡기 위한 데이터다.
 * 지역은 범위가 너무 넓어(예: Jurong West 혼자서 몇 km) 지도에서 거리 감각이 안 나오고,
 * 반대로 정확한 주소는 남의 집 위치를 공개하는 것이라 쓸 수 없다.
 * 역은 그 중간 — 누구나 아는 공공장소이고, 실제 만나서 주고받는 지점이기도 하다.
 *
 * lat/lon은 지도 위 상대 배치를 위한 근사값이다(개념도라 ±수백 m는 무관).
 * district는 기존 지역 필터와 붙이기 위한 planning area 이름.
 */

export type SgRegion = '중부' | '동부' | '북동부' | '북부' | '서부';

export interface MrtStation {
  /** 안정적인 슬러그. profiles.mrt_station에 이 값이 저장된다 */
  id: string;
  name: string;
  nameKo: string;
  lat: number;
  lon: number;
  district: string;
  region: SgRegion;
  /** 노선 코드 — 픽커에서 역 구분용 */
  lines: string[];
}

export const MRT_STATIONS: MrtStation[] = [
  // ── 서부 (East-West / North-South 서쪽, Circle 서쪽) ──────────────────
  { id: 'joo-koon', name: 'Joo Koon', nameKo: '주쿤', lat: 1.3277, lon: 103.6785, district: 'Jurong West', region: '서부', lines: ['EW'] },
  { id: 'pioneer', name: 'Pioneer', nameKo: '파이오니어', lat: 1.3376, lon: 103.6972, district: 'Jurong West', region: '서부', lines: ['EW'] },
  { id: 'boon-lay', name: 'Boon Lay', nameKo: '분레이', lat: 1.3386, lon: 103.7060, district: 'Boon Lay', region: '서부', lines: ['EW'] },
  { id: 'lakeside', name: 'Lakeside', nameKo: '레이크사이드', lat: 1.3446, lon: 103.7210, district: 'Jurong West', region: '서부', lines: ['EW'] },
  { id: 'chinese-garden', name: 'Chinese Garden', nameKo: '차이니즈 가든', lat: 1.3425, lon: 103.7325, district: 'Jurong East', region: '서부', lines: ['EW'] },
  { id: 'jurong-east', name: 'Jurong East', nameKo: '주롱 이스트', lat: 1.3329, lon: 103.7422, district: 'Jurong East', region: '서부', lines: ['EW', 'NS'] },
  { id: 'clementi', name: 'Clementi', nameKo: '클레멘티', lat: 1.3151, lon: 103.7653, district: 'Clementi', region: '서부', lines: ['EW'] },
  { id: 'dover', name: 'Dover', nameKo: '도버', lat: 1.3113, lon: 103.7786, district: 'Clementi', region: '서부', lines: ['EW'] },
  { id: 'buona-vista', name: 'Buona Vista', nameKo: '부오나 비스타', lat: 1.3072, lon: 103.7902, district: 'Queenstown', region: '서부', lines: ['EW', 'CC'] },
  { id: 'commonwealth', name: 'Commonwealth', nameKo: '커먼웰스', lat: 1.3025, lon: 103.7982, district: 'Queenstown', region: '서부', lines: ['EW'] },
  { id: 'queenstown', name: 'Queenstown', nameKo: '퀸스타운', lat: 1.2947, lon: 103.8058, district: 'Queenstown', region: '서부', lines: ['EW'] },
  { id: 'redhill', name: 'Redhill', nameKo: '레드힐', lat: 1.2896, lon: 103.8168, district: 'Bukit Merah', region: '서부', lines: ['EW'] },
  { id: 'tiong-bahru', name: 'Tiong Bahru', nameKo: '티옹 바루', lat: 1.2861, lon: 103.8270, district: 'Bukit Merah', region: '서부', lines: ['EW'] },
  { id: 'kent-ridge', name: 'Kent Ridge', nameKo: '켄트 리지 (NUS)', lat: 1.2934, lon: 103.7845, district: 'Queenstown', region: '서부', lines: ['CC'] },
  { id: 'one-north', name: 'one-north', nameKo: '원노스', lat: 1.2994, lon: 103.7873, district: 'Queenstown', region: '서부', lines: ['CC'] },
  { id: 'holland-village', name: 'Holland Village', nameKo: '홀랜드 빌리지', lat: 1.3120, lon: 103.7960, district: 'Bukit Timah', region: '서부', lines: ['CC'] },
  { id: 'farrer-road', name: 'Farrer Road', nameKo: '파러 로드', lat: 1.3174, lon: 103.8074, district: 'Bukit Timah', region: '서부', lines: ['CC'] },
  { id: 'haw-par-villa', name: 'Haw Par Villa', nameKo: '하파빌라', lat: 1.2823, lon: 103.7817, district: 'Queenstown', region: '서부', lines: ['CC'] },
  { id: 'pasir-panjang', name: 'Pasir Panjang', nameKo: '파시르 판장', lat: 1.2761, lon: 103.7915, district: 'Queenstown', region: '서부', lines: ['CC'] },
  { id: 'labrador-park', name: 'Labrador Park', nameKo: '라브라도 파크', lat: 1.2723, lon: 103.8027, district: 'Bukit Merah', region: '서부', lines: ['CC'] },
  { id: 'telok-blangah', name: 'Telok Blangah', nameKo: '텔록 블랑가', lat: 1.2707, lon: 103.8096, district: 'Bukit Merah', region: '서부', lines: ['CC'] },
  { id: 'harbourfront', name: 'HarbourFront', nameKo: '하버프론트', lat: 1.2653, lon: 103.8220, district: 'Bukit Merah', region: '서부', lines: ['NE', 'CC'] },
  { id: 'bukit-batok', name: 'Bukit Batok', nameKo: '부킷 바톡', lat: 1.3490, lon: 103.7496, district: 'Bukit Batok', region: '서부', lines: ['NS'] },
  { id: 'bukit-gombak', name: 'Bukit Gombak', nameKo: '부킷 곰박', lat: 1.3590, lon: 103.7518, district: 'Bukit Batok', region: '서부', lines: ['NS'] },
  { id: 'beauty-world', name: 'Beauty World', nameKo: '뷰티 월드', lat: 1.3411, lon: 103.7758, district: 'Bukit Timah', region: '서부', lines: ['DT'] },
  { id: 'king-albert-park', name: 'King Albert Park', nameKo: '킹 알버트 파크', lat: 1.3355, lon: 103.7838, district: 'Bukit Timah', region: '서부', lines: ['DT'] },
  { id: 'sixth-avenue', name: 'Sixth Avenue', nameKo: '식스스 애비뉴', lat: 1.3310, lon: 103.7975, district: 'Bukit Timah', region: '서부', lines: ['DT'] },
  { id: 'tan-kah-kee', name: 'Tan Kah Kee', nameKo: '탄카키', lat: 1.3259, lon: 103.8074, district: 'Bukit Timah', region: '서부', lines: ['DT'] },
  { id: 'botanic-gardens', name: 'Botanic Gardens', nameKo: '보타닉 가든', lat: 1.3225, lon: 103.8153, district: 'Tanglin', region: '서부', lines: ['CC', 'DT'] },
  { id: 'bukit-panjang', name: 'Bukit Panjang', nameKo: '부킷 판장', lat: 1.3785, lon: 103.7620, district: 'Bukit Panjang', region: '서부', lines: ['DT'] },
  { id: 'choa-chu-kang', name: 'Choa Chu Kang', nameKo: '초아 추 캉', lat: 1.3854, lon: 103.7443, district: 'Choa Chu Kang', region: '서부', lines: ['NS'] },
  { id: 'yew-tee', name: 'Yew Tee', nameKo: '유티', lat: 1.3971, lon: 103.7473, district: 'Choa Chu Kang', region: '서부', lines: ['NS'] },

  // ── 중부 (Orchard·CBD·Novena·Toa Payoh) ─────────────────────────────
  { id: 'orchard', name: 'Orchard', nameKo: '오차드', lat: 1.3040, lon: 103.8318, district: 'Orchard', region: '중부', lines: ['NS', 'TE'] },
  { id: 'somerset', name: 'Somerset', nameKo: '서머셋', lat: 1.3005, lon: 103.8386, district: 'Orchard', region: '중부', lines: ['NS'] },
  { id: 'orchard-boulevard', name: 'Orchard Boulevard', nameKo: '오차드 블러바드', lat: 1.3025, lon: 103.8243, district: 'Orchard', region: '중부', lines: ['TE'] },
  { id: 'napier', name: 'Napier', nameKo: '네이피어', lat: 1.3060, lon: 103.8194, district: 'Tanglin', region: '중부', lines: ['TE'] },
  { id: 'stevens', name: 'Stevens', nameKo: '스티븐스', lat: 1.3199, lon: 103.8259, district: 'Tanglin', region: '중부', lines: ['DT', 'TE'] },
  { id: 'newton', name: 'Newton', nameKo: '뉴턴', lat: 1.3138, lon: 103.8383, district: 'Novena', region: '중부', lines: ['NS', 'DT'] },
  { id: 'novena', name: 'Novena', nameKo: '노비나', lat: 1.3204, lon: 103.8438, district: 'Novena', region: '중부', lines: ['NS'] },
  { id: 'toa-payoh', name: 'Toa Payoh', nameKo: '토아파요', lat: 1.3327, lon: 103.8474, district: 'Toa Payoh', region: '중부', lines: ['NS'] },
  { id: 'braddell', name: 'Braddell', nameKo: '브래델', lat: 1.3404, lon: 103.8467, district: 'Toa Payoh', region: '중부', lines: ['NS'] },
  { id: 'caldecott', name: 'Caldecott', nameKo: '칼데콧', lat: 1.3378, lon: 103.8395, district: 'Toa Payoh', region: '중부', lines: ['CC', 'TE'] },
  { id: 'marymount', name: 'Marymount', nameKo: '메리마운트', lat: 1.3491, lon: 103.8394, district: 'Bishan', region: '중부', lines: ['CC'] },
  { id: 'bishan', name: 'Bishan', nameKo: '비샨', lat: 1.3512, lon: 103.8485, district: 'Bishan', region: '중부', lines: ['NS', 'CC'] },
  { id: 'dhoby-ghaut', name: 'Dhoby Ghaut', nameKo: '도비 갓', lat: 1.2993, lon: 103.8455, district: 'Rochor', region: '중부', lines: ['NS', 'NE', 'CC'] },
  { id: 'little-india', name: 'Little India', nameKo: '리틀 인디아', lat: 1.3067, lon: 103.8492, district: 'Rochor', region: '중부', lines: ['NE', 'DT'] },
  { id: 'rochor', name: 'Rochor', nameKo: '로초르', lat: 1.3037, lon: 103.8526, district: 'Rochor', region: '중부', lines: ['DT'] },
  { id: 'bugis', name: 'Bugis', nameKo: '부기스', lat: 1.3005, lon: 103.8560, district: 'Rochor', region: '중부', lines: ['EW', 'DT'] },
  { id: 'farrer-park', name: 'Farrer Park', nameKo: '파러 파크', lat: 1.3122, lon: 103.8543, district: 'Rochor', region: '중부', lines: ['NE'] },
  { id: 'city-hall', name: 'City Hall', nameKo: '시티홀', lat: 1.2931, lon: 103.8520, district: 'Downtown Core', region: '중부', lines: ['NS', 'EW'] },
  { id: 'raffles-place', name: 'Raffles Place', nameKo: '래플스 플레이스', lat: 1.2836, lon: 103.8515, district: 'Downtown Core', region: '중부', lines: ['NS', 'EW'] },
  { id: 'marina-bay', name: 'Marina Bay', nameKo: '마리나 베이', lat: 1.2762, lon: 103.8546, district: 'Downtown Core', region: '중부', lines: ['NS', 'CC', 'TE'] },
  { id: 'downtown', name: 'Downtown', nameKo: '다운타운', lat: 1.2794, lon: 103.8529, district: 'Downtown Core', region: '중부', lines: ['DT'] },
  { id: 'telok-ayer', name: 'Telok Ayer', nameKo: '텔록 아이어', lat: 1.2823, lon: 103.8484, district: 'Downtown Core', region: '중부', lines: ['DT'] },
  { id: 'chinatown', name: 'Chinatown', nameKo: '차이나타운', lat: 1.2846, lon: 103.8442, district: 'Outram', region: '중부', lines: ['NE', 'DT'] },
  { id: 'outram-park', name: 'Outram Park', nameKo: '아우트럼 파크', lat: 1.2803, lon: 103.8394, district: 'Outram', region: '중부', lines: ['EW', 'NE', 'TE'] },
  { id: 'maxwell', name: 'Maxwell', nameKo: '맥스웰', lat: 1.2805, lon: 103.8443, district: 'Outram', region: '중부', lines: ['TE'] },
  { id: 'havelock', name: 'Havelock', nameKo: '헤이블록', lat: 1.2879, lon: 103.8358, district: 'Bukit Merah', region: '중부', lines: ['TE'] },
  { id: 'great-world', name: 'Great World', nameKo: '그레이트 월드', lat: 1.2937, lon: 103.8317, district: 'Bukit Merah', region: '중부', lines: ['TE'] },
  { id: 'clarke-quay', name: 'Clarke Quay', nameKo: '클락키', lat: 1.2885, lon: 103.8465, district: 'Downtown Core', region: '중부', lines: ['NE'] },

  // ── 동부 (East-West 동쪽, Thomson-East Coast, Downtown 동쪽) ─────────
  { id: 'kallang', name: 'Kallang', nameKo: '칼랑', lat: 1.3115, lon: 103.8714, district: 'Kallang', region: '동부', lines: ['EW'] },
  { id: 'lavender', name: 'Lavender', nameKo: '라벤더', lat: 1.3072, lon: 103.8630, district: 'Kallang', region: '동부', lines: ['EW'] },
  { id: 'aljunied', name: 'Aljunied', nameKo: '알주니드', lat: 1.3165, lon: 103.8829, district: 'Geylang', region: '동부', lines: ['EW'] },
  { id: 'paya-lebar', name: 'Paya Lebar', nameKo: '파야 레바', lat: 1.3177, lon: 103.8925, district: 'Geylang', region: '동부', lines: ['EW', 'CC'] },
  { id: 'eunos', name: 'Eunos', nameKo: '유노스', lat: 1.3197, lon: 103.9032, district: 'Geylang', region: '동부', lines: ['EW'] },
  { id: 'kembangan', name: 'Kembangan', nameKo: '켐방간', lat: 1.3210, lon: 103.9128, district: 'Bedok', region: '동부', lines: ['EW'] },
  { id: 'bedok', name: 'Bedok', nameKo: '베독', lat: 1.3240, lon: 103.9301, district: 'Bedok', region: '동부', lines: ['EW'] },
  { id: 'tanah-merah', name: 'Tanah Merah', nameKo: '타나 메라', lat: 1.3272, lon: 103.9464, district: 'Bedok', region: '동부', lines: ['EW'] },
  { id: 'simei', name: 'Simei', nameKo: '시메이', lat: 1.3432, lon: 103.9532, district: 'Tampines', region: '동부', lines: ['EW'] },
  { id: 'tampines', name: 'Tampines', nameKo: '탐피니스', lat: 1.3535, lon: 103.9451, district: 'Tampines', region: '동부', lines: ['EW', 'DT'] },
  { id: 'pasir-ris', name: 'Pasir Ris', nameKo: '파시르 리스', lat: 1.3729, lon: 103.9493, district: 'Pasir Ris', region: '동부', lines: ['EW'] },
  { id: 'expo', name: 'Expo', nameKo: '엑스포', lat: 1.3346, lon: 103.9617, district: 'Changi', region: '동부', lines: ['EW', 'DT'] },
  { id: 'changi-airport', name: 'Changi Airport', nameKo: '창이 공항', lat: 1.3573, lon: 103.9885, district: 'Changi', region: '동부', lines: ['EW'] },
  { id: 'bedok-north', name: 'Bedok North', nameKo: '베독 노스', lat: 1.3348, lon: 103.9182, district: 'Bedok', region: '동부', lines: ['DT'] },
  { id: 'bedok-reservoir', name: 'Bedok Reservoir', nameKo: '베독 리저부아', lat: 1.3364, lon: 103.9320, district: 'Bedok', region: '동부', lines: ['DT'] },
  { id: 'tampines-west', name: 'Tampines West', nameKo: '탐피니스 웨스트', lat: 1.3455, lon: 103.9385, district: 'Tampines', region: '동부', lines: ['DT'] },
  { id: 'ubi', name: 'Ubi', nameKo: '우비', lat: 1.3300, lon: 103.9000, district: 'Geylang', region: '동부', lines: ['DT'] },
  { id: 'macpherson', name: 'MacPherson', nameKo: '맥퍼슨', lat: 1.3266, lon: 103.8900, district: 'Geylang', region: '동부', lines: ['CC', 'DT'] },
  { id: 'tai-seng', name: 'Tai Seng', nameKo: '타이셍', lat: 1.3358, lon: 103.8880, district: 'Hougang', region: '동부', lines: ['CC'] },
  { id: 'dakota', name: 'Dakota', nameKo: '다코타', lat: 1.3082, lon: 103.8885, district: 'Geylang', region: '동부', lines: ['CC'] },
  { id: 'mountbatten', name: 'Mountbatten', nameKo: '마운트배튼', lat: 1.3061, lon: 103.8825, district: 'Marine Parade', region: '동부', lines: ['CC'] },
  { id: 'stadium', name: 'Stadium', nameKo: '스타디움', lat: 1.3028, lon: 103.8752, district: 'Kallang', region: '동부', lines: ['CC'] },
  { id: 'tanjong-katong', name: 'Tanjong Katong', nameKo: '탄종 카통', lat: 1.2999, lon: 103.8949, district: 'Marine Parade', region: '동부', lines: ['TE'] },
  { id: 'marine-parade', name: 'Marine Parade', nameKo: '마린 퍼레이드', lat: 1.3025, lon: 103.9052, district: 'Marine Parade', region: '동부', lines: ['TE'] },
  { id: 'siglap', name: 'Siglap', nameKo: '시글랩', lat: 1.3116, lon: 103.9270, district: 'Bedok', region: '동부', lines: ['TE'] },

  // ── 북동부 (North East) ─────────────────────────────────────────────
  { id: 'boon-keng', name: 'Boon Keng', nameKo: '분켕', lat: 1.3195, lon: 103.8617, district: 'Kallang', region: '북동부', lines: ['NE'] },
  { id: 'potong-pasir', name: 'Potong Pasir', nameKo: '포통 파시르', lat: 1.3313, lon: 103.8687, district: 'Toa Payoh', region: '북동부', lines: ['NE'] },
  { id: 'woodleigh', name: 'Woodleigh', nameKo: '우들리', lat: 1.3391, lon: 103.8707, district: 'Serangoon', region: '북동부', lines: ['NE'] },
  { id: 'serangoon', name: 'Serangoon', nameKo: '시랑군', lat: 1.3497, lon: 103.8734, district: 'Serangoon', region: '북동부', lines: ['NE', 'CC'] },
  { id: 'lorong-chuan', name: 'Lorong Chuan', nameKo: '로롱 추안', lat: 1.3517, lon: 103.8641, district: 'Serangoon', region: '북동부', lines: ['CC'] },
  { id: 'kovan', name: 'Kovan', nameKo: '코반', lat: 1.3601, lon: 103.8850, district: 'Hougang', region: '북동부', lines: ['NE'] },
  { id: 'hougang', name: 'Hougang', nameKo: '하우강', lat: 1.3714, lon: 103.8924, district: 'Hougang', region: '북동부', lines: ['NE'] },
  { id: 'buangkok', name: 'Buangkok', nameKo: '부앙콕', lat: 1.3828, lon: 103.8931, district: 'Hougang', region: '북동부', lines: ['NE'] },
  { id: 'sengkang', name: 'Sengkang', nameKo: '성캉', lat: 1.3915, lon: 103.8955, district: 'Sengkang', region: '북동부', lines: ['NE'] },
  { id: 'punggol', name: 'Punggol', nameKo: '펀골', lat: 1.4053, lon: 103.9024, district: 'Punggol', region: '북동부', lines: ['NE'] },

  // ── 북부 (North-South 북쪽, Thomson 북쪽) ────────────────────────────
  { id: 'ang-mo-kio', name: 'Ang Mo Kio', nameKo: '앙모키오', lat: 1.3700, lon: 103.8495, district: 'Ang Mo Kio', region: '북부', lines: ['NS'] },
  { id: 'yio-chu-kang', name: 'Yio Chu Kang', nameKo: '요추캉', lat: 1.3817, lon: 103.8449, district: 'Ang Mo Kio', region: '북부', lines: ['NS'] },
  { id: 'khatib', name: 'Khatib', nameKo: '카팁', lat: 1.4173, lon: 103.8329, district: 'Yishun', region: '북부', lines: ['NS'] },
  { id: 'yishun', name: 'Yishun', nameKo: '이순', lat: 1.4295, lon: 103.8350, district: 'Yishun', region: '북부', lines: ['NS'] },
  { id: 'sembawang', name: 'Sembawang', nameKo: '셈바왕', lat: 1.4491, lon: 103.8200, district: 'Sembawang', region: '북부', lines: ['NS'] },
  { id: 'admiralty', name: 'Admiralty', nameKo: '애드미럴티', lat: 1.4406, lon: 103.8010, district: 'Woodlands', region: '북부', lines: ['NS'] },
  { id: 'woodlands', name: 'Woodlands', nameKo: '우드랜즈', lat: 1.4370, lon: 103.7865, district: 'Woodlands', region: '북부', lines: ['NS', 'TE'] },
  { id: 'marsiling', name: 'Marsiling', nameKo: '마실링', lat: 1.4327, lon: 103.7740, district: 'Woodlands', region: '북부', lines: ['NS'] },
  { id: 'kranji', name: 'Kranji', nameKo: '크란지', lat: 1.4251, lon: 103.7620, district: 'Woodlands', region: '북부', lines: ['NS'] },
  { id: 'springleaf', name: 'Springleaf', nameKo: '스프링리프', lat: 1.3973, lon: 103.8180, district: 'Mandai', region: '북부', lines: ['TE'] },
  { id: 'lentor', name: 'Lentor', nameKo: '렌토', lat: 1.3846, lon: 103.8360, district: 'Ang Mo Kio', region: '북부', lines: ['TE'] },
  { id: 'mayflower', name: 'Mayflower', nameKo: '메이플라워', lat: 1.3722, lon: 103.8367, district: 'Ang Mo Kio', region: '북부', lines: ['TE'] },
  { id: 'bright-hill', name: 'Bright Hill', nameKo: '브라이트 힐', lat: 1.3618, lon: 103.8330, district: 'Bishan', region: '북부', lines: ['TE'] },
  { id: 'upper-thomson', name: 'Upper Thomson', nameKo: '어퍼 톰슨', lat: 1.3543, lon: 103.8330, district: 'Bishan', region: '북부', lines: ['TE'] },
];

const BY_ID = new Map(MRT_STATIONS.map((s) => [s.id, s]));

export const getStation = (id?: string | null): MrtStation | undefined =>
  id ? BY_ID.get(id) : undefined;

/** 역 라벨 — "Clementi 클레멘티" 처럼 영문·한글을 같이 보여준다(검색이 둘 다 걸리게) */
export const stationLabel = (s: MrtStation) => `${s.name} ${s.nameKo}`;

/** 지역 필터 목록은 역 데이터에서 파생한다 — 필터 값과 저장 값이 어긋날 수 없게 */
export const STATION_DISTRICTS: string[] = Array.from(
  new Set(MRT_STATIONS.map((s) => s.district))
).sort();

export const SG_REGION_ORDER: SgRegion[] = ['중부', '서부', '동부', '북동부', '북부'];
