import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PteroRequest {
  action: string;
  [key: string]: unknown;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    const PANEL_URL = Deno.env.get("PTERODACTYL_PANEL_URL")!.replace(/\/$/, "");
    const API_KEY = Deno.env.get("PTERODACTYL_API_KEY")!;

    const body: PteroRequest = await req.json();
    const { action, ...params } = body;

    const pteroFetch = async (endpoint: string, options: RequestInit = {}) => {
      const url = `${PANEL_URL}/api/application${endpoint}`;
      const res = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(options.headers || {}),
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Pterodactyl API error ${res.status}: ${text}`);
      }
      const contentType = res.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        return await res.json();
      }
      return null;
    };

    // Check admin role
    const checkAdmin = async () => {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    };

    let result: unknown;

    switch (action) {
      // ===== SERVER ACTIONS =====
      case "list_servers": {
        const data = await pteroFetch("/servers?per_page=500&include=allocations,node,location");
        result = data;
        break;
      }

      case "get_server": {
        const { server_id } = params;
        const data = await pteroFetch(`/servers/${server_id}?include=allocations,node,location`);
        result = data;
        break;
      }

      case "create_server": {
        const { name, egg_id, ram, cpu, disk, location_id, node_id, ptero_user_id } = params as any;

        // Get egg details for startup/docker
        const eggData = await pteroFetch(`/nests/1/eggs/${egg_id}?include=variables`);
        const egg = eggData.attributes;

        // Get allocation from the node
        const allocData = await pteroFetch(`/nodes/${node_id}/allocations?per_page=500`);
        const freeAlloc = allocData.data?.find((a: any) => !a.attributes.assigned);
        if (!freeAlloc) throw new Error("No free allocations on this node");

        const environment: Record<string, string> = {};
        if (egg.relationships?.variables?.data) {
          for (const v of egg.relationships.variables.data) {
            environment[v.attributes.env_variable] = v.attributes.default_value || "";
          }
        }

        const serverPayload = {
          name,
          user: ptero_user_id,
          egg: egg_id,
          docker_image: egg.docker_image,
          startup: egg.startup,
          environment,
          limits: {
            memory: ram,
            swap: 0,
            disk,
            io: 500,
            cpu,
          },
          feature_limits: {
            databases: 2,
            backups: 2,
            allocations: 1,
          },
          allocation: {
            default: freeAlloc.attributes.id,
          },
        };

        const data = await pteroFetch("/servers", {
          method: "POST",
          body: JSON.stringify(serverPayload),
        });
        result = data;
        break;
      }

      case "delete_server": {
        const { server_id } = params;
        await pteroFetch(`/servers/${server_id}`, { method: "DELETE" });
        result = { success: true };
        break;
      }

      case "suspend_server": {
        if (!(await checkAdmin())) throw new Error("Admin only");
        const { server_id } = params;
        await pteroFetch(`/servers/${server_id}/suspend`, { method: "POST" });
        result = { success: true };
        break;
      }

      case "unsuspend_server": {
        if (!(await checkAdmin())) throw new Error("Admin only");
        const { server_id } = params;
        await pteroFetch(`/servers/${server_id}/unsuspend`, { method: "POST" });
        result = { success: true };
        break;
      }

      case "update_server_build": {
        const { server_id, ram, cpu, disk, allocation_id } = params as any;
        const data = await pteroFetch(`/servers/${server_id}/build`, {
          method: "PATCH",
          body: JSON.stringify({
            allocation: allocation_id,
            memory: ram,
            swap: 0,
            disk,
            io: 500,
            cpu,
            feature_limits: { databases: 2, backups: 2, allocations: 1 },
          }),
        });
        result = data;
        break;
      }

      // ===== USER ACTIONS =====
      case "list_users": {
        if (!(await checkAdmin())) throw new Error("Admin only");
        const data = await pteroFetch("/users?per_page=500");
        result = data;
        break;
      }

      case "create_user": {
        if (!(await checkAdmin())) throw new Error("Admin only");
        const { username, email, first_name, last_name, password: pw } = params as any;
        const data = await pteroFetch("/users", {
          method: "POST",
          body: JSON.stringify({ username, email, first_name, last_name, password: pw }),
        });
        result = data;
        break;
      }

      case "delete_user": {
        if (!(await checkAdmin())) throw new Error("Admin only");
        const { ptero_user_id } = params;
        await pteroFetch(`/users/${ptero_user_id}`, { method: "DELETE" });
        result = { success: true };
        break;
      }

      // ===== LOCATION & NODE ACTIONS =====
      case "list_locations": {
        const data = await pteroFetch("/locations");
        result = data;
        break;
      }

      case "list_nodes": {
        const data = await pteroFetch("/nodes?include=location,servers");
        result = data;
        break;
      }

      case "list_nests": {
        const data = await pteroFetch("/nests?include=eggs");
        result = data;
        break;
      }

      case "list_eggs": {
        const { nest_id } = params;
        const data = await pteroFetch(`/nests/${nest_id}/eggs?include=variables`);
        result = data;
        break;
      }

      // ===== POWER ACTIONS (Client API) =====
      case "server_power": {
        const { server_identifier, signal } = params as any;
        // Power actions use the CLIENT API, not application API
        const clientUrl = `${PANEL_URL}/api/client/servers/${server_identifier}/power`;
        const res = await fetch(clientUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ signal }), // start, stop, restart, kill
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Power action failed: ${text}`);
        }
        await res.text();
        result = { success: true };
        break;
      }

      case "server_resources": {
        const { server_identifier } = params as any;
        const clientUrl = `${PANEL_URL}/api/client/servers/${server_identifier}/resources`;
        const res = await fetch(clientUrl, {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            Accept: "application/json",
          },
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Resources fetch failed: ${text}`);
        }
        result = await res.json();
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
