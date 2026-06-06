import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT =
  "You are a master storyteller running a collaborative fiction game called PlotTwist. Generate exactly 5 compelling next-moment choices for the story. Each choice must be one sentence. Each must feel meaningfully different. Match the tone and genre. Create tension, curiosity, or surprise. Return ONLY a valid JSON array of exactly 5 strings, no explanation, no markdown, no backticks.";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...(init.headers ?? {}),
    },
  });
}

function extractJsonArray(text: string): string[] {
  const cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed) || parsed.length !== 5 || parsed.some((item) => typeof item !== "string")) {
    throw new Error("Anthropic response was not a valid array of 5 strings.");
  }

  return parsed;
}

export default {
  fetch: async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, { status: 405 });
    }

    try {
      const { story_id, turn_number } = await req.json();

      if (!story_id || typeof turn_number !== "number") {
        return jsonResponse({ error: "story_id and turn_number are required" }, { status: 400 });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

      if (!supabaseUrl || !supabaseServiceRoleKey || !anthropicApiKey) {
        return jsonResponse({ error: "Missing required server environment variables" }, { status: 500 });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const { data: story, error: storyError } = await supabaseAdmin
        .from("stories")
        .select("opening_line, genre")
        .eq("id", story_id)
        .single();

      if (storyError || !story) {
        return jsonResponse({ error: storyError?.message ?? "Story not found" }, { status: 404 });
      }

      const { data: turns, error: turnsError } = await supabaseAdmin
        .from("turns")
        .select("chosen_text, turn_number")
        .eq("story_id", story_id)
        .order("turn_number", { ascending: true });

      if (turnsError) {
        return jsonResponse({ error: turnsError.message }, { status: 500 });
      }

      const storySoFar = turns && turns.length > 0
        ? turns.map((turn) => turn.chosen_text).join("\n")
        : "Just the opening line";

      const userPrompt = `Genre: ${story.genre ?? "General"}\nOpening line: ${story.opening_line ?? ""}\nStory so far:\n${storySoFar}\nGenerate the next 5 fork choices.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return jsonResponse({ error: 'Anthropic request failed', details: errorText }, { status: 502 });
      }

      const data = await response.json();
      const text = data.content[0].text;
      const choices = extractJsonArray(text);

      const { data: fork, error: forkError } = await supabaseAdmin
        .from("forks")
        .insert({
          story_id,
          turn_number,
          story_context: storySoFar,
          status: "pending",
        })
        .select("*")
        .single();

      if (forkError || !fork) {
        return jsonResponse({ error: forkError?.message ?? "Could not create fork record" }, { status: 500 });
      }

      const forkOptions = await Promise.all(
        choices.map((content, index) =>
          supabaseAdmin
            .from("fork_options")
            .insert({
              fork_id: fork.id,
              option_index: index + 1,
              content,
              was_chosen: false,
            })
            .select("*")
            .single()
        )
      );

      const failedOption = forkOptions.find((entry) => entry.error);
      if (failedOption) {
        return jsonResponse({ error: failedOption.error?.message ?? "Could not create fork options" }, { status: 500 });
      }

      return jsonResponse({
        fork,
        options: forkOptions.map((entry) => entry.data),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      return jsonResponse({ error: message }, { status: 500 });
    }
  },
};
