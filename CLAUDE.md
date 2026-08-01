# moabook — Claude 작업 규칙

모아북(모아북, 싱가포르 한인·유학생 하이퍼로컬 책공유: 대여·판매·나눔). 작업 디렉터리: `~/Desktop/moabook`.
스택: Vite + React 18 + TS + Tailwind + shadcn/ui + Framer Motion, Supabase(Postgres·RLS·Auth·Realtime·Storage·Edge Functions), Phaser(가상공간). 배포: Vercel(main push 자동배포).

## 상시 규칙 (반드시 지킬 것)
1. **배포는 지시할 때만** — `git push`(=Vercel 자동배포)는 사용자가 "배포해"라고 할 때만 한다. 그 전까지는 **로컬 커밋까지만**. 작업이 끝나면 "커밋했고 배포 대기 중"이라고 알린다. (잦은 배포가 홈스크린 PWA 하얀 화면을 유발함)
2. **기능 변경 시 문서 갱신** — 기능을 추가/수정하면 반드시 `docs/CORE_FEATURES.md`의 해당 항목(무엇/데이터흐름/불변식/작동상태)을 함께 갱신한다.
3. **작업 완료 후 다음 작업 질문** — 한 작업을 끝낼 때마다 백로그에서 다음에 할 후보들을 **마크다운 표(테이블) 형태**로 보여주고, 사용자가 **대화창에 직접 입력**해 고르게 한다. AskUserQuestion 같은 선택지 UI는 쓰지 않는다. 백로그 출처: 메모리 `project-moabook-backlog`, `LAUNCH_ISSUES.md`, `docs/CORE_FEATURES.md`의 "알려진 버그·리스크".
4. **회귀 방지** — 공용 테이블(notifications/messages/transactions/books)에 트리거를 붙이거나 고칠 때는 `docs/CORE_FEATURES.md`의 "트리거 안전 규칙"을 지킨다: 외부 호출(`net.http_post`)은 `BEGIN…EXCEPTION` 래핑 + pg_net 함수는 `set search_path to 'public','net','extensions'`. 변경 후 반드시 **대여 요청→수락→반납** 경로를 실제로 확인한다.
5. **빌드+타입 확인** — 커밋 전 `npx tsc --noEmit` **와** `npm run build` 둘 다 통과 확인. ⚠️ vite build(esbuild)는 **타입체크를 안 함** → import 누락/undefined 참조가 빌드는 통과하고 런타임에 터진다(예: 사서 NO_ACCESSORY 미import로 커뮤니티룸 전체 크래시). tsc를 반드시 별도로 돌릴 것.
6. **작업 자가 QA (사용자 테스트 전에 완성도 올리기)** — 아래 "작업 자가 QA 프로세스"를 매 작업마다 수행한 뒤 "커밋 완료"라고 말한다. 사용자가 테스트하기 전에 내가 먼저 검증한다.

## 작업 자가 QA 프로세스 (매 작업 후 필수)
작업 종류별로 아래를 실제로 수행하고, 결과를 사용자에게 한 줄로 보고한다("tsc/build 통과, /space 프리뷰 콘솔 0, RPC 200 확인" 식).

1. **정적 검증(항상)**: `npx tsc --noEmit` + `npm run build` 통과. 방금 만진 파일에 안 쓰는 import/변수 없나 grep. 컬럼 권한을 회수했으면 그 테이블의 `select('*')`가 코드에 남아있지 않은지 grep.
2. **런타임 스모크(프리뷰+Playwright)** — 게스트로 볼 수 있는 화면(`/`, `/auth`, `/space`)은 반드시:
   - `npm run preview`(4173) 실행 → Playwright로 해당 경로 navigate → **console 에러 0** 확인 → 스크린샷으로 렌더 눈으로 확인. (흰 화면/크래시는 여기서 잡힌다. 과거 NO_ACCESSORY 크래시가 이 방법으로 발견됨)
   - 로그인/데이터가 필요한 플로우(대여·차단·커뮤니티 등)는 프리뷰로 자동확인이 어려우므로, **코드 경로를 눈으로 추적**하고 "사용자 확인 필요"로 남긴다.
   - 끝나면 preview 프로세스 종료(`pkill -f "vite preview"`) + 브라우저 close.
3. **DB/RLS/RPC 변경 시** — 실제 프로젝트(venrajnufandslcbehkz)에 REST로 검증:
   - 테이블 존재/권한: `curl .../rest/v1/<t>?select=...` (404=없음, 401/42501=권한거부, 200=허용). anon 키는 `.env`의 VITE_SUPABASE_PUBLISHABLE_KEY.
   - RPC 호출 가능: `curl -X POST .../rest/v1/rpc/<fn>`(더미 인자) → 404 아니면 배포됨, 반환값으로 로직 확인.
   - 마이그레이션은 **IF NOT EXISTS/DROP-IF-EXISTS 가드**로 재실행 안전하게. 새 테이블은 RLS 정책뿐 아니라 **GRANT**(anon/authenticated)도 반드시(RLS만 있으면 permission denied). 컬럼 숨김은 컬럼 REVOKE가 아니라 **테이블 SELECT 회수 + 허용컬럼 GRANT**.
   - 사용자에게 **어떤 .sql을 실행해야 하는지** 명확히 알린다.
4. **회귀 체크**: 공용 경로(대여요청→수락→반납·채팅·로그인·책장 로드)를 건드렸으면 그 경로가 깨지지 않는지 코드로 확인. RLS 정책 교체 시 정책명 일치 여부 grep.
5. **흔한 함정 스스로 점검**: 중복 토스트(두 곳에서 같은 toast), Radix 모달을 커스텀 모달 안에 중첩(내부클릭 닫힘)→커스텀 오버레이 사용, 비동기 후 상태 재확인(레이스), 캐시 갱신 필요한 정적 에셋은 파일명 변경, PWA 흰화면(옛 SW/청크)."

## 핵심 문서
- `docs/CORE_FEATURES.md` — 핵심 기능 명세·불변식·작동상태(회귀 방지). **최우선 참고.**
- `docs/USER_TEST.md` — 유저 테스트 질문지/관찰 가이드.
- `PRD.md` · `DESIGN_GUIDE.md` · `LAUNCH_ISSUES.md` · `ACCOUNTS.md` · `docs/EVENT_SCHEMA.md`.

## 실행
- `npm run dev` (로컬), `npm run build`, `npm run check:notifications`(알림 라우트 가드).
- Supabase 마이그레이션은 사용자가 SQL Editor에서 실행(레포 `supabase/migrations/`). 새 마이그레이션 추가 시 실행 필요 여부를 명확히 알린다.
