// Edge function "notify": the app calls it right after someone sends a heart or answers the daily question, and it pushes a
// phone notification to the other person's devices. It makes its own push key pair on first use and keeps it
// in public.push_keys, which only the service role can read; SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are built in.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const KINDS: Record<string, string> = {
  think: "Thinking of you 💗", miss: "Missing you 🥺", morning: "Good morning ☀️", night: "Good night 🌙",
  hug: "Sending a hug 🤗", proud: "Proud of you ✨", call: "Call me? 📞",
};
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function vapid(admin: ReturnType<typeof createClient>) {
  const { data } = await admin.from("push_keys").select("pub,priv").eq("id", 1).maybeSingle();
  if (data) return data;
  const k = webpush.generateVAPIDKeys();
  // ignoreDuplicates + re-read: if two first calls race, both end up with the same stored pair.
  await admin.from("push_keys").upsert({ id: 1, pub: k.publicKey, priv: k.privateKey }, { onConflict: "id", ignoreDuplicates: true });
  const { data: saved, error } = await admin.from("push_keys").select("pub,priv").eq("id", 1).single();
  if (!saved) throw new Error("push_keys table missing, run the notifications SQL: " + error?.message);
  return saved;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Only the two members may send, and the sender's side comes from their login, not the request.
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user?.email) return json({ error: "not logged in" }, 401);
  const { data: me } = await admin.from("members").select("side").ilike("email", user.email).maybeSingle();
  if (!me) return json({ error: "not a member" }, 403);
  const to = me.side === "nl" ? "mx" : "nl";

  const keys = await vapid(admin);
  const { k, action, text, tag } = await req.json().catch(() => ({}));
  // The app asks for the public key before it subscribes a phone.
  if (action === "key") return json({ publicKey: keys.pub });
  webpush.setVapidDetails("mailto:hasta-pronto@example.com", keys.pub, keys.priv);
  const { data: settings } = await admin.from("docs").select("data").eq("path", "app/settings").maybeSingle();
  const name = settings?.data?.names?.[me.side] || (me.side === "nl" ? "Netherlands" : "Mexico");
  // A heart sends its kind; other events (like the daily question) send their own short text.
  const body = typeof text === "string" && text.trim() ? text.trim().slice(0, 140) : KINDS[k] || KINDS.think;
  const payload = JSON.stringify({ title: name, body, tag: (typeof tag === "string" ? tag.slice(0, 20) : "tap") + "-" + me.side });

  const { data: subs } = await admin.from("docs").select("path,data").eq("col", "push").eq("data->>side", to);
  let sent = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification(s.data.sub, payload, { TTL: 12 * 3600, urgency: "high" });
      sent++;
    } catch (e) {
      // 404/410 mean the phone dropped this subscription; forget it.
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from("docs").delete().eq("path", s.path);
      else console.error("push failed", code, (e as Error).message);
    }
  }
  return json({ sent });
});
