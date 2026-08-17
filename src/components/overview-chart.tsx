"use client";

import styles from "@/app/app/overview.module.css";

export function OverviewChart({monthly,currency,year,currentMonth}:{monthly:{income:number;expense:number}[];currency:string;year:number;currentMonth:number}){
  const visibleCount=Math.max(currentMonth+1,8);
  const visible=monthly.slice(0,Math.min(visibleCount,12));
  const max=Math.max(1,...visible.flatMap(month=>[month.income,month.expense]));
  const maxVolume=Math.max(1,...visible.map(month=>month.income+month.expense));
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].slice(0,visible.length);
  const width=800,height=220,padX=30,padTop=18,padBottom=28,chartHeight=height-padTop-padBottom;
  const x=(index:number)=>visible.length<=1?width/2:padX+(index/(visible.length-1))*(width-padX*2);
  const y=(value:number)=>padTop+chartHeight-(value/max)*chartHeight;
  const incomePoints=visible.map((month,index)=>`${x(index)},${y(month.income)}`).join(" ");
  const expensePoints=visible.map((month,index)=>`${x(index)},${y(month.expense)}`).join(" ");
  const baseline=padTop+chartHeight;
  const incomeArea=`${padX},${baseline} ${incomePoints} ${x(visible.length-1)},${baseline}`;
  const expenseArea=`${padX},${baseline} ${expensePoints} ${x(visible.length-1)},${baseline}`;

  return <article className={styles.incomeCard}>
    <div className={styles.incomeHead}>
      <div><span className={styles.cardLabel}>Financial activity</span><h2>Income vs spending</h2></div>
      <div className={styles.chartLegend}><span><i className={styles.incomeLegend}/>Income</span><span><i className={styles.expenseLegend}/>Spending</span></div>
    </div>
    <div className={styles.chartMeta}><span>{year} · monthly movement</span><b>{currency}</b></div>
    <div className={styles.lineChart} role="img" aria-label={`Monthly income and spending for ${year}`}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="incomeAreaGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2dc653" stopOpacity=".25"/><stop offset="1" stopColor="#2dc653" stopOpacity="0"/></linearGradient>
          <linearGradient id="expenseAreaGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#10451d" stopOpacity=".10"/><stop offset="1" stopColor="#10451d" stopOpacity="0"/></linearGradient>
        </defs>
        {[.25,.5,.75,1].map((ratio)=><line key={ratio} x1={padX} x2={width-padX} y1={padTop+chartHeight*(1-ratio)} y2={padTop+chartHeight*(1-ratio)} className={styles.chartGridLine}/>)}
        {visible.map((month,index)=>{
          const volumeHeight=((month.income+month.expense)/maxVolume)*chartHeight*.76;
          const current=index===currentMonth;
          return <g key={months[index]}>{current?<rect x={x(index)-40} y={padTop-3} width="80" height={chartHeight+8} rx="16" className={styles.currentBand}/>:null}<rect x={x(index)-14} y={baseline-volumeHeight} width="28" height={volumeHeight} rx="8" className={styles.volumeBar}/></g>;
        })}
        <polygon points={expenseArea} className={styles.expenseArea}/>
        <polygon points={incomeArea} className={styles.incomeArea}/>
        <polyline pathLength="1" points={expensePoints} className={styles.expenseLine}/>
        <polyline pathLength="1" points={incomePoints} className={styles.incomeLine}/>
        {visible.map((month,index)=><g key={`dot-${index}`}><circle cx={x(index)} cy={y(month.expense)} r="4" className={styles.expenseDot}/><circle cx={x(index)} cy={y(month.income)} r="4" className={styles.incomeDot}/></g>)}
      </svg>
    </div>
    <div className={styles.chartMonths}>{months.map(month=><span key={month}>{month}</span>)}</div>
  </article>;
}
