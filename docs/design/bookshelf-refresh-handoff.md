# Handoff: moabook 책장 리프레시 (Bookshelf Refresh)

## Overview
'모두의 책장' 메인 화면을 더 젊고 감각적으로 다듬은 리디자인입니다. 확정된 결정:
- **에디토리얼 미니멀 + 가상 도서관** 무드 (크림 배경, Instrument Serif 헤드라인, 코랄 #FF5233 포인트)
- **책 상세 = 하단 팝업(모달)** 방식 — 소유자(빌려주는 이웃) 정보 포함
- **책갈피 = 리파인드 리본** — 이름칩 상시 노출, 금색(빌려줌↑)/남색(빌림↓)
- **빌려준 vs 빌려온 구분 = 고스트 인 플레이스** — 빌려준 책은 반투명·점선으로 희미하게
- **반납 임박은 색 변경 없이 D-day 텍스트로만** 표시
- **책 색상 팔레트 = "더스티 주얼" 1종으로 통일** (유사 톤, 눈이 편한 배치)
- 책등 세로 텍스트는 **뒤집힘 없이 바로 세워** 배치

## About the Design Files
번들에 포함된 `Moabook 책장 리디자인.dc.html`은 **HTML로 만든 디자인 레퍼런스**(의도한 룩앤필과 동작을 보여주는 프로토타입)이며, 그대로 가져다 쓰는 프로덕션 코드가 아닙니다. 작업은 이 디자인을 **기존 moabook 코드베이스(React + TypeScript + Tailwind, shadcn/ui, framer-motion)의 패턴에 맞춰 재구현**하는 것입니다. 아래는 실제 파일에 매핑한 구체 지침입니다.

## Fidelity
**High-fidelity.** 색상·타이포·간격·인터랙션이 최종안입니다. 기존 라이브러리/패턴으로 픽셀 단위 재현하세요.

---

## 1. 색상 팔레트 통일 — "더스티 주얼"
**파일:** `src/index.css` (`:root`의 `--book-spine-1..6`, 필요 시 `.dark`도 동일 값)

현재 6색을 아래 "더스티 주얼" 톤으로 교체. 채도·명도를 근접시켜 서가가 차분히 어우러집니다.

| 토큰 | HEX | HSL (index.css 형식) |
|---|---|---|
| `--book-spine-1` | `#9E524A` | `6 36% 45%` |
| `--book-spine-2` | `#4E627B` | `213 22% 39%` |
| `--book-spine-3` | `#63795B` | `104 14% 42%` |
| `--book-spine-4` | `#B98C55` | `33 42% 53%` |
| `--book-spine-5` | `#7B6A83` | `281 11% 46%` |
| `--book-spine-6` | `#4F767A` | `186 21% 39%` |

모든 책등 텍스트는 흰색(크림 `#F4EDE0`) 유지. (이전엔 밝은 스파인에 어두운 텍스트를 섞었는데, 통일감을 위해 전부 흰색 텍스트로.)

### 색 배정을 결정적으로 (권장)
**파일:** `src/types/book.ts` — 현재 `spineColor: row.spine_color ?? (Math.floor(Math.random()*6)+1)` 로 **랜덤 배정**이라 새로고침/기기마다 색이 흔들립니다.
`spine_color`가 없을 때 랜덤 대신 **제목 해시 기반 결정적 배정**으로 바꾸면 늘 같은 책=같은 색, 서가 전체 색 분포도 균형:
```ts
const spineFromTitle = (title: string) =>
  ((title || '').split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 6) + 1;
// ...
spineColor: row.spine_color ?? spineFromTitle(row.title),
```

---

## 2. 헤드라인/타이포 & 무드
- 헤드라인: **Instrument Serif** (또는 기존 `font-display`가 세리프라면 그대로), `font-weight:400`, `letter-spacing:-0.02em`. 예: "모두의 책장" 40px.
- 본문/UI: 기존 산세리프(Plus Jakarta Sans) 유지.
- 섹션 eyebrow: 10px, `font-weight:700`, `letter-spacing:0.3em`, 대문자, 색 `#a39d90` (예: `VIRTUAL LIBRARY`, `BOOKSHELF`).
- 배경 크림 `#F4F1EA`, 본문 텍스트 `#1a1813`, 보조 `#57524a`, 흐린 텍스트 `#a39d90`.
- 포인트(코랄): `#FF5233` — 활성 필터 칩, 활성 탭 아이콘, 주요 CTA, NEW 배지.
- "가상 도서관" 몰입감: 서가 콘텐츠 영역에 은은한 비네트 오버레이(`radial-gradient(120% 70% at 50% 40%, transparent 55%, rgba(60,45,25,.12) 100%)`, `pointer-events:none`).

---

## 3. 책등(BookSpine) — 세로 텍스트 & 책갈피 리본 4c
**파일:** `src/components/BookSpine.tsx`

### 3-1. 세로 텍스트 바로 세우기
책등 제목을 세로로 쓸 경우 `writing-mode: vertical-rl;`만 사용하고 **`transform: rotate(180deg)`는 넣지 마세요** (한글이 뒤집혀 보임). CJK는 vertical-rl에서 자동으로 정립됩니다. (가로 텍스트 유지도 가능 — 현재 `truncate` 방식이면 그대로 둬도 됨.)

### 3-2. 리파인드 리본 (4c)
기존 리본 구조 유지하되:
- **이름칩을 hover 시에만이 아니라 상시 노출.** (현재 `isHovered && hasBookmark && chipName` → 상시 표시로. hover 시엔 살짝 커지거나 리본이 위로 올라가는 모션만.)
- 색은 **빌려줌=금색, 빌림=남색** 두 가지로만.
  - 금색(lent): `linear-gradient(180deg,#D4A827 0%,#A87010 55%,#7A4E08 100%)`, 칩 `linear-gradient(135deg,#C68510,#8F5A05)`, 화살표 `↑`
  - 남색(borrowed): `linear-gradient(180deg,#7478B8 0%,#484B8C 55%,#313468 100%)`, 칩 `linear-gradient(135deg,#5658A0,#383A7E)`, 화살표 `↓`
- **반납 임박(urgent) 시 색을 빨강/주황으로 바꾸지 마세요.** `RIBBON.*.urgent` 그라디언트 분기와 `dday.urgent ? ... : ...` 색 스위치를 제거하고, 항상 normal 색 사용. D-day는 리본 안 텍스트(`D-2`, `D-day`, `D+1`)로만 표시. (`getDDayLabel`의 라벨 계산은 유지, `urgent` 플래그는 색엔 미사용.)
- 리본 본문 클립: `clip-path: polygon(0 0,100% 0,100% 72%,50% 100%,0 72%)`, 상단에서 드리움. 이름칩은 리본 위 라운드 pill(`↑ 민서`), 옵션으로 D-day pill 병기.

---

## 4. 빌려준 vs 빌려온 구분 — 고스트 인 플레이스 (5a)
**파일:** `src/components/Bookshelf.tsx` (spine 뷰), `src/components/BookSpine.tsx`

`isLent`(내가 빌려줌·지금 내 손에 없음) / `isBorrowed`(내가 빌려옴·지금 내게 있음)에 따라:
- **빌려준 책(isLent):** 책등을 "자리를 지키되 비어 있음"으로 → 스파인 본문 위 반투명 크림 오버레이 `rgba(244,241,234,.6)`, 제목 `opacity:0.5`, 점선 아웃라인 `1px dashed #a89e88 (outline-offset:-2px)`. **리본(금색)과 이름칩은 선명하게** 그대로 노출(오버레이보다 위 z-index). → 돌아올 자리가 보여 안심.
- **빌려온 책(isBorrowed):** 풀 컬러 그대로 + 남색 리본. (기존 `rotate(-5deg)` 기울임은 제거하거나 취향껏; 5a 최종안은 기울임 없이 선명 대비만.)
- **내 소유(대여중 아님):** 리본 없음, 풀 컬러.

시각 규칙 요약: **희미함 = 지금 없는(빌려준) 책 / 선명함 = 지금 있는(내·빌려온) 책.**

---

## 5. 책 상세 팝업 (3a) — 소유자 정보 포함
**파일:** `src/components/BookDetailWithActions.tsx` (또는 상세 모달). shadcn `Sheet`/`Dialog`의 bottom sheet로 구현 권장.

하단에서 올라오는 시트(`border-radius:26px 26px 0 0`, 상단 그랩 핸들 `38×4px #d3ccbc`). 구성:
1. **표지 + 제목/저자** — 좌측 커버(2:3 비율, 스파인 색 배경 or `cover_url`), 우측 제목(Instrument Serif 22px)·저자.
2. **상태 배지 줄** — `book.status` 기반 코랄 아웃라인 pill (`대여 가능 · N명` / `판매중 · S$X` / `대여중`) + `상태 {condition}`(S/A/B) pill + `대여`/`판매`(mode) pill. 배지 배경 `#e8e1d2`, 텍스트 `#57524a`.
3. **빌려주는 이웃 블록** — 배경 `#efe9db` 라운드 12px. 아바타 원(38px, `owner.avatar_url` 없으면 스파인색 배경 + 닉네임 첫 글자), eyebrow `빌려주는 이웃`, 닉네임(`book.owner.nickname`, 14px 700). `book.community?.name` 있으면 우측에 커뮤니티 칩(`📚 {name}`, 배경 `#efeaf6`, 텍스트 `#6E5B9E`). 우측 `chevron-right` → 탭 시 프로필/커뮤니티로.
4. **소개** — `book.description` (13px, line-height 1.6, `#57524a`).
5. **액션** — 주 CTA 코랄 `#FF5233` 풀폭(대여중=`대기 신청`, 판매=`구매 문의`, 그 외=`대여 신청`) + 위시(하트) 아웃라인 버튼 48px.

데이터: `Book` 타입(`src/types/book.ts`)의 `owner.nickname`, `owner.avatar_url`, `condition`, `mode`, `price`, `status`, `community.name`, `description`를 그대로 사용. 대여중이면 기존 waitlist 로직 재사용.

---

## Design Tokens (요약)
- 배경 크림 `#F4F1EA` · 텍스트 `#1a1813` / `#57524a` / `#a39d90` · 포인트 코랄 `#FF5233`
- 스파인(더스티 주얼): `#9E524A #4E627B #63795B #B98C55 #7B6A83 #4F767A`, 텍스트 크림 `#F4EDE0`
- 리본 금색 `#D4A827→#7A4E08` / 남색 `#7478B8→#313468`
- 고스트 오버레이 `rgba(244,241,234,.6)` · 점선 `#a89e88`
- radius: 시트 26px, 카드 12–16px, 배지 pill 20px, 책등 2px
- 그림자(책등): `inset -3px 0 5px rgba(0,0,0,.2), inset 2px 0 2px rgba(255,255,255,.16)`
- 폰트: Instrument Serif(헤드라인) / Plus Jakarta Sans(본문)

## Interactions & Behavior
- 책등/커버 탭 → 하단 시트 상세 팝업(3a). 바깥(오버레이) 탭 또는 아래로 드래그 시 닫힘. framer-motion 슬라이드업(spring, stiffness~300 damping~28).
- 책갈피 리본: 상시 표시, hover 시 살짝 상승/확대.
- 필터 칩(전체/대여 가능/판매중): 활성=코랄 배경 흰 텍스트.

## Files
- `Moabook 책장 리디자인.dc.html` — 전체 디자인 레퍼런스. 최신 확정안은 상단 Turn(6→5→4→3), 그 아래는 초기 탐색(참고용).
  - Turn 6: 팔레트(더스티 주얼 확정)
  - Turn 5 / 5a: 빌려준 vs 빌려온 구분 (고스트 인 플레이스) ← 최종
  - Turn 4 / 4c: 책갈피 리본 ← 최종
  - Turn 3 / 3a: 책 상세 팝업 ← 최종
- `support.js` — 프로토타입 런타임(참고 불필요, 프로덕션 미사용).
