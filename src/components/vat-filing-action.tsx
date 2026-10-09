"use client";
import { CheckCircle2, FileCheck2, LoaderCircle } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { prepareVatFilingAction, type VatFilingState } from "@/app/app/vat/actions";
import { useRolePermissions } from "@/components/role-context";
import { UpgradeWall } from "@/components/upgrade-wall";
import { useI18n } from "@/components/locale-context";
const initial: VatFilingState = { status: "idle", message: "" };
export function VatFilingAction({ start, end, ready }: { start: string; end: string; ready: boolean }) {
  const { canAccount } = useRolePermissions(),
    { locale } = useI18n(),
    fr = locale === "fr",
    [state, action, pending] = useActionState(prepareVatFilingAction, initial),
    [upgradeOpen, setUpgradeOpen] = useState(false);
  useEffect(() => {
    if (state.upgradeRequired) setUpgradeOpen(true);
  }, [state]);
  if (!canAccount) return null;
  return (
    <>
      <form action={action} style={{ display: "grid", gap: 8, marginTop: 14 }}>
        <input type="hidden" name="period_start" value={start} />
        <input type="hidden" name="period_end" value={end} />
        <button
          type="submit"
          disabled={!ready || pending}
          style={{
            height: 38,
            border: ready ? 0 : "1px solid var(--z-border)",
            borderRadius: 999,
            background: ready ? "var(--z-brand)" : "var(--z-surface-2)",
            color: ready ? "var(--z-brand-on)" : "var(--z-text-tertiary)",
            font: "inherit",
            fontSize: 13,
            fontWeight: 600,
            cursor: ready ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
          }}
        >
          {pending ? (
            <LoaderCircle size={14} />
          ) : state.status === "success" ? (
            <CheckCircle2 size={14} />
          ) : (
            <FileCheck2 size={14} />
          )}{" "}
          {pending
            ? fr
              ? "Préparation…"
              : "Preparing…"
            : fr
              ? "Préparer la feuille de déclaration"
              : "Prepare return worksheet"}
        </button>
        {state.message ? (
          <span style={{ fontSize: 12, color: state.status === "error" ? "#a65340" : "#24713a" }}>{state.message}</span>
        ) : null}
      </form>
      <UpgradeWall open={upgradeOpen} message={state.message} onClose={() => setUpgradeOpen(false)} />
    </>
  );
}
