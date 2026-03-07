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
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // --- Parse body ---
    const { child_id, logs } = await req.json();

    if (!child_id || !Array.isArray(logs)) {
      return new Response(JSON.stringify({ error: "child_id and logs[] are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Verify caller is the child ---
    if (user.id !== child_id) {
      return new Response(JSON.stringify({ error: "You can only sync your own usage" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];

    // --- Upsert usage logs ---
    for (const log of logs) {
      const { package_name, app_name, minutes } = log;
      if (!package_name || minutes == null) continue;

      const { error: upsertError } = await admin
        .from("usage_logs")
        .upsert(
          {
            child_id,
            package_name,
            app_name: app_name ?? null,
            date: today,
            minutes,
          },
          { onConflict: "child_id,package_name,date" },
        );

      if (upsertError) throw upsertError;
    }

    // --- Recalculate used_today from limited apps ---
    // Get the child's family to look up app_rules
    const { data: childUser } = await admin
      .from("users")
      .select("family_id")
      .eq("id", child_id)
      .single();

    let usedToday = 0;

    if (childUser?.family_id) {
      // Get all "limited" app package names for this family
      const { data: limitedRules } = await admin
        .from("app_rules")
        .select("package_name")
        .eq("family_id", childUser.family_id)
        .eq("category", "limited");

      const limitedPackages = (limitedRules ?? []).map((r) => r.package_name);

      if (limitedPackages.length > 0) {
        // Sum minutes from today's usage_logs for limited apps
        const { data: todayLogs } = await admin
          .from("usage_logs")
          .select("minutes")
          .eq("child_id", child_id)
          .eq("date", today)
          .in("package_name", limitedPackages);

        usedToday = (todayLogs ?? []).reduce((sum, l) => sum + (l.minutes ?? 0), 0);
      } else {
        // No rules configured — sum all usage as limited by default
        const { data: todayLogs } = await admin
          .from("usage_logs")
          .select("minutes")
          .eq("child_id", child_id)
          .eq("date", today);

        usedToday = (todayLogs ?? []).reduce((sum, l) => sum + (l.minutes ?? 0), 0);
      }
    }

    // --- Update screen_time ---
    const { data: screenTime } = await admin
      .from("screen_time")
      .select("id")
      .eq("child_id", child_id)
      .eq("date", today)
      .single();

    if (screenTime) {
      const { error: updateError } = await admin
        .from("screen_time")
        .update({ used_today: usedToday })
        .eq("id", screenTime.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await admin
        .from("screen_time")
        .insert({ child_id, date: today, used_today: usedToday });

      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, used_today: usedToday }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
