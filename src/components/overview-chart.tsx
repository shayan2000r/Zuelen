"use client";

import styles from "@/app/app/overview.module.css";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function points(values: number[], max: number, width = 620, height = 200, padX = 10, padY = 18) {
  const usableWidth = width - padX * 2;
  const usableHeight = height - padY * 2;
  return values.map((value, index) => {
    const x = padX + (values.length === 1 ? 0 : (index / (values.length - 1)) * usableWidth);
    const normalized = Math.max(0, value) / max;
    const y = padY + usableHeight - normalized * usableHeight;
    return { x, y };
  });
}

export function OverviewChart({ monthly, year, currentMonth }: { monthly: { income: number; expense: number }[]; currency: string; year: number; currentMonth: number }) {
  const visibleCount = Math.max(currentMonth + 1, 8);
  const visible = monthly.slice(0, visibleCount);
  const incomeValues = visible.map((month) => month.income);
  const expenseValues = visible.map((month) => month.expense);
  const max = Math.max(1, ...incomeValues, ...expenseValues);
  const incomePoints = points(incomeValues, max);
  const expensePoints = points(expenseValues, max);
  const incomePolyline = incomePoints.map((point) => `${point.x},${point.y}`).join(" ");
  const expensePolyline = expensePoints.map((point) => `${point.x},${point.y}`).join(" ");
  const incomeArea = `10,200 ${incomePolyline} 610,200`;
  const expenseArea = `10,200 ${expensePolyline} 610,200`;

  return (
    <article className={styles.incomeCard}>
      <div className={styles.incomeHead}>
        <div>
          <span className={styles.cardLabel}>Financial activity</span>
          <h2>Income vs spending</h2>
          <p>Monthly movement · {year}</p>
        </div>
        <div className={styles.chartLegend}>
          <span><i className={styles.incomeLegend} />Income</span>
          <span><i className={styles.expenseLegend} />Spending</span>
        </div>
      </div>

      <div className={styles.lineChart} role="img" aria-label={`Income and spending trend for ${year}`}>
        <svg viewBox="0 0 620 210" preserveAspectRatio="none">
          <defs>
            <linearGradient id="incomeAreaBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2196F3" stopOpacity=".22" />
              <stop offset="1" stopColor="#2196F3" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="expenseAreaBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0D47A1" stopOpacity=".12" />
              <stop offset="1" stopColor="#0D47A1" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[38, 88, 138, 188].map((y) => <line key={y} x1="10" x2="610" y1={y} y2={y} className={styles.chartGridLine} />)}
          <polygon points={expenseArea} className={styles.expenseArea} />
          <polygon points={incomeArea} className={styles.incomeArea} />
          <polyline pathLength="1" points={expensePolyline} className={styles.expenseLine} />
          <polyline pathLength="1" points={incomePolyline} className={styles.incomeLine} />
          {expensePoints.map((point, index) => <circle key={`e-${index}`} cx={point.x} cy={point.y} r="3.5" className={styles.expenseDot} />)}
          {incomePoints.map((point, index) => <circle key={`i-${index}`} cx={point.x} cy={point.y} r="3.5" className={styles.incomeDot} />)}
        </svg>
      </div>
      <div className={styles.chartMonths}>{visible.map((_, index) => <span key={months[index]}>{months[index]}</span>)}</div>
      <div className={styles.chartFoot}><span>Trend view only</span><strong>Exact totals are shown in the KPI cards.</strong></div>
    </article>
  );
}
