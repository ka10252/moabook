# Universal Links · App Links 설정

메일의 `https://moabook.vercel.app/auth?...` 링크를 **브라우저 대신 앱**이 받게 하는 파일들이다.
지금은 자리표시자(`REPLACE_...`)가 들어 있어 **동작하지 않는다** — 그때까지는
`moabook://` 커스텀 스킴이 그 역할을 한다(이미 동작함).

## 1) `assetlinks.json` (Android)
`REPLACE_WITH_RELEASE_SHA256`에 **릴리스 서명 키의 SHA-256 지문**을 넣는다.

```bash
keytool -list -v -keystore <릴리스키.jks> -alias <별칭> | grep SHA256
```

⚠️ 디버그 키 지문으로는 스토어 배포본이 검증되지 않는다.
Play App Signing을 쓰면 **Google이 다시 서명**하므로,
Play Console → 앱 무결성 → 앱 서명 키 인증서의 지문을 써야 한다. (둘 다 넣어도 된다 — 배열이다)

## 2) `apple-app-site-association` (iOS)
`REPLACE_WITH_TEAMID`에 **Apple Developer Team ID**를 넣는다
(Apple Developer → Membership). 결과는 `ABCDE12345.app.moabook` 꼴.

⚠️ 확장자를 붙이지 않는다. `Content-Type: application/json`으로 서빙돼야 한다.

## 3) 확인
배포 후 아래가 **JSON 그대로** 나와야 한다(리다이렉트·HTML 금지).

```bash
curl -sI https://moabook.vercel.app/.well-known/assetlinks.json
curl -s  https://moabook.vercel.app/.well-known/apple-app-site-association
```

그다음 `AndroidManifest.xml`의 App Links intent-filter 주석을 풀고,
Xcode에서 Signing & Capabilities → **Associated Domains**에
`applinks:moabook.vercel.app`을 추가한다.
