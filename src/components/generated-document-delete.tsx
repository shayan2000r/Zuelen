"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { deleteGeneratedFinancialDocumentAction } from "@/app/app/documents/generated-actions";
import styles from "./documents.module.css";

function DeleteButton(){const{pending}=useFormStatus();return <button type="submit" className={styles.iconAction} disabled={pending} aria-label="Delete generated document" title="Delete generated document">{pending?<LoaderCircle className={styles.spin} size={13}/>:<Trash2 size={13}/>}</button>}

export function GeneratedDocumentDelete({id,title}:{id:string;title:string}){return <form action={deleteGeneratedFinancialDocumentAction} onSubmit={event=>{if(!window.confirm(`Delete ${title}? You can generate a new version at any time. The closing snapshot will not be changed.`))event.preventDefault()}}><input type="hidden" name="document_id" value={id}/><DeleteButton/></form>}
