import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.zuelen.lu";
const EMAIL_WINDOW_SECONDS = 15 * 60;
const EMAIL_MAX_REQUESTS = 3;
const IP_MAX_REQUESTS = 10;

function neutralResponse() {
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return null;
  return email;
}

function normalizeLocale(value: unknown): "en" | "fr" {
  return value === "fr" ? "fr" : "en";
}

function requestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function opaqueBucket(kind: "email" | "ip", value: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Password recovery secret is unavailable.");
  const digest = createHmac("sha256", secret).update(value).digest("hex");
  return `${kind}:${digest}`;
}

function recoveryEmailHtml(link: string, locale: "en" | "fr") {
  const fr = locale === "fr";
  const title = fr ? "Réinitialisez votre mot de passe" : "Reset your Zuelen password";
  const intro = fr
    ? "Nous avons reçu une demande de réinitialisation du mot de passe de votre compte Zuelen."
    : "We received a request to reset the password for your Zuelen account.";
  const button = fr ? "Choisir un nouveau mot de passe" : "Choose a new password";
  const note = fr
    ? "Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet e-mail. Ce lien est à usage unique."
    : "If you did not request this change, you can ignore this email. This link can only be used once.";

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f7f4;font-family:Inter,Arial,sans-serif;color:#142018">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f5f7f4">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e1e7e1;border-radius:20px;overflow:hidden">
          <tr><td style="padding:28px 32px;background:#111b14">
            <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-.5px">Zuelen</div>
            <div style="margin-top:5px;font-size:12px;color:#a9b8ad">Luxembourg business, under control.</div>
          </td></tr>
          <tr><td style="padding:36px 32px">
            <div style="font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#287a40">${fr ? "Sécurité du compte" : "Account security"}</div>
            <h1 style="margin:10px 0 14px;font-size:30px;line-height:1.15;letter-spacing:-1px;color:#142018">${title}</h1>
            <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#5e6b62">${intro}</p>
            <a href="${link}" style="display:inline-block;padding:13px 20px;border-radius:999px;background:#287a40;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800">${button} →</a>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.65;color:#718078">${note}</p>
          </td></tr>
          <tr><td style="padding:20px 32px;background:#f8faf8;border-top:1px solid #e8ece8;font-size:11px;line-height:1.6;color:#7d8980">Zuelen · Luxembourg</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return neutralResponse();
  }

  const payload = body && typeof body === "object" ? body as { email?: unknown; locale?: unknown } : {};
  const email = normalizeEmail(payload.email);
  const locale = normalizeLocale(payload.locale);
  if (!email) return neutralResponse();

  try {
    const admin = createAdminClient();

    async function consume(bucketKey: string, maxRequests: number) {
      const { data, error } = await admin.rpc("consume_password_recovery_rate_limit", {
        p_bucket_key: bucketKey,
        p_max_requests: maxRequests,
        p_window_seconds: EMAIL_WINDOW_SECONDS,
      });
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      return row?.allowed === true;
    }

    const [emailAllowed, ipAllowed] = await Promise.all([
      consume(opaqueBucket("email", email), EMAIL_MAX_REQUESTS),
      consume(opaqueBucket("ip", requestIp(request)), IP_MAX_REQUESTS),
    ]);
    if (!emailAllowed || !ipAllowed) return neutralResponse();

    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (error || !data?.properties?.hashed_token) return neutralResponse();

    const confirmUrl = new URL("/auth/confirm", APP_URL);
    confirmUrl.searchParams.set("token_hash", data.properties.hashed_token);
    confirmUrl.searchParams.set("type", "recovery");
    confirmUrl.searchParams.set("next", `/account/password-reset?lang=${locale}`);

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.ZUELEN_PASSWORD_RESET_FROM
      || process.env.RESEND_FROM_EMAIL
      || "Zuelen <no-reply@zuelen.lu>";
    if (!apiKey) throw new Error("Password recovery email delivery is unavailable.");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: locale === "fr"
          ? "Réinitialisez votre mot de passe Zuelen"
          : "Reset your Zuelen password",
        html: recoveryEmailHtml(confirmUrl.toString(), locale),
      }),
    });

    if (!response.ok) {
      console.error("Password recovery email delivery failed", response.status);
    }
  } catch (error) {
    console.error("Password recovery request failed", error instanceof Error ? error.message : "Unknown error");
  }

  return neutralResponse();
}
