"use client";
import { CheckCircle2, LoaderCircle, Snowflake } from "lucide-react";
import { useActionState } from "react";
import { createClosingSnapshot, type ClosingState } from "@/app/app/year-end/actions";
import { useRolePermissions } from "@/components/role-context";
import styles from "./year-end.module.css";
const initial:ClosingState={status:"idle",message:""};
export function ClosingSnapshotButton({ready}:{ready:boolean}){const{canAccount}=useRolePermissions(),[state,action,pending]=useActionState(createClosingSnapshot,initial);if(!canAccount)return null;return <div><form action={action}><button type="submit" className={styles.closeButton} disabled={!ready||pending}>{pending?<LoaderCircle className={styles.spin}/>:state.status==="success"?<CheckCircle2/>:<Snowflake/>}{pending?"Freezing snapshot…":state.status==="success"?"Snapshot created":"Create closing snapshot"}</button></form>{state.message?<p className={state.status==="error"?styles.actionError:styles.actionSuccess}>{state.message}</p>:null}</div>}
