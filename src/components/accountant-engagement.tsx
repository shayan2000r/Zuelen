"use client";

import { ExternalLink, Mail, Phone } from "lucide-react";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./accountant-engagement.module.css";

function track(profileId: string, eventType: "view" | "email" | "phone" | "website") {
  const supabase = createClient();
  void supabase.rpc("record_accountant_profile_event", { p_profile_id: profileId, p_event_type: eventType });
}

export function AccountantEngagement({ profileId, email, phone, website }: { profileId: string; email: string | null; phone: string | null; website: string | null }) {
  useEffect(() => { track(profileId, "view"); }, [profileId]);
  return <div className={styles.actions}>
    {email ? <a className={styles.primary} href={`mailto:${email}`} onClick={() => track(profileId, "email")}><Mail size={15}/>Email</a> : null}
    {phone ? <a href={`tel:${phone}`} onClick={() => track(profileId, "phone")}><Phone size={15}/>{phone}</a> : null}
    {website ? <a href={website} target="_blank" rel="noreferrer" onClick={() => track(profileId, "website")}><ExternalLink size={15}/>Website</a> : null}
  </div>;
}
