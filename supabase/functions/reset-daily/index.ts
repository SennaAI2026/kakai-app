import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Optional: verify cron secret for security
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // --- Get yesterday's screen_time records to evaluate streaks ---
    const { data: yesterdayRecords, error: fetchError } = await admin
      .from("screen_time")
      .select("id, child_id, used_today, daily_limit, streak_days")
      .eq("date", yesterdayStr);

    if (fetchError) throw fetchError;

    // --- Update streaks based on yesterday's usage ---
    let streakUpdated = 0;
    for (const record of yesterdayRecords ?? []) {
      const newStreak = record.used_today <= record.daily_limit
        ? record.streak_days + 1
        : 0;

      const { error: streakError } = await admin
        .from("screen_time")
        .update({ streak_days: newStreak })
        .eq("id", record.id);

      if (streakError) throw streakError;
      streakUpdated++;
    }

    // --- Create today's screen_time records for all children ---
    const today = new Date().toISOString().split("T")[0];

    const { data: children, error: childrenError } = await admin
      .from("users")
      .select("id")
      .eq("role", "child");

    if (childrenError) throw childrenError;

    let created = 0;
    for (const child of children ?? []) {
      // Carry forward streak from yesterday's record
      const yesterdayRecord = (yesterdayRecords ?? []).find(
        (r) => r.child_id === child.id,
      );
      const carryStreak = yesterdayRecord
        ? (yesterdayRecord.used_today <= yesterdayRecord.daily_limit
          ? yesterdayRecord.streak_days + 1
          : 0)
        : 0;

      const { error: upsertError } = await admin
        .from("screen_time")
        .upsert(
          {
            child_id: child.id,
            date: today,
            used_today: 0,
            is_blocked: false,
            streak_days: carryStreak,
          },
          { onConflict: "child_id,date" },
        );

      if (upsertError) throw upsertError;
      created++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        streaks_evaluated: streakUpdated,
        records_created: created,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
