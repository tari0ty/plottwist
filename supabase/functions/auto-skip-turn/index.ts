import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StoryRecord {
  id: string;
  status: string | null;
  turns_per_writer: number | null;
}

interface ParticipantRecord {
  id: string;
  user_id: string | null;
  turn_order: number;
  has_taken_turn: boolean | null;
  turn_skipped: boolean | null;
  turn_started_at: string | null;
}

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

function isExpired(startedAt: string | null) {
  if (!startedAt) {
    return false;
  }

  return new Date(startedAt).getTime() + 24 * 60 * 60 * 1000 < Date.now();
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse({ error: "Missing required server environment variables" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    try {
      const { data: stories, error: storiesError } = await supabaseAdmin
        .from("stories")
        .select("id, status, turns_per_writer")
        .eq("status", "active");

      if (storiesError) {
        return jsonResponse({ error: storiesError.message }, { status: 500 });
      }

      const skipped: string[] = [];
      const completedStories: string[] = [];

      for (const story of (stories ?? []) as StoryRecord[]) {
        const { data: participants, error: participantsError } = await supabaseAdmin
          .from("story_participants")
          .select("id, user_id, turn_order, has_taken_turn, turn_skipped, turn_started_at")
          .eq("story_id", story.id)
          .order("turn_order", { ascending: true });

        if (participantsError) {
          return jsonResponse({ error: participantsError.message, story_id: story.id }, { status: 500 });
        }

        const { data: turns, error: turnsError } = await supabaseAdmin
          .from("turns")
          .select("participant_id")
          .eq("story_id", story.id);

        if (turnsError) {
          return jsonResponse({ error: turnsError.message, story_id: story.id }, { status: 500 });
        }

        const turnsTakenByParticipant = (turns ?? []).reduce<Record<string, number>>((acc, turn) => {
          const participantId = turn.participant_id ?? null;
          if (participantId) {
            acc[participantId] = (acc[participantId] ?? 0) + 1;
          }
          return acc;
        }, {});

        const orderedParticipants = (participants ?? []) as ParticipantRecord[];
        const currentParticipant = orderedParticipants
          .filter((entry) => !entry.has_taken_turn && (turnsTakenByParticipant[entry.id] ?? 0) < (story.turns_per_writer ?? 1))
          .sort((left, right) => {
            const leftTurns = turnsTakenByParticipant[left.id] ?? 0;
            const rightTurns = turnsTakenByParticipant[right.id] ?? 0;
            return leftTurns - rightTurns || left.turn_order - right.turn_order;
          })[0] ?? null;

        if (currentParticipant && isExpired(currentParticipant.turn_started_at)) {
          const { error: skipError } = await supabaseAdmin
            .from("story_participants")
            .update({
              turn_skipped: true,
              has_taken_turn: true,
            })
            .eq("id", currentParticipant.id);

          if (skipError) {
            return jsonResponse({ error: skipError.message, participant_id: currentParticipant.id }, { status: 500 });
          }

          skipped.push(currentParticipant.id);
        }

        const { data: refreshedParticipants, error: refreshedParticipantsError } = await supabaseAdmin
          .from("story_participants")
          .select("id, has_taken_turn")
          .eq("story_id", story.id);

        if (refreshedParticipantsError) {
          return jsonResponse({ error: refreshedParticipantsError.message, story_id: story.id }, { status: 500 });
        }

        if ((refreshedParticipants ?? []).length > 0 && refreshedParticipants?.every((entry) => entry.has_taken_turn)) {
          const { error: updateStoryError } = await supabaseAdmin
            .from("stories")
            .update({ status: "voting" })
            .eq("id", story.id);

          if (updateStoryError) {
            return jsonResponse({ error: updateStoryError.message, story_id: story.id }, { status: 500 });
          }

          completedStories.push(story.id);
        }
      }

      return jsonResponse({
        skipped_count: skipped.length,
        skipped,
        advanced_story_count: completedStories.length,
        advanced_stories: completedStories,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      return jsonResponse({ error: message }, { status: 500 });
    }
  },
};
