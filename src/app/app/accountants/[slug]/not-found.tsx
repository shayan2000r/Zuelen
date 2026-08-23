import Link from "next/link";

export default function NotFound(){return <div style={{padding:"48px",fontFamily:"Inter,system-ui,sans-serif"}}><h1 style={{fontSize:24}}>This professional profile isn’t available.</h1><p style={{color:"#687269",lineHeight:1.6}}>It may be awaiting review, the listing subscription may have ended, or the profile may no longer be published.</p><Link href="/app/accountants" style={{display:"inline-block",marginTop:12,color:"#2f6b41",fontWeight:750}}>Browse accountants</Link></div>}
