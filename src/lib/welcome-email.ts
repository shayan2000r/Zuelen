import { createClient } from "@/lib/supabase/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.zuelen.lu";

function welcomeHtml(name: string) {
  const safeName = name.replace(/[<>&"']/g, "");
  return `<!doctype html><html><body style="margin:0;background:#f5f7f4;font-family:Inter,Arial,sans-serif;color:#142018"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f5f7f4"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e1e7e1;border-radius:20px;overflow:hidden"><tr><td style="padding:28px 32px;background:#111b14"><div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-.5px">Zuelen</div><div style="margin-top:5px;font-size:12px;color:#a9b8ad">Luxembourg business, under control.</div></td></tr><tr><td style="padding:36px 32px"><div style="font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#287a40">Welcome to Zuelen</div><h1 style="margin:10px 0 14px;font-size:30px;line-height:1.15;letter-spacing:-1px;color:#142018">${safeName ? `Welcome, ${safeName}.` : "Your Zuelen account is ready."}</h1><p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#5e6b62">Your secure account is ready. The next step is to choose how you work in Luxembourg and complete the short onboarding so Zuelen can configure the right accounting, VAT, tax and compliance workspace for you.</p><a href="${APP_URL}/setup" style="display:inline-block;padding:13px 20px;border-radius:999px;background:#287a40;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800">Continue setup →</a><div style="height:28px"></div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e8ece8;padding-top:22px"><tr><td style="font-size:13px;line-height:1.6;color:#718078"><strong style="color:#142018">What happens next?</strong><br>1. Choose Company, Independent or Accountant.<br>2. Add the essential Luxembourg business details.<br>3. Start with a clean dashboard and bring in your existing activity when you are ready.</td></tr></table></td></tr><tr><td style="padding:20px 32px;background:#f8faf8;border-top:1px solid #e8ece8;font-size:11px;line-height:1.6;color:#7d8980">Zuelen · Luxembourg<br>This message was sent because a new Zuelen account was created with this email address.</td></tr></table></td></tr></table></body></html>`;
}

export async function sendWelcomeEmailForCurrentUser() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  if (error || !user?.email || user.user_metadata?.zuelen_welcome_sent_at) return;

  // Avoid surprising long-standing users if this feature is deployed later.
  const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
  if (!createdAt || Date.now() - createdAt > 7 * 24 * 60 * 60 * 1000) return;

  const name = String(user.user_metadata?.full_name || user.user_metadata?.name || "").trim();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ZUELEN_WELCOME_FROM || "Zuelen <welcome@zuelen.lu>",
      to: [user.email],
      subject: "Welcome to Zuelen — let's set up your workspace",
      html: welcomeHtml(name),
    }),
  });

  if (!response.ok) {
    console.error("Zuelen welcome email failed", response.status, await response.text());
    return;
  }

  await supabase.auth.updateUser({
    data: { ...user.user_metadata, zuelen_welcome_sent_at: new Date().toISOString() },
  });
}
