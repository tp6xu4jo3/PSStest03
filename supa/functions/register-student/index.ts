import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "僅接受 POST 請求。" }, 405);

  let body: { student_id?: unknown; password?: unknown; turnstile_token?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "請求格式錯誤。" }, 400);
  }

  const studentId = typeof body.student_id === "string" ? body.student_id.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const turnstileToken = typeof body.turnstile_token === "string" ? body.turnstile_token : "";

  // 僅用虛構測試識別碼；不是北科大校方學號驗證。
  if (!/^(?:0[0-9]{2}|10[0-9]|11[0-5])[0-9]{6}$/.test(studentId)) {
    return json({ error: "測試編號格式錯誤：需為 9 位數，前三碼須介於 000–115。" }, 400);
  }
  if (password.length < 8 || password.length > 72) {
    return json({ error: "密碼長度需為 8–72 個字元。" }, 400);
  }

  // 驗證在伺服器完成，不能只信任前端 token，也不能公開 Secret Key。
  const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!turnstileSecret) return json({ error: "註冊防護尚未設定，暫停開放註冊。" }, 503);
  if (!turnstileToken) return json({ error: "請先完成人機驗證。" }, 400);

  try {
    const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: turnstileSecret, response: turnstileToken }),
    });
    if (!verifyResponse.ok) throw new Error("siteverify HTTP error");
    const verifyResult = await verifyResponse.json() as { success?: boolean; hostname?: string };
    if (verifyResult.success !== true) return json({ error: "人機驗證未通過，請重新驗證。" }, 403);

    // 建議設定 TURNSTILE_ALLOWED_HOSTNAMES（逗號分隔），限制能註冊的正式來源。
    const allowList = (Deno.env.get("TURNSTILE_ALLOWED_HOSTNAMES") || "")
      .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    if (allowList.length && !allowList.includes((verifyResult.hostname || "").toLowerCase())) {
      return json({ error: "不允許從這個網域建立測試帳號。" }, 403);
    }
  } catch (error) {
    console.error("Turnstile siteverify failed:", error);
    return json({ error: "人機驗證服務暫時無法使用。" }, 503);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase project environment variables.");
    return json({ error: "註冊服務尚未完成設定，請聯絡管理者。" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 先檢查 profiles，資料庫 UNIQUE 約束及 Auth 本身也會防止重複帳號。
  const { data: existingProfile, error: profileLookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("student_id", studentId)
    .maybeSingle();

  if (profileLookupError) {
    console.error("Profile lookup failed:", profileLookupError.message);
    return json({ error: "目前無法檢查學號，請稍後再試。" }, 500);
  }
  if (existingProfile) {
    return json({ error: "此學號已註冊，請直接登入。" }, 409);
  }

  const email = `${studentId}@students.library.invalid`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { student_id: studentId },
  });

  if (createError || !created.user) {
    const message = createError?.message?.toLowerCase() ?? "";
    if (message.includes("already") || message.includes("duplicate") || message.includes("exists")) {
      return json({ error: "此學號已註冊，請直接登入。" }, 409);
    }
    console.error("Auth user creation failed:", createError?.message);
    return json({ error: "建立帳號失敗，請稍後重試。" }, 500);
  }

  // profiles 應由 setup.sql 的 auth.users trigger 自動建立；若沒有建立，刪除剛建立的 Auth 帳號。
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", created.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    const { error: rollbackError } = await admin.auth.admin.deleteUser(created.user.id);
    if (rollbackError) console.error("Rollback failed:", rollbackError.message);
    return json({ error: "帳號資料建立未完成，請確認資料庫 trigger 後再試。" }, 500);
  }

  return json({ ok: true, student_id: studentId });
});
