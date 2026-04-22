# 약사톡 — Claude Code 작업 규칙

> 매 세션 시작 시 자동 로드되는 파일.
> 상세 기획: `마이그레이션 v3.2` / 디자인 상세: `DESIGN_REFERENCE.md` (프로젝트 루트)

---

## 프로젝트
- **약사톡**: 만성·기능성 증상 환자 ↔ 영양제 전문 약사 매칭 플랫폼
- **단계**: 프론트엔드 Mock (Supabase 연결 전)
- **사용자**: 비개발자 약사가 기획, Claude Code로 구현

---

## 기술 스택
- Next.js 15 (App Router) + TypeScript
- CSS 변수 기반 디자인 시스템
- Mock 데이터 기반 UI 구동

---

## 작업 명령
- `npm run dev` — 개발 서버 (localhost:3000)
- `npm run build` — 수정 후 **반드시 실행**하여 에러 0건 확인

---

## 절대 금지

### 수정 금지 파일
- `src/styles/globals.css` (디자인 시스템 전역 CSS)
- `src/app/layout.tsx` (루트 레이아웃)
- 명시적으로 요청되지 않은 기존 페이지 파일

### 실행 금지
- `git push`, `git commit`, `git add` (사용자 직접 수행)
- 파일/폴더 삭제 (`node_modules`, `.next` 예외)
- DB 마이그레이션 (백엔드 미연결)

---

## DESIGN_REFERENCE.md 필수 참조
새 페이지/컴포넌트 작업 전 반드시 확인:
- 증상별 아이콘 컬러 매핑
- 공통 컴포넌트 사용처
- 피드 카드 / 필터 칩 디자인
- 사이드 패널 종류별 용도
- 전송 확인 팝업 스펙

---

## 디자인 시스템 요약

### 컬러
- Sage Green: `#4A6355` `#5E7D6C` `#7FA48E` `#B3CCBE` `#EDF4F0` `#F8F9F7`
- Terracotta: `#C06B45` `#F5E6DC` `#FBF5F1`
- Text: `#2C3630` (진함) / `#3D4A42` (보통)
- Border: `rgba(94, 125, 108, 0.14)`

### 폰트
- 제목: Gothic A1
- 본문: Noto Sans KR

### 가독성 (40~60대 타겟)
- 본문 **최소 14px**
- 설명 텍스트 **최소 15px + 색상 #3D4A42 이상**
- `#7A8A80`은 placeholder/비활성 상태에만 사용 (읽어야 하는 텍스트 금지)
- 터치 영역 **최소 48px**

### 반응형
- 환자용: 모바일 퍼스트, `max-width: 560px`
- 약사용: 모바일 + 데스크톱 (≥1200px 2열)

---

## UI 금지 용어
의료 행위 암시 금지 — 위반 시 법적 리스크:

| 금지 | 대체 |
|---|---|
| 치료 | 관리 / 케어 |
| 치험례 | 개선 사례 |
| 완치 | 개선 / 호전 |
| 처방 | 상담 가이드 / 분석 리포트 |
| 진단 | 분석 / 체크 |
| 택배 | UI 노출 금지 (내부 로직만) |

허용: 추천, 상담, 분석, 개선, 관리, 가이드

---

## 프로젝트 구조

```
src/app/
├── (환자)
│   page.tsx                    랜딩 /
│   signup/                     가입
│   questionnaire/              AI 문답
│   questionnaire-result/       가입 유도
│   match/                      약사 매칭
│   pharmacist/[id]/            약사 프로필
│   feed/                       개선 사례 피드
│   feed/new/                   사례 등록
│   feed/recommend/             약사의 이야기
│   mypage/                     환자 마이페이지
│   health-check/               몸 상태 체크
│
├── (공용)
│   chat/                       채팅 목록
│   chat/[id]/                  채팅 (?role=pharmacist 약사뷰)
│
└── (약사)
    dashboard/                  대시보드
    chart/[id]/                 환자 차트
    report/new/                 보낸 가이드 목록
    patient/new/                오프라인 환자 등록
    pharmacist/mypage/          약사 마이페이지
    pharmacist/templates/       답변 템플릿
    pharmacist/performance/     내 실적
    pharmacist/questionnaire/   추가 질문 세트 편집
    signup/pharmacist/          약사 가입

src/components/
├── HealthIndicatorComparison.tsx  마이페이지 + 차트
├── PhotoLightbox.tsx              피드 + 약사 프로필
├── SymptomIcon.tsx                랜딩 + 피드
└── ui/                            일반 UI
```

---

## 공통 컴포넌트 규칙
같은 기능은 공통 컴포넌트로 관리. 디자인 변경은 컴포넌트 하나만 수정해서 양쪽에 반영:

- **건강지표 비교**: `HealthIndicatorComparison.tsx` — 마이페이지 + 차트
- **증상 아이콘**: `SymptomIcon.tsx` — 랜딩 + 피드
- **사진 라이트박스**: `PhotoLightbox.tsx` — 피드 + 약사 프로필

새로 만들기 전에 기존 공통 컴포넌트 재사용 가능한지 먼저 확인.

---

## 코드 패턴

### 페이지 구조
- `page.tsx` (서버 컴포넌트, 얇게)
- `XxxClient.tsx` (`'use client'`, 로직)

### Mock 데이터
- 파일 상단 또는 `src/data/xxxMock.ts`로 추출
- 여러 페이지에서 공유하는 Mock은 반드시 별도 파일

### 스타일
- 인라인 `style` 또는 CSS Modules
- `globals.css` 수정 대신 컴포넌트 내부 처리

---

## 작업 완료 보고 형식
- 수정한 파일 목록만 간결히 나열
- `npm run build` 에러 0건 확인
- 긴 설명/요약 불필요, "완료" 한 마디면 충분

---

## 응답 스타일 (Opus 4.7 대응)
Opus 4.7은 장황해지는 경향이 있음. 다음 규칙 준수:

- **간결하게**: 한 번 말한 내용 반복 금지
- **불필요한 예시 자동 추가 금지** (사용자 요청 시만)
- **전문 용어 짧은 설명 필수** (hover, useState, flex 등 처음 등장 시)
- **확인 URL 빠뜨리지 말 것** (매 작업마다 포함)
- **마크다운 코드블록 안에 마크다운 중첩 금지** (복사 시 깨짐)
- 직접 구현 가능한 판단은 사용자에게 되묻지 말 것

---

## 핵심 비즈니스 규칙 (변경 금지)
- 근거리 매칭: 환자 부담 0원
- 상담 리포트는 성분 방향만 (구체적 제품명/용량 금지)
- 같은 환자 = 하나의 채팅방 (차수 탭으로 구분)
- "상담 완료" 개념 없음 → "비활성"
- 플랫폼은 의료 행위 아님 ("영양 상담 연결 서비스")

---

*v2 — 2026.04.22 — Opus 4.7 최적화*
