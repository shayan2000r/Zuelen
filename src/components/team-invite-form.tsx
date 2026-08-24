"use client";

import { LoaderCircle, MailPlus } from "lucide-react";
import { useActionState } from "react";
import { inviteTeamMemberAction, type TeamActionState } from "@/app/app/settings/team/actions";
import { useI18n } from "@/components/locale-context";
import { FieldGroup, SelectField, TextField } from "@/components/zuelen-form-ui-v2";
import { localizedRole } from "@/lib/i18n";
import styles from "@/app/app/settings/team/team.module.css";

const initialState: TeamActionState = { status: "idle", message: "" };

export function TeamInviteForm() {
  const [state, action, pending] = useActionState(inviteTeamMemberAction, initialState);
  const { locale } = useI18n();
  const fr = locale === "fr";
  return <form action={action} className={styles.inviteForm}>
    <FieldGroup columns={3}>
      <TextField label={fr ? "Adresse e-mail" : "Email address"} type="email" name="email" placeholder="colleague@company.lu" required disabled={pending} />
      <SelectField label={fr ? "Rôle" : "Role"} name="role" defaultValue="bookkeeper" disabled={pending}><option value="admin">{localizedRole(locale, "admin")}</option><option value="accountant">{localizedRole(locale, "accountant")}</option><option value="bookkeeper">{localizedRole(locale, "bookkeeper")}</option><option value="viewer">{localizedRole(locale, "viewer")}</option></SelectField>
      <button className={styles.inviteButton} type="submit" disabled={pending}>{pending ? <LoaderCircle className={styles.spin} size={15} /> : <MailPlus size={15} />} {pending ? (fr ? "Envoi…" : "Sending…") : (fr ? "Envoyer l’invitation" : "Send invitation")}</button>
    </FieldGroup>
    {state.message ? <p className={state.status === "error" ? styles.error : styles.success}>{state.message}</p> : null}
  </form>;
}
