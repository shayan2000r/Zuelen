import type { ReactNode } from "react";
import { AdminHeader } from "@/components/admin-header";
import { requireZuelenAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { email } = await requireZuelenAdmin("/admin");
  return (
    <>
      <AdminHeader email={email} />
      {children}
    </>
  );
}
