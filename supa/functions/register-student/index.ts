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

  let body: { student_id?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "請求格式錯誤。" }, 400);
  }

  const studentId = typeof body.student_id === "string" ? body.student_id.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  // 僅用虛構測試識別碼；不是北科大校方學號驗證。
  if (!/^(?:0[0-9]{2}|10[0-9]|11[0-5])[0-9]{6}$/.test(studentId)) {
    return json({ error: "測試編號格式錯誤：需為 9 位數，前三碼須介於 000–115。" }, 400);
  }
  if (password.length < 8 || password.length > 72) {
    return json({ error: "密碼長度需為 8–72 個字元。" }, 400);
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

  // 不需額外服務：沿用 setup.sql 的 Supabase Postgres 原子限流 RPC。
  // 每個虛構測試編號每小時最多 5 次註冊嘗試，僅存 SHA-256 雜湊。
  // 此方法不等同驗證真人，無法防止有人換用大量不同編號，僅適合教學原型。
  const digest = await crypto.subtle.digest(
    "SHA-256", new TextEncoder().encode("ntut-demo-register:" + studentId)
  );
  const hash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
  const { data: allowed, error: limitError } = await admin.rpc("allow_registration_attempt", {
    p_ip_hash: "id:" + hash
  });
  if (limitError) {
    console.error("Registration rate limiter unavailable:", limitError.message);
    return json({ error: "註冊限流功能未啟用，請檢查 Supabase setup.sql。" }, 503);
  }
  if (allowed !== true) {
    return json({ error: "此測試編號的註冊嘗試過於頻繁，請稍後再試。" }, 429);
  }

  // 先檢查 profiles，資料庫 UNIQUE 約束及 Auth 本身也會防止重複帳號。
  const { data: existingProfile, error: profileLookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("student_id", studentId)
    .maybeSingle();

  if (profileLookupError) {
    console.error("Profile lookup failed:", profileLookupError.message);
    return json({ error: "目前無法檢查測試編號，請稍後再試。" }, 500);
  }
  if (existingProfile) {
    return json({ error: "此測試編號已註冊，請直接登入。" }, 409);
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
      return json({ error: "此測試編號已註冊，請直接登入。" }, 409);
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
