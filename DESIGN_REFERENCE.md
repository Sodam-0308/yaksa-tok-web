# 약사톡 디자인 레퍼런스

이 문서는 각 화면의 확정된 디자인을 기록합니다.
새 작업 시 이 문서를 먼저 읽고 일관성 유지하세요.

## 컬러 팔레트
- Primary Sage: #4A6355, #5E7D6C, #7FA48E, #B3CCBE, #EDF4F0, #F8F9F7
- Accent Terra: #C06B45, #F5E6DC, #FBF5F1
- Text: #2C3630, #3D4A42
- Border: rgba(94, 125, 108, 0.14)

## 건강 변화/건강지표 (마이페이지 + 차트 공통)
**이것은 공용 컴포넌트로 관리됩니다. 디자인 변경은 컴포넌트만 수정.**

- **컴포넌트:** `src/components/HealthIndicatorComparison.tsx`
- **사용처:**
  - `src/app/mypage/MypageClient.tsx` "내 건강 변화" 섹션
  - `src/app/chart/[id]/ChartClient.tsx` "환자 건강지표" 섹션
- **두 페이지는 반드시 이 컴포넌트를 공유할 것.** 디자인 변경 시 컴포넌트 파일만 수정하면 양쪽에 동시 반영됨.
- 스타일은 `globals.css` 의 `.my-health-summary` / `.my-health-headline` / `.my-health-period` / `.my-health-bars` / `.my-bar-row` / `.my-bar-label` / `.my-bar-track` / `.my-bar-before` / `.my-bar-after` / `.my-bar-score` / `.my-bar-diff` / `.my-bar-badge` / `.my-health-check-btn` / `.my-health-check-desc` 를 재사용 (globals.css 수정 금지).

**Props:**
```ts
interface HealthIndicatorItem {
  label: string;            // 항목명
  before?: number;          // 이전 점수 (1~10). undefined면 비교 불가
  after: number;            // 현재 점수 (1~10)
  lowerIsBetter?: boolean;  // 낮을수록 좋은 지표 (예: 증상 불편도)
}
interface Props {
  previousDate?: string;
  currentDate?: string;
  items: HealthIndicatorItem[];
  summaryHeadline?: string;   // 미지정 시 자동 ("N개 항목이 개선되었어요!")
  showCheckButton?: boolean;  // 기본 true
  checkBtnLabel?: string;
  checkBtnDesc?: string;
  onCheckClick?: () => void;
  emptyState?: boolean;
  onEmptyCheckClick?: () => void;
}
```

**렌더 구조 (globals.css 클래스 기반):**
- 상단 요약 카드: `.my-health-summary` (세이지 파스텔 배경) > `.my-health-headline` + `.my-health-period`
- 비교 막대 목록: `.my-health-bars` > 각 항목 `.my-bar-row` > `.my-bar-label` + `.my-bar-track` (이전 `.my-bar-before` 회색 + 현재 `.my-bar-after` 세이지 딥) + `.my-bar-score` "X → Y" + `.my-bar-diff` "+2 ↑" + `.my-bar-badge` "개선 확인"
- 체크 버튼: `.my-health-check-btn` + `.my-health-check-desc`

**이전 기록 없을 때 (before === undefined):**
- 이전 막대 숨김, 현재만 표시
- 숫자는 "5" (X→Y 아님)
- 변화 뱃지 숨김
- 요약 카드 문구 "다음 체크부터 변화를 비교할 수 있어요" (테라 컬러)

**빈 상태 (emptyState=true):**
- 📊 이모지 + "아직 건강 변화 기록이 없어요" + "몸 상태를 체크하면 변화를 확인할 수 있어요" + [몸 상태 체크하기] 버튼

## 복용 가이드 디자인
위치: `src/app/mypage/MypageClient.tsx` "내 복용 가이드" 섹션 참조

구조:
- 약사 카드 형태 (접기/펼치기)
- 상단: 약사 아이콘 + 이름 + 약국 + 날짜
- 펼치면:
  - 영양제 항목: 이름 (진하게) + 1알 씩 + 복용시간 / 설명
  - 생활 가이드 박스 (테라코타 파스텔 배경 #FBF5F1)
  - 생활 가이드 내용 (카페인 줄이기 등)
- 최신 가이드는 기본 펼쳐짐, 이전 것은 접힘

## 채팅 사이드 패널 디자인
위치: `src/app/chat/[id]/ChatClient.tsx` (role=pharmacist) 참조

구조:
- 상단: 뒤로가기 버튼 + 환자 이름 + 증상 태그 + 접속 상태
- 환자 화면/약사 화면 토글 버튼 (테라코타 강조)
- 차수 탭 (03.15~, 04.11~ 책갈피 스타일)
- 팔로업 예정 배너
- 메시지 영역
- AI 답변 초안 받기 버튼
- 하단: 템플릿 / 팔로업 설정 / 방문 안내 / 방문전 리포트 버튼
- 메시지 입력란

## 아이콘 시스템
증상 카테고리 (컬러 원형 40px + SVG 라인 22px):
- 초록(#EAF3DE/#3B6D11): 만성피로(배터리), 체중 관리(체중계)
- 앰버(#FAEEDA/#854F0B): 소화장애(밥그릇), 변비/장건강(매듭)
- 파랑(#E6F1FB/#185FA5): 불면/수면(달+별)
- 코랄(#FAECE7/#993C1D): 여성건강(♀), 피부, 탈모, 항노화
- 틸(#E1F5EE/#0F6E56): 비염/알레르기, 면역력저하
- 퍼플(#EEEDFE/#534AB7): 우울/불안/스트레스

## 타이포그래피
- 제목: Gothic A1
- 본문: Noto Sans KR
- 최소 크기: 14px (40~60대 타겟)
- 설명 텍스트 색상: #3D4A42 이상 (#7A8A80 사용 금지)

## 사이드 패널 종류
약사 작업 중 사용하는 사이드 패널은 4종류로 분리되어 있습니다. 각 패널은 진입 페이지와 용도가 다르므로 혼동하지 마세요.

1. **환자 차트 사이드 패널** (채팅 페이지에서 호출)
   - 진입: `src/app/chat/[id]?role=pharmacist` 의 우측 상단 "차트 보기" 버튼
   - 내용: 환자 기본 정보(이름·성별·생년월일/나이·키·몸무게·기록일) + 예산 + 증상(전체 N, 진행 중/해결됨) + 상세 정보(직업·생활습관·식습관·수면·음주·흡연·카페인) + 방문 기록(날짜별 간략)
   - 데스크톱 1200px+ 에서 fixed 우측 400~500px

2. **방문전 리포트 사이드 패널** (채팅 페이지에서 호출)
   - 진입: `src/app/chat/[id]?role=pharmacist` 하단 "방문전 리포트" 버튼
   - 내용: 환자 요약 카드 + 영양 성분 방향(ON/OFF + 체크박스 태그들: 비타민류·미네랄·장 건강·항산화·수면/이완·관절/연골·면역·기타) + 생활 습관 추천(카테고리 선택 후 세부 체크) + 약사 코멘트(0/300) + 하단 자동 문구 "약국 방문 시 체질에 맞는 제품 추천해드릴게요" + [리포트 전송]

3. **복용 가이드 사이드 패널** (차트 페이지에서 호출)
   - 진입: `src/app/chart/[id]` 하단 "복용 가이드 열기" 버튼
   - 내용: 환자 이름 카드 + 영양제+복용법(이름·용량·복용 시점, [최근 방문 기록에서 복사]/[전체 삭제]) + 복용 일수(일분, 종료 예정일 자동) + 맞춤 가이드(0/500) + [가이드 전송]

4. **채팅 사이드 패널** (대시보드/차트 페이지에서 호출)
   - 진입: 대시보드 환자 카드 "답변 작성"/"채팅창 열기" · 차트 페이지 "채팅창 열기"
   - 구현: `/chat/[id]?role=pharmacist&embedded=true` 를 iframe 으로 임베드 (위 1~2 사이드 패널 및 모든 기능 그대로 사용)

## 전송 확인 팝업
"리포트 전송" / "가이드 전송" 버튼 클릭 시 패널 내부 오버레이로 표시:
- 아이콘: 📋 (또는 ✉️)
- 타이틀: "가이드를 전송하시겠습니까?" / "리포트를 전송하시겠습니까?"
- 본문: "전송 후에는 수정이 어렵습니다. 내용을 다시 한번 확인해주세요."
- 버튼: [취소] 흰 배경+테두리 / [전송하기] 세이지 그린(#4A6355)+흰 글씨
- 전송 후 동작:
  - 팝업 닫힘, 사이드 패널은 유지 (닫지 않음)
  - 상단 타이틀 옆 "✓ 전송 완료" 뱃지 (세이지 그린 배경, 3.5초 후 자동 숨김)
  - 하단 버튼 텍스트 "전송 완료 ✓" 로 변경 (disabled)
  - 채팅에 시스템 메시지 카드 자동 추가 (연동 필요)

## 금지 용어
치료, 처방, 진단, 완치, 치험례, 택배

## 피드 개선 사례 카드 디자인 (2026.04.22 추가)

**카드 외형:**
- 배경: 흰색, border-radius 16px, border 1px solid rgba(94,125,108,0.1)
- box-shadow: 0 2px 8px rgba(0,0,0,0.04)
- padding 20px, 카드 간격 16px

**카드 상단 증상 아이콘:**
- 랜딩페이지와 동일한 컬러 원형 40px + SVG 라인 아이콘 22px
- 공통 컴포넌트로 관리 (랜딩 + 피드 양쪽에서 import)
- 카드 최상단: 아이콘 + 증상명(볼드) + [약사 작성]/[환자 작성] 태그

**작성자 태그:**
- [약사 작성]: 배경 #EDF4F0, 글씨 #4A6355
- [환자 작성]: 배경 #F5E6DC, 글씨 #C06B45
- font-size 12px, weight 500, padding 3px 8px, border-radius 4px

**카드 상단 컬러 액센트 라인:** height 3px, 증상 컬러 진한 쪽

**개선 결과 박스:** 배경=증상 연한 컬러, border-radius 12px, padding 16px

**사진:** 카드에 썸네일 직접 노출 금지 (환부사진 배려). "📷 사진 N장 보기" 텍스트만 → 클릭 시 PhotoLightbox

**본문 말줄임:** 최대 3줄 + [더 보기]/[접기]

## 피드 필터 칩 디자인

**레이아웃:** flex-wrap: wrap (여러 줄), gap 8px
**칩 크기:** height 40px, padding 0 16px, font-size 14px, weight 500, border-radius 20px

**증상별 컬러:**
- 미선택: 연한 컬러 배경 + 진한 글씨
- 선택됨: 진한 컬러 배경 + 흰 글씨

| 증상 | 미선택 배경 | 미선택 글씨/선택 배경 |
|---|---|---|
| 만성피로, 체중 관리 | #EAF3DE | #3B6D11 |
| 소화장애, 변비/장건강 | #FAEEDA | #854F0B |
| 불면/수면 | #E6F1FB | #185FA5 |
| 여성건강, 피부, 탈모, 항노화 | #FAECE7 | #993C1D |
| 비염/알레르기, 면역력저하 | #E1F5EE | #0F6E56 |
| 우울/불안/스트레스 | #EEEDFE | #534AB7 |
| 전체 | #F8F9F7 | #4A6355 |

기본 12개(전체 포함) + [더보기] 클릭 시 7개 추가

## 약사 프로필 환자 후기 섹션

**위치:** 기존 "개선 사례" 섹션 아래
**섹션 제목:** "💚 환자 후기" (18px, weight 600)
**섹션 설명:** "실제 상담받은 분들의 개선 경험이에요" (14px, #3D4A42)

**후기 카드:** 피드 카드와 동일 구조, 증상 아이콘 32px (피드보다 약간 작게)
**본문 말줄임:** 2줄 (피드는 3줄)
**기본 2개 표시 + [후기 더 보기] 버튼**
**빈 상태:** "아직 환자 후기가 없어요"
