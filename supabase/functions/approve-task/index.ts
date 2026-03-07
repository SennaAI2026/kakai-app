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
    // --- Auth: get caller's JWT ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Anon client to verify caller
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

    // Service-role client to bypass RLS
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // --- Parse body ---
    const { task_id, family_id } = await req.json();
    if (!task_id || !family_id) {
      return new Response(JSON.stringify({ error: "task_id and family_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Only the parent can approve tasks" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Get task and validate ---
    const { data: task, error: taskError } = await admin
      .from("tasks")
      .select("id, family_id, child_id, reward_minutes, status")
      .eq("id", task_id)
      .single();

    if (taskError || !task) {
      return new Response(JSON.stringify({ error: "Task not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (task.family_id !== family_id) {
      return new Response(JSON.stringify({ error: "Task does not belong to this family" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (task.status === "approved") {
      return new Response(JSON.stringify({ error: "Task is already approved" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Approve the task ---
    const { error: updateTaskError } = await admin
      .from("tasks")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", task_id);

    if (updateTaskError) {
      throw updateTaskError;
    }

    // --- Add reward minutes to child's screen_time balance ---
    const childId = task.child_id;
    const today = new Date().toISOString().split("T")[0];

    // Get or create today's screen_time row
    const { data: screenTime } = await admin
      .from("screen_time")
      .select("id, balance_minutes")
      .eq("child_id", childId)
      .eq("date", today)
      .single();

    if (screenTime) {
      const { error: updateStError } = await admin
        .from("screen_time")
        .update({ balance_minutes: screenTime.balance_minutes + task.reward_minutes })
        .eq("id", screenTime.id);

      if (updateStError) throw updateStError;
    } else {
      const { error: insertStError } = await admin
        .from("screen_time")
        .insert({
          child_id: childId,
          date: today,
          balance_minutes: task.reward_minutes,
        });

      if (insertStError) throw insertStError;
    }

    return new Response(
      JSON.stringify({ success: true, reward_minutes: task.reward_minutes }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
