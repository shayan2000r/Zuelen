"use client";

import { Camera, Check, Languages, LoaderCircle, Mail, Trash2, UserRound } from "lucide-react";
import { useActionState, useState } from "react";
import { savePersonalProfile, type ProfileState } from "@/app/app/settings/profile/actions";
import { useI18n } from "@/components/locale-context";
import { FieldGroup, FormSection, SelectField, TextField } from "@/components/zuelen-form-ui-v2";
import type { Locale } from "@/lib/i18n";
import styles from "@/app/app/settings/profile/profile.module.css";

const initial: ProfileState = { status: "idle", message: "" };

export function UserProfileForm({ email, fullName, avatarUrl, role, locale }: { email: string; fullName: string; avatarUrl: string | null; role: string; locale: Locale }) {
  const [state, action, pending] = useActionState(savePersonalProfile, initial);
  const i18n = useI18n();
  const fr = i18n.locale === "fr";
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [remove, setRemove] = useState(false);
  function onImage(file: File | null) { if (!file) return; setRemove(false); setPreview(URL.createObjectURL(file)); }

  return <form action={action} className={styles.form}>
    <FormSection title={i18n.t("profilePhoto")} description={fr ? "Votre avatar personnel, visible par les membres de votre organisation." : "Your personal avatar, visible to people in your organization."}>
      <div className={styles.avatarArea}><div className={styles.avatar}>{preview && !remove ? <img src={preview} alt={fr ? "Votre profil" : "Your profile"} /> : <UserRound size={28} />}</div><div><strong>{fr ? "Choisissez une photo de profil claire" : "Choose a clear profile image"}</strong><p>{fr ? "Cet avatar est distinct du logo de l’entreprise et apparaît dans la navigation de votre compte." : "This avatar is separate from the company logo and appears in your account navigation."}</p><div className={styles.avatarActions}><label><Camera size={14} />{fr ? "Importer une image" : "Upload image"}<input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => onImage(e.target.files?.[0] ?? null)} /></label>{(preview || avatarUrl) && !remove ? <button type="button" onClick={() => { setRemove(true); setPreview(null); }}><Trash2 size={13} />{fr ? "Supprimer" : "Remove"}</button> : null}</div>{remove ? <input type="hidden" name="remove_avatar" value="yes" /> : null}</div></div>
    </FormSection>

    <FormSection title={i18n.t("yourDetails")} description={(fr ? "Rôle" : "Role") + ": " + role}>
      <FieldGroup columns={2}>
        <TextField label={i18n.t("fullName")} icon={UserRound} name="full_name" defaultValue={fullName} placeholder={fr ? "Votre nom" : "Your name"} autoComplete="name" />
        <TextField label={i18n.t("emailAddress")} icon={Mail} name="email" type="email" defaultValue={email} autoComplete="email" required description={fr ? "Le changement d’adresse e-mail doit être confirmé avant de devenir actif." : "Changing your email requires confirmation before it becomes active."} />
        <SelectField label={i18n.t("language")} icon={Languages} name="locale" defaultValue={locale} description={fr ? "S’applique à l’interface, aux comptes PCN et aux documents générés." : "Applies to the interface, PCN account names and generated documents."}><option value="en">English</option><option value="fr">Français</option></SelectField>
      </FieldGroup>
    </FormSection>

    <div className={styles.saveBar}>{state.message ? <span className={state.status === "error" ? styles.error : styles.success}>{state.message}</span> : <span>{fr ? "Votre profil personnel vous suit dans toutes les organisations." : "Your personal profile follows you across organizations."}</span>}<button type="submit" disabled={pending}>{pending ? <LoaderCircle className={styles.spin} size={15} /> : <Check size={15} />} {pending ? i18n.t("saving") : i18n.t("saveProfile")}</button></div>
  </form>;
}
