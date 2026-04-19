"use client";

/**
 * HealthIndicatorComparison — 마이페이지 "내 건강 변화" / 차트 "환자 건강지표" 공용 컴포넌트.
 *
 * 사용처: src/app/mypage/MypageClient.tsx, src/app/chart/[id]/ChartClient.tsx
 * 두 페이지가 반드시 이 컴포넌트를 공유해 디자인을 100% 동일하게 유지할 것.
 * 디자인 변경은 이 파일만 수정하면 됩니다 (globals.css의 .my-health-*, .my-bar-* 클래스 재사용).
 */

export interface HealthIndicatorItem {
  /** 항목명 (예: "에너지/활력") */
  label: string;
  /** 이전 점수 (1~10). 이전 기록이 없으면 undefined */
  before?: number;
  /** 현재 점수 (1~10) */
  after: number;
  /** 낮을수록 좋은 지표 여부 (예: 증상 불편도) */
  lowerIsBetter?: boolean;
}

export interface HealthIndicatorComparisonProps {
  /** 이전 체크 날짜 (예: "2026.03.15"). 없으면 비교 불가 상태로 렌더 */
  previousDate?: string;
  /** 현재 체크 날짜 (예: "2026.04.05") */
  currentDate?: string;
  /** 항목 리스트 */
  items: HealthIndicatorItem[];
  /** 요약 헤드라인 (예: "처음보다 에너지가 40% 좋아졌어요!") — 미지정 시 자동 생성 */
  summaryHeadline?: string;
  /** "몸 상태 체크하기" 버튼/안내 표시 여부 — 기본 true */
  showCheckButton?: boolean;
  /** 체크 버튼 라벨 */
  checkBtnLabel?: string;
  /** 체크 버튼 아래 설명 */
  checkBtnDesc?: string;
  /** 체크 버튼 클릭 핸들러 */
  onCheckClick?: () => void;
  /** 빈 상태 표시 (기록 자체가 없을 때) */
  emptyState?: boolean;
  /** 빈 상태일 때 체크하러 가기 버튼 클릭 */
  onEmptyCheckClick?: () => void;
}

function autoHeadline(items: HealthIndicatorItem[]): string {
  const improvedCount = items.filter((h) => {
    if (h.before === undefined) return false;
    const diff = h.after - h.before;
    return h.lowerIsBetter ? diff <= -2 : diff >= 2;
  }).length;
  if (improvedCount === 0) return "꾸준히 관리하고 있어요";
  return `${improvedCount}개 항목이 개선되었어요!`;
}

export default function HealthIndicatorComparison({
  previousDate,
  currentDate,
  items,
  summaryHeadline,
  showCheckButton = true,
  checkBtnLabel = "몸 상태 체크하기",
  checkBtnDesc = "정기적으로 체크하면 변화를 더 정확히 확인할 수 있어요",
  onCheckClick,
  emptyState = false,
  onEmptyCheckClick,
}: HealthIndicatorComparisonProps) {
  // ── 빈 상태 ──
  if (emptyState) {
    return (
      <div
        style={{
          background: "#F8F9F7",
          border: "1px solid rgba(94,125,108,0.14)",
          borderRadius: 14,
          padding: "32px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 42, marginBottom: 10, lineHeight: 1 }}>📊</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#2C3630", marginBottom: 6 }}>
          아직 건강 변화 기록이 없어요
        </div>
        <div style={{ fontSize: 14, color: "#3D4A42", marginBottom: 16, lineHeight: 1.6 }}>
          몸 상태를 체크하면 변화를 확인할 수 있어요
        </div>
        <button
          type="button"
          onClick={onEmptyCheckClick}
          style={{
            padding: "12px 24px",
            borderRadius: 12,
            background: "#4A6355",
            color: "#fff",
            border: "none",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'Noto Sans KR', sans-serif",
          }}
        >
          몸 상태 체크하기
        </button>
      </div>
    );
  }

  const hasPrevious = !!previousDate && items.some((h) => h.before !== undefined);
  const headline = summaryHeadline ?? autoHeadline(items);

  return (
    <>
      {/* 요약 카드 */}
      {hasPrevious ? (
        <div className="my-health-summary">
          <div className="my-health-headline">{headline}</div>
          {(previousDate || currentDate) && (
            <div className="my-health-period">
              {previousDate} 첫 상담 → {currentDate} 현재
            </div>
          )}
        </div>
      ) : (
        <div className="my-health-summary">
          <div className="my-health-headline" style={{ color: "#C06B45" }}>
            다음 체크부터 변화를 비교할 수 있어요
          </div>
          {currentDate && (
            <div className="my-health-period">현재 체크: {currentDate}</div>
          )}
        </div>
      )}

      {/* 비교 막대 */}
      <div className="my-health-bars">
        {items.map((h) => {
          const hasBefore = h.before !== undefined;
          const diff = hasBefore ? h.after - (h.before as number) : 0;
          const improved = hasBefore && (h.lowerIsBetter ? diff <= -2 : diff >= 2);
          const absDiff = Math.abs(diff);
          const arrow = h.lowerIsBetter
            ? (diff < 0 ? "↓" : "↑")
            : (diff > 0 ? "↑" : "↓");
          return (
            <div key={h.label} className="my-bar-row">
              <span className="my-bar-label">{h.label}</span>
              <div className="my-bar-track">
                {hasBefore && (
                  <div
                    className="my-bar-before"
                    style={{ width: `${(h.before as number) * 10}%` }}
                  />
                )}
                <div
                  className="my-bar-after"
                  style={{ width: `${h.after * 10}%` }}
                />
              </div>
              <span className="my-bar-score">
                {hasBefore ? `${h.before} → ${h.after}` : `${h.after}`}
              </span>
              {hasBefore && (
                <span className={`my-bar-diff${improved ? " highlight" : ""}`}>
                  {h.lowerIsBetter ? `-${absDiff}` : `${diff > 0 ? "+" : ""}${diff}`} {arrow}
                </span>
              )}
              {improved && <span className="my-bar-badge">개선 확인</span>}
            </div>
          );
        })}
      </div>

      {showCheckButton && (
        <>
          <button className="my-health-check-btn" type="button" onClick={onCheckClick}>
            {checkBtnLabel}
          </button>
          <p className="my-health-check-desc">{checkBtnDesc}</p>
        </>
      )}
    </>
  );
}
