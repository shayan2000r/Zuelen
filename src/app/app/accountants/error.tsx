"use client";

export default function Error({error,reset}:{error:Error&{digest?:string};reset:()=>void}){return <div style={{padding:"40px",fontFamily:"Inter,system-ui,sans-serif"}}><h1 style={{fontSize:22}}>The accountant directory couldn’t be loaded.</h1><p style={{color:"#687269"}}>{error.message||"Please try again."}</p><button onClick={reset} style={{border:0,borderRadius:10,padding:"10px 14px",background:"#184c2c",color:"#fff",fontWeight:700,cursor:"pointer"}}>Try again</button></div>}
