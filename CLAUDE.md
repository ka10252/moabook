# moabook — Claude 작업 규칙

모아북(모아북, 싱가포르 한인·유학생 하이퍼로컬 책공유: 대여·판매·나눔). 작업 디렉터리: `~/Desktop/moabook`.
스택: Vite + React 18 + TS + Tailwind + shadcn/ui + Framer Motion, Supabase(Postgres·RLS·Auth·Realtime·Storage·Edge Functions), Phaser(가상공간). 배포: Vercel(main push 자동배포).

## 상시 규칙 (반드시 지킬 것)
1. **배포는 지시할 때만** — `git push`(=Vercel 자동배포)는 사용자가 "배포해"라고 할 때만 한다. 그 전까지는 **로컬 커밋까지만**. 작업이 끝나면 "커밋했고 배포 대기 중"이라고 알린다. (잦은 배포가 홈스크린 PWA 하얀 화면을 유발함)
2. **기능 변경 시 문서 갱신** — 기능을 추가/수정하면 반드시 `docs/CORE_FEATURES.md`의 해당 항목(무엇/데이터흐름/불변식/작동상태)을 함께 갱신한다.
3. **작업 완료 후 다음 작업 질문** — 한 작업을 끝낼 때마다 백로그에서 다음에 할 후보들을 **마크다운 표(테이블) 형태**로 보여주고, 사용자가 **대화창에 직접 입력**해 고르게 한다. AskUserQuestion 같은 선택지 UI는 쓰지 않는다. 백로그 출처: 메모리 `project-moabook-backlog`, `LAUNCH_ISSUES.md`, `docs/CORE_FEATURES.md`의 "알려진 버그·리스크".
4. **회귀 방지** — 공용 테이블(notifications/messages/transactions/books)에 트리거를 붙이거나 고칠 때는 `docs/CORE_FEATURES.md`의 "트리거 안전 규칙"을 지킨다: 외부 호출(`net.http_post`)은 `BEGIN…EXCEPTION` 래핑 + pg_net 함수는 `set search_path to 'public','net','extensions'`. 변경 후 반드시 **대여 요청→수락→반납** 경로를 실제로 확인한다.
5. **빌드+타입 확인** — 커밋 전 `npx tsc --noEmit` **와** `npm run build` 둘 다 통과 확인. ⚠️ vite build(esbuild)는 **타입체크를 안 함** → import 누락/undefined 참조가 빌드는 통과하고 런타임에 터진다(예: 사서 NO_ACCESSORY 미import로 커뮤니티룸 전체 크래시). tsc를 반드시 별도로 돌릴 것.

## 핵심 문서
- `docs/CORE_FEATURES.md` — 핵심 기능 명세·불변식·작동상태(회귀 방지). **최우선 참고.**
- `docs/USER_TEST.md` — 유저 테스트 질문지/관찰 가이드.
- `PRD.md` · `DESIGN_GUIDE.md` · `LAUNCH_ISSUES.md` · `ACCOUNTS.md` · `docs/EVENT_SCHEMA.md`.

## 실행
- `npm run dev` (로컬), `npm run build`, `npm run check:notifications`(알림 라우트 가드).
- Supabase 마이그레이션은 사용자가 SQL Editor에서 실행(레포 `supabase/migrations/`). 새 마이그레이션 추가 시 실행 필요 여부를 명확히 알린다.
