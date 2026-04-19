import { verifyCredentials, fetchNewStatuses } from "./mastodon.ts";
import { loginBluesky, crosspostToBluesky } from "./bluesky.ts";
import { htmlToPlainText, truncateForBluesky } from "./transform.ts";

// Load config from environment
const MASTODON_INSTANCE = Deno.env.get("MASTODON_INSTANCE") ?? "https://mastodon.social";
const MASTODON_ACCESS_TOKEN = Deno.env.get("MASTODON_ACCESS_TOKEN");
const BLUESKY_IDENTIFIER = Deno.env.get("BLUESKY_IDENTIFIER");
const BLUESKY_PASSWORD = Deno.env.get("BLUESKY_PASSWORD");

if (!MASTODON_ACCESS_TOKEN || !BLUESKY_IDENTIFIER || !BLUESKY_PASSWORD) {
  console.error(
    "Missing required environment variables. See .env.example for details.",
  );
  Deno.exit(1);
}

// Open Deno KV for persisting state
const kv = await Deno.openKv();

// Resolve Mastodon account ID on startup
const account = await verifyCredentials(MASTODON_INSTANCE, MASTODON_ACCESS_TOKEN);
console.log(`Authenticated as @${account.username} on ${MASTODON_INSTANCE}`);

async function poll() {
  try {
    const lastSeen = await kv.get<string>(["last_seen_id"]);

    const statuses = await fetchNewStatuses(
      MASTODON_INSTANCE,
      MASTODON_ACCESS_TOKEN!,
      account.id,
      lastSeen.value ?? undefined,
    );

    if (statuses.length === 0) {
      console.log(`[${new Date().toISOString()}] No new posts.`);
      return;
    }

    // First run: just bookmark the latest post ID, don't cross-post the backlog
    if (lastSeen.value === null) {
      const latest = statuses[statuses.length - 1];
      await kv.set(["last_seen_id"], latest.id);
      console.log(
        `[${new Date().toISOString()}] First run — skipping ${statuses.length} existing post(s), bookmarked ${latest.id}.`,
      );
      return;
    }

    console.log(
      `[${new Date().toISOString()}] Found ${statuses.length} new post(s).`,
    );

    // Login to Bluesky for this batch
    const agent = await loginBluesky(BLUESKY_IDENTIFIER!, BLUESKY_PASSWORD!);

    for (const status of statuses) {
      // Convert HTML to plain text
      let text = htmlToPlainText(status.content);

      // Prepend content warning if present
      if (status.spoiler_text) {
        text = `CW: ${status.spoiler_text}\n\n${text}`;
      }

      // Truncate if needed, linking back to the original
      text = truncateForBluesky(text, status.url);

      // Filter to image attachments only
      const imageAttachments = status.media_attachments.filter(
        (a) => a.type === "image",
      );

      const nonImageMedia = status.media_attachments.filter(
        (a) => a.type !== "image",
      );
      if (nonImageMedia.length > 0) {
        console.log(
          `  Skipping ${nonImageMedia.length} non-image attachment(s) for post ${status.id}`,
        );
      }

      try {
        await crosspostToBluesky(agent, text, imageAttachments);
        console.log(`  Cross-posted: ${status.url}`);
      } catch (err) {
        console.error(`  Failed to cross-post ${status.id}:`, err);
        // Continue with next post rather than stopping entirely
      }

      // Update last seen ID after each successful post
      await kv.set(["last_seen_id"], status.id);
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Poll error:`, err);
  }
}

// Schedule polling every 5 minutes
Deno.cron("crosspost-poll", "*/5 * * * *", poll);

// Also run immediately on startup
await poll();

// Keep the process alive (and provide a health check endpoint)
Deno.serve({ port: 8000 }, (_req) => {
  return new Response("mastodon-bluesky-crosspost is running", { status: 200 });
});
