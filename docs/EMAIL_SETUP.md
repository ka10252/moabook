# 메일 발송 설정

## 왜 필요한가

Supabase 기본 메일 발송은 **시간당 2통**이다. 테스트용이지 실서비스용이 아니다.
인증 메일을 못 받으면 로그인을 못 하고, 로그인을 못 하면 그 사람은 그냥 사라진다.
가입 퍼널의 마지막 구멍이다. 인증 메일과 비밀번호 재설정 메일이 **같은 한도를 나눠 쓴다**.

---

## 지금 쓰는 방법: Gmail SMTP (도메인 불필요)

지인 대상 소규모라 도메인 없이 간다. **Gmail 서버로 직접 보내므로 스팸함에 가지 않는다.**

### 왜 SendGrid Single Sender가 아닌가

SendGrid Single Sender는 `leeyjin212@gmail.com`을 발신자로 등록하는 방식이다.
그러면 메일이 **"gmail.com에서 보냈다"고 주장하면서 실제로는 SendGrid 서버에서** 나간다.
받는 쪽(Gmail·Outlook·네이버)은 이걸 세 단계로 검사한다:

| 검사 | 내용 | Single Sender | Gmail SMTP |
|---|---|---|---|
| **SPF** | gmail.com이 공개한 "대신 보낼 수 있는 서버 목록" | SendGrid는 없음 ❌ | Google 서버 ✅ |
| **DKIM** | 발신 도메인의 열쇠로 서명 | `sendgrid.net`으로 서명 → 불일치 ❌ | gmail.com 서명 ✅ |
| **DMARC** | SPF·DKIM 중 하나는 통과해야 함 | 둘 다 실패 ❌ | 통과 ✅ |

**세 개가 전부 실패한다.** 이건 스팸 발송자가 남의 주소를 사칭할 때 나타나는 정확한 패턴이고,
메일 서버는 그렇게 취급한다. Gmail SMTP는 **진짜로 Google이 보내는 것**이라 전부 통과한다.

### 유저에게 보이는 발신자

```
보낸사람:  MOA Book <moabook.sg@gmail.com>
제목:      MOA Book 이메일 인증
```

표시 이름(`MOA Book`)은 마음대로 정할 수 있지만 **주소는 인증한 gmail 계정으로 강제된다.**
Gmail SMTP가 스팸함을 피하는 이유가 바로 이것이다 — 실제로 그 계정이 보내는 것이기 때문.

### 설정 (10분)

0. **서비스 전용 gmail 계정을 새로 만든다** (예: `moabook.sg@gmail.com`)

   개인 계정을 쓰면 안 되는 이유:
   - 유저 전원에게 **내 개인 메일 주소가 노출**된다
   - 유저가 답장하면 **내 개인 메일함**으로 온다
   - Google이 대량 발송으로 판단해 계정을 제한하면 **내 실제 메일·드라이브·캘린더까지 묶인다**

   3분이면 만든다. 나중에 도메인을 사면 `noreply@moabook.com` 으로 갈아탄다.

1. **그 계정에 2단계 인증을 켠다** — [myaccount.google.com/security](https://myaccount.google.com/security)
   → 앱 비밀번호는 2단계 인증이 켜져 있어야만 만들 수 있다.

2. **앱 비밀번호를 만든다** — [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   → 이름은 아무거나 (`MOA Book`) → **16자리 비밀번호**가 나온다. 창을 닫으면 다시 못 본다.
   → 이건 Gmail 로그인 비밀번호가 **아니다**. 앱 전용이고, 언제든 이것만 폐기할 수 있다.

3. **`.env.local`** 을 만든다 (git에 안 올라간다):

```
SMTP_HOST=smtp.gmail.com
SMTP_USER=moabook.sg@gmail.com
SMTP_PASS=abcd efgh ijkl mnop      ← 앱 비밀번호 16자리 (띄어쓰기 빼도 됨)
SMTP_SENDER=moabook.sg@gmail.com
```

4. **`supabase/config.toml`** 에서 두 곳을 고친다:
   - `site_url` → Vercel 배포 주소 (**지금은 localhost. 이대로면 메일 링크가 localhost로 가서 아무도 못 누른다**)
   - `[auth.email.smtp]` 의 `enabled = false` → `true`

5. 밀어넣는다:

```bash
npm run config:push
```

> ⚠️ `config push` 는 `config.toml` **전체**를 원격에 덮어쓴다. 부분 적용이 아니다.
> 파일에 안 적힌 설정은 CLI 기본값으로 되돌아간다 — `enable_confirmations` 를 빠뜨리면
> 이메일 인증이 조용히 꺼진다. 그래서 config.toml 에 현재 상태를 전부 적어뒀다.

6. **확인**: 실제로 새 계정을 만들어서 메일이 오는지, **스팸함이 아니라 받은편지함에 오는지** 본다.

### 한계 (이래서 나중엔 옮겨야 한다)

- **하루 500통**. 지인 규모면 넘치지만 서비스가 커지면 막힌다.
- **gmail 주소가 그대로 보인다**. `noreply@moabook.com` 이 아니라 `moabook.sg@gmail.com`.
  앱스토어 심사에서 지적받는 지점이기도 하다.
- Google이 대량 발송으로 판단하면 그 계정을 제한할 수 있다.

---

## 나중에: 도메인 + Resend (공개 런칭 시)

**언제 옮겨야 하나** — 다음 중 하나라도 해당되면:
- 지인 밖의 사람이 가입하기 시작할 때
- 하루 가입/재설정 메일이 수십 통을 넘길 때
- 앱스토어 등재를 진행할 때 (개인 gmail 발신은 심사에서 지적받는다)

**절차 (30분 + 도메인 값)**

1. **도메인을 산다** — Cloudflare Registrar(원가 판매, 연 $10~12) 또는 Namecheap
2. [resend.com](https://resend.com) 가입 → **Domains → Add Domain**
3. Resend가 알려주는 **DNS 레코드 3개(SPF·DKIM·DMARC)** 를 도메인 DNS에 붙여넣는다
   → 이게 "이 서버가 내 도메인을 대신해 보내도 된다"고 공개 선언하는 것이다.
     Single Sender가 못 했던 바로 그것.
4. 인증되면 **API Keys → Create API Key** → `re_...` 복사
5. `.env.local` 을 바꾼다:

```
SMTP_HOST=smtp.resend.com
SMTP_USER=resend
SMTP_PASS=re_xxxxxxxxxxxx
SMTP_SENDER=noreply@내도메인.com
```

6. `npm run config:push`

무료 3,000통/월 · 100통/일. 도메인은 **웹 주소로도 같이 쓴다** (`moabook.vercel.app` → `moabook.com`).

### 왜 vercel.app으로는 안 되나

Resend에 도메인을 등록하려면 **그 도메인의 DNS 레코드를 직접 추가**해야 한다.
`.vercel.app` 의 DNS는 **Vercel이 소유**한다 — 우리가 레코드를 넣을 수 없다.
그래서 Resend는 `.vercel.app` 주소를 인증해주지 않는다.

**단, 웹 주소로 vercel.app을 쓰는 건 아무 문제 없다.** HTTPS도 되고 iPhone 푸시도 된다.
메일 발송 도메인과 웹 주소는 별개의 문제다.

---

## 메일 본문

`supabase/templates/` 에 한국어 템플릿이 있다. Supabase 기본 템플릿은 영어다 —
한국인 대상 서비스인데 영어 메일이 오면 유저는 그걸 스팸으로 본다.

| 파일 | 언제 |
|---|---|
| `confirmation.html` | 회원가입 인증 |
| `recovery.html` | 비밀번호 재설정 |

메일 클라이언트는 `<style>` 태그와 최신 CSS를 자주 무시하므로 **table 레이아웃 + 인라인 스타일**로만 짰다.
