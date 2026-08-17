"use client";

import type { CSSProperties } from "react";
import styles from "@/app/app/overview.module.css";

function money(value:number,currency:string){
  return new Intl.NumberFormat("en-LU",{style:"currency",currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
}

export function OverviewChart({monthly,currency,year,currentMonth}:{monthly:{income:number;expense:number}[];currency:string;year:number;currentMonth:number}){
  const visible=monthly.slice(0,Math.max(currentMonth+1,8));
  const max=Math.max(1,...visible.flatMap(month=>[month.income,month.expense]));
  const totalIncome=monthly.reduce((sum,month)=>sum+month.income,0);
  const totalExpense=monthly.reduce((sum,month)=>sum+month.expense,0);
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return <article className={styles.incomeCard}>
    <div className={styles.incomeHead}>
      <div>
        <span className={styles.cardLabel}>Income & spending</span>
        <h2>Financial activity</h2>
        <p>{year} year to date</p>
      </div>
      <div className={styles.chartLegend}>
        <span><i className={styles.incomeLegend}/>Income</span>
        <span><i className={styles.expenseLegend}/>Spending</span>
      </div>
    </div>

    <div className={styles.chartTotals}>
      <div><span>Income</span><strong>{money(totalIncome,currency)}</strong></div>
      <div><span>Spending</span><strong>{money(totalExpense,currency)}</strong></div>
    </div>

    <div className={styles.barChart} role="img" aria-label={`Monthly income and spending for ${year}`}>
      {visible.map((month,index)=>{
        const incomeHeight=Math.max(month.income>0?8:2,(month.income/max)*100);
        const expenseHeight=Math.max(month.expense>0?8:2,(month.expense/max)*100);
        return <div className={styles.barMonth} key={months[index]}>
          <div className={styles.barTrack}>
            <span className={styles.incomeBar} style={{height:`${incomeHeight}%`,"--delay":`${index*45}ms`} as CSSProperties}/>
            <span className={styles.expenseBar} style={{height:`${expenseHeight}%`,"--delay":`${index*45+70}ms`} as CSSProperties}/>
          </div>
          <small>{months[index]}</small>
        </div>;
      })}
    </div>
  </article>;
}
