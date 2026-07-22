# moabook (모아북)

> **"우리 동네의 책장을 하나로 모은다."**
> 싱가포르 거주 한인·유학생이 동네·커뮤니티 단위로 책을 빌려주고, 빌리고, 사고파는 하이퍼로컬 북 커뮤니티.

---

## 왜 만들었나

싱가포르 유학 생활에서 한 번에 들고 올 수 있는 책은 2~3권뿐이다. 한 학기면 다 읽고, 한글책은 현지에서 구하기 어렵고 비싸다. 반대로 떠나는 유학생은 책을 처분해야 한다. **가까이 있는 사람의 책장에 무엇이 있는지 알 수 없다는 것**이 문제였다.

배경·목표·요구사항은 **[PRD.md](./PRD.md)** 참고.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **책장** | 나무 책장 UI에 책등(spine)으로 시각화 |
| **책 등록** | Google Books / Open Library 검색 자동완성, 상태(S/A/B), 대여·판매 모드 |
| **거래** | 대여/구매 요청 → 수락 → 반납 확인까지 상태 관리, 반납일 D-day 배지 |
| **채팅** | Supabase Realtime 기반 1:1 채팅, 대여 요청/수락/반납 카드 |
| **커뮤니티** | PIN 기반 비공개 그룹, 게시판, 초대 링크 |
| **위시리스트** | 읽고 싶은 책 등록 |
| **신고·차단** | 콘텐츠 신고, 유저 차단 (서버 RLS로 양방향 강제) |
| **관리자 포털** | 유저·도서·거래·커뮤니티·신고 관리 (`/admin-portal`) |

---

## 기술 스택

- **프론트엔드**: Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **데이터**: TanStack Query, Supabase JS
- **백엔드**: Supabase (Postgres + Auth + Realtime + Storage + Edge Functions)
- **애니메이션**: Framer Motion
- **PWA**: vite-plugin-pwa (커스텀 서비스 워커)

> 모든 테이블에 Row Level Security(RLS) 적용. 권한·차단 판정은 클라이언트가 아니라 DB에서 강제한다.

---

## 로컬 실행

```sh
npm install
npm run dev          # http://localhost:8080
```

`.env` 필요 (`.env.example` 참고):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_GOOGLE_BOOKS_API_KEY=...
VITE_VAPID_PUBLIC_KEY=...        # 웹 푸시용 (선택)
```

### 그 외 명령어

```sh
npm run build        # 프로덕션 빌드
npm run lint         # ESLint
npm test             # Vitest
```

---

## 데이터베이스

스키마는 `supabase/migrations/`에 시간순으로 있다. 새 환경을 세팅하려면 Supabase SQL Editor에서 순서대로 실행한다.

```
supabase/
├── migrations/           # 스키마 (순서대로 실행)
└── functions/
    ├── delete-account/   # 인앱 회원 탈퇴 (auth.users까지 삭제)
    └── send-push/        # 웹 푸시 발송
```

> ⚠️ Supabase 무료 플랜은 일정 기간 활동이 없으면 프로젝트를 **일시정지(pause)** 시킨다.
> 앱 전체가 먹통이고 API 호스트가 DNS에서 안 잡히면, 코드를 의심하기 전에 대시보드에서 프로젝트 상태부터 확인할 것.

---

## 문서

| 문서 | 내용 |
|------|------|
| [PRD.md](./PRD.md) | 제품 요구사항 — 문제 정의, 목표·지표, 기능 명세, 출시 계획, 법적·보안 요건 |
| [DESIGN_GUIDE.md](./DESIGN_GUIDE.md) | 브랜드·디자인 시스템 — 컬러 토큰, 타이포그래피, 컴포넌트, 모션 |
| `LAUNCH_ISSUES.md` | 출시 전 검토 이슈 (비공개) |

---

## 성능 기준선

회귀 감지용 기준. 크게 벗어나면 원인을 찾을 것.

| 항목 | 기준 |
|------|------|
| 메인 JS (gzip) | ~277 KB |
| CSS (gzip) | ~24 KB |
| PWA 프리캐시 | ~1,776 KB |
| 타입 에러 | 0 |
