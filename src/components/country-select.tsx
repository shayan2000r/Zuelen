"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/locale-context";
import styles from "./country-select.module.css";

const CODES=`AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(" ");
export function countryName(code:string,locale="en"){const display=new Intl.DisplayNames([locale],{type:"region"});return display.of(code.toUpperCase())||code.toUpperCase()}

export function CountrySelect({name,value,onChange,required=false}:{name:string;value:string;onChange:(code:string)=>void;required?:boolean}){
  const{locale}=useI18n(),fr=locale==="fr",initial=value?countryName(value,locale):"",[query,setQuery]=useState(initial),[open,setOpen]=useState(false);
  const options=useMemo(()=>CODES.map(code=>({code,name:countryName(code,locale)})).filter(item=>!query||item.name.toLowerCase().includes(query.toLowerCase())||item.code.toLowerCase().startsWith(query.toLowerCase())).slice(0,8),[query,locale]);
  function choose(code:string){onChange(code);setQuery(countryName(code,locale));setOpen(false)}
  return <div className={styles.wrap}><input type="hidden" name={name} value={value}/><div className={styles.inputWrap}><Search size={13}/><input value={query} placeholder={fr?"Commencez à saisir un pays…":"Start typing a country…"} required={required} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);onChange("");setOpen(true)}} autoComplete="off"/></div>{open?<div className={styles.menu}>{options.length?options.map(item=><button type="button" key={item.code} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(item.code)}><span>{item.name}</span><small>{item.code}</small></button>):<p>{fr?"Aucun pays trouvé":"No country found"}</p>}</div>:null}</div>
}
