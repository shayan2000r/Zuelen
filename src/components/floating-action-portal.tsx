"use client";

import { createPortal } from "react-dom";
import { type ReactNode, useEffect, useState } from "react";

export function FloatingActionPortal({children}:{children:ReactNode}){
 const[mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);if(!mounted)return null;return createPortal(children,document.body);
}
