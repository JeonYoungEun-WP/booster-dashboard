# Adriel 벤치마킹 레퍼런스

이 문서는 booster-dashboard 설계·구현 시 참고할 Adriel(adriel.com) 기능 스펙입니다.
(출처: 2026-04 사용자 제공 탐색 보고서)

---

## 서비스 정의
Adriel = AdOps 플랫폼. 다채널 광고 데이터 통합 → 대시보드·리포트·자동화·AI 인사이트.

## 글로벌 내비게이션 (좌측 아이콘 사이드바)
- 데이터 연결 (플러그)
- 대시보드 (막대차트)
- 자동화 (알림)
- AI 에이전트 (반짝이, BETA)
- 가이드북 (헬프센터 링크)
- 설정 (톱니)
- 팀 관리 (사람 — 워크스페이스 전환·초대·로그아웃)

## 대시보드 상단 툴바
사이드바 토글 · 날짜 필터 · 필터 · 레이아웃 토글 · 리포트 모드 전환 · 스냅샷·저장 · 공유 · 스타일 · 새로고침 · AI 에이전트 · 위젯 추가

---

## 데이터 연결 — 100+ 채널

### Paid Ads (요약)
Meta, Google, Naver Search/GFA, Kakao Keyword/Moment/Message, TikTok, LinkedIn, Microsoft, Apple Search, Pinterest, Snapchat, X, Reddit, Criteo/Retail Media, Taboola, Outbrain, StackAdapt, RTB House, Awin, Amazon Ads/DSP/Vendor, Klaviyo, Yahoo JP, Baidu, TikTok GMV Max, SmartNews, AppLovin, The Trade Desk, Moloco, Singular, Airbridge, AppsFlyer, Adjust, Line, Coupang, Shopee, Samsung, SEMrush, AdRoll, Adform, Teads, Quora, HubSpot, Walmart Connect, WooCommerce, Mailchimp, Amplitude, 당근(Karrot) ··· 외 다수

### Organic/Social
Instagram/LinkedIn/X/TikTok/YouTube/Facebook Page/KakaoTalk Channel/Reddit Public/Yelp/WhatConverts

### Analytics
GA4, CM360, DV360, Search Console, Keyword Planner, Trends, GBP, Matomo, Piano Analytics

### Commerce
Cafe24, Shopify, Shopee, Imweb, MakeShop, Coupang, BigQuery, SA360

### File / DB
Google Sheets, CSV, Email, SFTP, OneDrive, MySQL, MongoDB, PostgreSQL, Snowflake(β), S3

### 연결 관리 UI
상태 배지(연결됨 초록·실패 빨강·데이터 혼합 파랑), 마지막 업데이트 표시, 필터(채널/상태/혼합), 재연결 버튼, 공유 링크(비즈니스 링크), 페이지네이션

---

## 대시보드

### 계층 구조
`워크스페이스 > 팀스페이스 > 폴더 > 대시보드(뷰) > 위젯 > 데이터소스 > 채널>캠페인>광고그룹>광고`

### 날짜 필터
프리셋(이번달/지난달/이번주/지난주/오늘) + 커스텀 범위 + 비교 기간(전기대비) + `todayExcluded`

### 필터
채널, 캠페인/그룹/광고, 자동 라벨링

### 위젯 (카테고리별)
- **General**: 성과 추세(Trend Cards), 단일 지표(Single Metric), 알람, 광고 소재(Creative), 노트패드, 목표(Goal)
- **Tables**: 광고 테이블(계층), 범용/심플 테이블
- **Charts**: 칼럼, 수평 바, 라인, 콤보, 분산형

### KPI 지표
광고비(VAT 제외·포함), 노출, 클릭, CPC, CTR, CPM, 도달, Lead, 전환, 전환당 비용, **맞춤 지표(수식)**

### 고급 기능
- 대시보드에서 캠페인 On/Off 직접 제어
- 수식 기반 Custom Metric
- 맞춤 폴더(캠페인 그룹 관리)
- UTM 자동 라벨링
- 데이터 스냅샷 (특정 시점 저장·비교)
- KPI 목표 설정(기간별 달성률)
- 광고 이미지 그룹
- 캠페인 비교 테이블 (2개 나란히)
- Amplitude 퍼널 연동
- 색상/폰트 커스터마이징

---

## 리포트 모드
- 슬라이드 PDF 리포트 (다페이지)
- 표지: 로고·제목·부제·기간 자동
- 대시보드 → 리포트 자동 변환
- 저장: 현재 페이지 / 새 페이지
- PDF export, 스냅샷 저장·목록, 새로고침, 테마 수정, 링크 공유
- 좌측 슬라이드 패널(미리보기·순서 변경), 배율 조정, 다운로드

### PDF 브랜딩 (설정)
로고(SVG/JPG/PNG ≤5MB, 120px 권장), 웹사이트 URL, 브랜드 색상(hex)

---

## 자동화 — 6가지 유형
1. 지표 임계값 모니터링 (CTR/CPA/ROAS 등 임계 초과·미달)
2. 시간 경과 지표 변경 추적 (기간 대비 증감률)
3. 광고 계정 상태 추적 (비활성/차단/연결끊김)
4. UTM 파라미터 조건 확인 (누락/키워드 포함·미포함)
5. 광고 콘텐츠 키워드 모니터링 (헤드라인/설명)
6. 광고·광고세트 승인 상태 추적

### 설정
유형 → 채널 → 적용 대상(캠페인/그룹/광고) → 조건 → 주기(일/주/월) → 동작(이메일/Slack 등)

---

## AI 에이전트 (Beta)
- "워크스페이스 데이터나 마케팅, 무엇이든"
- 컨텍스트 추가, 채팅 히스토리
- 예시 프롬프트: 최신 결과 요약 / 성과 좋은 광고 / 경영진 보고서 / 클라이언트 이메일

---

## 설정
플랜(Starter·T·파트너), 워크스페이스·권한·멤버·예약 내보내기, 프로필, 언어, 비밀번호, 결제, PDF 브랜딩

---

## UI/UX 원칙
- 2패널(아이콘 사이드바 + 메인)
- 폴더 트리(접기/펼치기)
- 뷰 목록 ↔ 위젯 목록 듀얼 탭
- 드래그앤드롭 위젯 배치
- 로딩 진행률 토스트
- Primary 파란색, AI 보라색
- 대시보드/리포트 모드 동일 데이터 2뷰
- 채널 공식 로고 아이콘

---

## 핵심 차별화 5
1. **100+ 채널 연동**
2. **위젯 기반 드래그앤드롭 대시보드**
3. **대시보드 ↔ 리포트 모드 전환**
4. **자동화 룰 엔진**
5. **AI 에이전트**

---

## 통합 스키마 (구현 참고)
```ts
interface AdMetric {
  connection_id: string
  channel: 'meta' | 'google' | 'naver' | 'kakao' | 'tiktok' | 'karrot' | ...
  date: string
  campaign_id: string
  campaign_name: string
  adset_id?: string
  ad_id?: string
  metrics: {
    spend: number
    impressions: number
    clicks: number
    cpc: number
    ctr: number
    cpm: number
    reach?: number
    conversions: number
    conversion_value: number
    // 채널별 커스텀 지표
  }
}
```

## 구현 필수 모듈 (백엔드·프론트)
- 백: OAuth, 스케줄러, 정규화, 메트릭 엔진, 자동화 룰, 리포트 PDF, 스냅샷, AI+RAG, RBAC
- 프론트: 위젯 드래그앤드롭, 차트 라이브러리, 트리 테이블, 날짜 피커, 리포트 편집기, PDF export, 룰 빌더, AI 채팅
