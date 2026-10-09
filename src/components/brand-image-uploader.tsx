"use client";

import { ImagePlus, LoaderCircle, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/locale-context";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/app/settings/settings.module.css";

const MAX = 5 * 1024 * 1024,
  ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
function safeName(name: string) {
  const parts = name.split("."),
    ext =
      parts.length > 1
        ? `.${parts
            .pop()
            ?.toLowerCase()
            .replace(/[^a-z0-9]/g, "")}`
        : "";
  return `${
    parts
      .join(".")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .slice(0, 60) || "brand"
  }${ext}`;
}
type ImageField = "brand_image_path" | "establishment_barcode_path";

export function BrandImageUploader(props: {
  organizationId: string;
  companyId: string;
  currentPath: string | null;
  currentUrl: string | null;
  companyName: string;
}) {
  return <CompanyImageUploader {...props} field="brand_image_path" folder="brand" />;
}

/** Establishment-authorisation 2D barcode, printed on invoices (Ministry of the Economy requirement). */
export function EstablishmentBarcodeUploader(props: {
  organizationId: string;
  companyId: string;
  currentPath: string | null;
  currentUrl: string | null;
  companyName: string;
}) {
  return <CompanyImageUploader {...props} field="establishment_barcode_path" folder="establishment-barcode" />;
}

function CompanyImageUploader({
  organizationId,
  companyId,
  currentPath,
  currentUrl,
  companyName,
  field,
  folder,
}: {
  organizationId: string;
  companyId: string;
  currentPath: string | null;
  currentUrl: string | null;
  companyName: string;
  field: ImageField;
  folder: string;
}) {
  const barcode = field === "establishment_barcode_path";
  const router = useRouter(),
    { locale } = useI18n(),
    fr = locale === "fr",
    ref = useRef<HTMLInputElement>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function upload(file: File | undefined) {
    if (!file) return;
    if (!ALLOWED.has(file.type)) {
      setMessage(fr ? "Utilisez un fichier JPG, PNG ou WebP." : "Use JPG, PNG or WebP.");
      return;
    }
    if (file.size > MAX) {
      setMessage(fr ? "Utilisez une image de moins de 5 Mo." : "Use an image smaller than 5 MB.");
      return;
    }
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    try {
      const path = `${organizationId}/${companyId}/${folder}/${crypto.randomUUID()}-${safeName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("company-documents")
        .upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase
        .from("companies")
        .update({ [field]: path, updated_at: new Date().toISOString() })
        .eq("id", companyId);
      if (updateError) {
        await supabase.storage.from("company-documents").remove([path]);
        throw updateError;
      }
      if (currentPath && currentPath !== path) await supabase.storage.from("company-documents").remove([currentPath]);
      setMessage(fr ? "Image mise à jour." : "Image updated.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : fr ? "Impossible d’importer l’image." : "Could not upload the image.",
      );
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  async function remove() {
    if (!currentPath) return;
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    try {
      const { error: updateError } = await supabase
        .from("companies")
        .update({ [field]: null, updated_at: new Date().toISOString() })
        .eq("id", companyId);
      if (updateError) throw updateError;
      await supabase.storage.from("company-documents").remove([currentPath]);
      setMessage(fr ? "Image supprimée." : "Image removed.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : fr
            ? "Impossible de supprimer l’image."
            : "Could not remove the image.",
      );
    } finally {
      setBusy(false);
    }
  }
  const initial = companyName.trim().charAt(0).toUpperCase() || "C";
  return (
    <div className={styles.brandBox}>
      <div className={styles.brandPreview}>
        {currentUrl ? (
          <img
            src={currentUrl}
            alt={
              barcode
                ? fr
                  ? `Code-barres de l’autorisation d’établissement de ${companyName}`
                  : `${companyName} establishment authorisation barcode`
                : fr
                  ? `Logo ou image de profil de ${companyName}`
                  : `${companyName} logo or profile`
            }
          />
        ) : (
          <span>{barcode ? "QR" : initial}</span>
        )}
      </div>
      <div className={styles.brandCopy}>
        <strong>
          {barcode
            ? fr
              ? "Code-barres de l’autorisation d’établissement"
              : "Establishment authorisation barcode"
            : fr
              ? "Logo / image de l’entreprise"
              : "Logo / profile image"}
        </strong>
        <p>
          {barcode
            ? fr
              ? "Le code-barres 2D attribué à votre autorisation d’établissement doit figurer sur vos factures, devis, lettres, e-mails et site internet. Importez l’image reçue du ministère de l’Économie (MyGuichet) ; elle est imprimée sur chaque facture émise."
              : "The 2D barcode attributed to your establishment authorisation must appear on invoices, quotes, letters, e-mails and your website. Upload the image you received from the Ministry of the Economy (MyGuichet); it is printed on every invoice you issue."
            : fr
              ? "Affichée dans la barre latérale et les documents financiers. Si aucune image n’est définie, Zuelen utilise l’initiale de l’entreprise."
              : "Shown in the sidebar and financial documents. If empty, Zuelen uses the on-brand initial avatar."}
        </p>
        {message ? <small>{message}</small> : null}
        <div className={styles.brandActions}>
          <button type="button" onClick={() => ref.current?.click()} disabled={busy}>
            {busy ? (
              <LoaderCircle className={styles.spin} size={14} />
            ) : currentUrl ? (
              <UploadCloud size={14} />
            ) : (
              <ImagePlus size={14} />
            )}{" "}
            {currentUrl ? (fr ? "Remplacer l’image" : "Replace image") : fr ? "Importer une image" : "Upload image"}
          </button>
          {currentPath ? (
            <button type="button" className={styles.removeImage} onClick={remove} disabled={busy}>
              <Trash2 size={13} />
              {fr ? "Supprimer" : "Remove"}
            </button>
          ) : null}
          <input
            ref={ref}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={event => upload(event.target.files?.[0])}
          />
        </div>
      </div>
    </div>
  );
}
