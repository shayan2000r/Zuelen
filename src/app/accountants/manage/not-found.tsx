import Link from "next/link";

export default function NotFound(){return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f7f7f4",fontFamily:"Inter,system-ui,sans-serif"}}><div><h1>Professional listing not found.</h1><Link href="/accountants/manage">Return to listing setup</Link></div></main>}
