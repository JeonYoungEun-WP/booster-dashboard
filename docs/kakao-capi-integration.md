# 카카오 CAPI (Conversion API) 연동 가이드

> 부스터맥스 카카오 전환 API 연동 시 참고할 정보 모음. 2026-04-25 정리.
> 출처: [Airbridge — 카카오 CAPI 연동](https://www.airbridge.io/ko/blog/airbridge-kakao-capi-integration), [카카오 비즈니스 가이드 — Conversion API](https://kakaobusiness.gitbook.io/main/tool/pixel-sdk/conversion-api), [Kakao Developers — 카카오모먼트](https://developers.kakao.com/docs/latest/ko/kakaomoment/common), [카카오 데브톡 권한 신청 가이드](https://devtalk.kakao.com/t/api/149226).

---

## 1. CAPI vs 광고 운영 API — 두 개를 절대 혼동하지 말 것

| 구분 | Conversion API (CAPI) | 카카오모먼트 광고 운영 API |
|---|---|---|
| 용도 | **전환 이벤트 전송** (서버→카카오) — 픽셀 보완 | 캠페인·광고그룹·소재 CRUD, 통합성과보고서 다운로드 |
| 카카오 측 별도 승인 | ❌ **불필요** (광고주가 콘솔에서 토큰 자체 발급) | ✅ **필요** (공식대행사 권한 또는 사전 협의 광고주만) |
| 신청 경로 | 카카오모먼트 콘솔 → 픽셀&SDK → API 토큰 발급 | 담당 카카오 마케터 / 카카오광고 통합 에이전시 문의게시판 → 카카오모먼트 운영 → API 권한신청 |
| 토큰 한도 | 픽셀당 최대 5개 인증 토큰 | — |
| 데이터 흐름 | 광고주 서버 → 카카오 (해시 식별자 포함) | 광고주 권한으로 카카오 API 호출 |

**핵심**: 부스터맥스가 광고주의 전환 이벤트를 카카오로 전송하는 것 자체는 **카카오 승인 없이 가능**. 캠페인을 직접 만들거나 자동화하려면 별도 권한 신청 필요.

---

## 2. CAPI 구현 사전 조건 (광고주 측)

| 항목 | 내용 |
|---|---|
| 카카오모먼트 비즈니스 계정 | 사업자 등록 기반 비즈니스 인증 완료 필수 |
| 카카오 픽셀 & SDK ID | 모먼트 콘솔에서 발급 — 기존 ID 재활용 권장 (학습 데이터 누적 효과) |
| CAPI 인증 토큰 | 픽셀당 최대 5개. 발급 후 안전한 곳에 저장 (서버 환경변수) |
| 데이터 처리 약관 | 광고주 ↔ 카카오 간 데이터 처리 동의서 정비 |
| 사용자 동의 수집 | 개인정보 처리 + **마케팅 활용 동의** 필수 |
| `adPersonalization` 필드 | 마케팅 활용 동의한 사용자 이벤트만 카카오로 전송 |

### 데이터 보안
- 식별자(이메일·전화번호)는 **SHA-256 해시 후 전송**
- 카카오는 접근 통제된 분리 저장소에 보관
- 평문으로 절대 보내지 말 것 (개인정보 위반)

---

## 3. 부스터맥스 입장 — 시나리오별 작업

### 시나리오 A: 광고주 토큰을 받아 부스터맥스가 대신 전송 (SaaS 패턴) — 권장

| 단계 | 작업 |
|---|---|
| 1 | 광고주가 자신의 카카오모먼트 콘솔에서 픽셀 ID + CAPI 토큰 발급 |
| 2 | 부스터맥스 UI에서 광고주가 (픽셀 ID, CAPI 토큰) 입력·저장 (암호화 저장) |
| 3 | 부스터맥스 서버가 해당 토큰으로 카카오 CAPI 엔드포인트 호출 |
| 4 | 식별자는 SHA-256 해시, `adPersonalization=true` 사용자만 |

**카카오 측 승인** ❌ 불필요 — 각 광고주의 토큰으로 보내기 때문.

**Vercel 호환**: 카카오 CAPI는 동적 IP에서 호출 가능 — 사내 IP 제약(`222.109.27.119`)이 적용되는 광고 데이터 조회 API와 다름. Vercel 서버리스에서 직접 호출 OK.

### 시나리오 B: 부스터맥스가 광고주 캠페인을 직접 운영 (자동화)

- 카카오모먼트 광고 운영 API 권한 신청 필요
- **공식대행사 등록** 또는 **광고주별 사전 협의**
- 신청: [카카오광고 통합 에이전시 문의](https://emp.business.kakao.com/) → 카카오모먼트 운영 → API 권한신청

### 시나리오 C: 통합성과보고서 자동 다운로드

- 별도 권한 신청 (Kakao 데브톡 안내)
- 카카오디벨로퍼스 앱에 비즈니스 인증 + 통합성과보고서 권한

---

## 4. 권장 진행 순서 (부스터맥스 로드맵)

1. **Phase A — CAPI 단방향 전송**
   - UI: 광고주가 자기 픽셀 ID + 토큰 입력 (`/integrations/kakao` 같은 메뉴)
   - 백엔드: CAPI 토큰 암호화 저장 (DB or Vercel KV) + 전송 모듈
   - 이벤트 매핑: 부스터맥스의 리드 폼 제출 → 카카오 `complete_registration`, 결제 → `purchase` 등
   - 식별자 정리: 이메일/전화번호 → SHA-256
2. **Phase B — 광고 운영 API** (필요 시)
   - 공식대행사 등록 검토 또는 광고주별 협의 권한
   - 캠페인 CRUD, 보고서 자동 다운로드
3. **Phase C — 통합 분석 대시보드**
   - 카카오 전환 데이터를 부스터맥스 풀퍼널에 합산 (이벤트 1042/3550 같은 구조)
   - 다른 매체 (Meta, Google, TikTok, 당근) CAPI 연동 패턴 통일

---

## 5. 카카오 CAPI HTTP 엔드포인트 (예상 형태)

> 정확한 스펙은 카카오 비즈니스 가이드 최신 문서 참조. 아래는 일반적인 구조 메모.

```
POST https://capi.kakao.com/v1/event
Authorization: KakaoAK {CAPI_TOKEN}
Content-Type: application/json

{
  "pixel_id": "<픽셀 ID>",
  "events": [
    {
      "event_name": "complete_registration",
      "event_time": 1735000000,
      "user_data": {
        "em": "<sha256(email)>",
        "ph": "<sha256(phone)>",
        "ad_personalization": true
      },
      "custom_data": {
        "currency": "KRW",
        "value": 0
      },
      "event_source_url": "https://heypick.co.kr/tasks/11924"
    }
  ]
}
```

응답 200 + `events_received` 카운터 확인. 디버그 모드 / 테스트 이벤트 코드 제공 여부 확인 필요.

---

## 6. 환경변수 설계 안 (Phase A)

`.env.local` 추가 예정:

```
# 카카오 CAPI — 광고주별 토큰은 DB 저장. 아래는 부스터맥스 측 메타.
KAKAO_CAPI_BASE_URL=https://capi.kakao.com
KAKAO_CAPI_TIMEOUT_MS=5000
# 광고주별 (pixel_id, capi_token) 는 별도 암호화 테이블에 저장
# 예: integrations_kakao { advertiser_id, pixel_id, capi_token_enc, created_at }
```

토큰 암호화: Vercel encrypted env 또는 자체 KMS. 평문 저장 금지.

---

## 7. 체크리스트 (연동 시작 시)

- [ ] 광고주 카카오모먼트 비즈니스 인증 완료 확인
- [ ] 광고주 픽셀 ID + CAPI 토큰 수령
- [ ] 토큰 암호화 저장 구조 설계
- [ ] 이벤트 매핑 표 합의 (부스터맥스 이벤트 ↔ 카카오 표준 이벤트)
- [ ] SHA-256 해시 유틸 + 정규화 (소문자·공백 제거)
- [ ] 전송 실패 재시도 큐 (Vercel cron 또는 외부 큐)
- [ ] 사용자 마케팅 동의(`adPersonalization`) 필드 폼에 포함
- [ ] 테스트 이벤트로 수신 확인 (카카오 모먼트 디버거)
- [ ] 광고주별 전송량 / 성공률 모니터링 대시보드

---

## 8. 참고 링크

- [Airbridge — 카카오 CAPI 연동 가이드](https://www.airbridge.io/ko/blog/airbridge-kakao-capi-integration)
- [카카오 비즈니스 가이드 — Conversion API](https://kakaobusiness.gitbook.io/main/tool/pixel-sdk/conversion-api)
- [Kakao Developers — 카카오모먼트 이해하기](https://developers.kakao.com/docs/latest/ko/kakaomoment/common)
- [카카오모먼트 API 권한 신청 (데브톡)](https://devtalk.kakao.com/t/api/149226)
- [카카오모먼트 CAPI 문의 (데브톡)](https://devtalk.kakao.com/t/capi/148695)
- [카카오광고 통합 에이전시](https://emp.business.kakao.com/)
