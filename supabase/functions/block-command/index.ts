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
    const { family_id, is_blocked } = await req.json();

    if (!family_id || typeof is_blocked !== "boolean") {
      return new Response(
        JSON.stringify({ error: "family_id and is_blocked (boolean) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Verify caller is the parent of this family ---
    const { data: family, error: familyError } = await admin
      .from("families")
      .select("parent_id, child_id")
      .eq("id", family_id)
      .single();

    if (familyError || !family) {
      return new Response(JSON.stringify({ error: "Family not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (family.parent_id !== user.id) {
      return new Response(JSON.stringify({ error: "Only the parent can block/unblock" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!family.child_id) {
      return new Response(JSON.stringify({ error: "No child in this family yet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Update screen_time for the child ---
    const today = new Date().toISOString().split("T")[0];

    const { data: screenTime } = await admin
      .from("screen_time")
      .select("id")
      .eq("child_id", family.child_id)
      .eq("date", today)
      .single();

    if (screenTime) {
      const { error: updateError } = await admin
        .from("screen_time")
        .update({ is_blocked })
        .eq("id", screenTime.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await admin
        .from("screen_time")
        .insert({ child_id: family.child_id, date: today, is_blocked });

      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, is_blocked }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
