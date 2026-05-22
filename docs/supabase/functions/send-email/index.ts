import nodemailer from "nodemailer";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
}

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const fromEmail = Deno.env.get("SMTP_FROM") || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return json({ error: "SMTP not configured: set SMTP_HOST, SMTP_USER, SMTP_PASS secrets" }, 500);
    }

    const expected = Deno.env.get("WEBHOOK_SECRET");
    const auth = req.headers.get("Authorization");
    let authorized = false;

    // Accept WEBHOOK_SECRET (for DB triggers) or valid Supabase JWT (for frontend)
    if (expected && auth && auth.startsWith("Bearer ") && auth.slice(7) === expected) {
      authorized = true;
    } else if (auth && auth.startsWith("Bearer ")) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const token = auth.slice(7);
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (user && !authError) {
          authorized = true;
        }
      } catch (_) {}
    }

    if (!authorized) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { to, subject, html }: SendEmailPayload = await req.json();
    if (!to || !subject || !html) {
      return json({ error: "Missing required fields: to, subject, html" }, 400);
    }
    if (typeof to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return json({ error: "Invalid email address" }, 400);
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const info = await transporter.sendMail({ from: fromEmail, to, subject, html });

    return json({ success: true, messageId: info.messageId });
  } catch (err) {
    console.error("send-email error:", err.message);
    return json({ success: false, error: err.message }, 500);
  }
});