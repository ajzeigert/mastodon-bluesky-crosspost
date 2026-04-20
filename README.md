# mastodon-bluesky-crosspost

Automatically cross-posts your Mastodon posts to Bluesky. Polls your Mastodon account every 5 minutes and creates corresponding Bluesky posts, including image attachments and alt text. Written in TypeScript with Deno.

Easily deploy to Deno Deploy.

## Features

- Polls for new Mastodon posts every 5 minutes
- Converts HTML post content to plain text with proper link/mention/hashtag handling
- Uploads image attachments (up to 4 per post) with alt text
- Truncates long posts to fit Bluesky's 300-grapheme limit, linking back to the original
- Prepends content warnings when present
- Skips replies, boosts, and private/direct posts
- Persists state with Deno KV so it picks up where it left off across restarts
- On first run, bookmarks the latest post without cross-posting the backlog

## Requirements

- [Deno](https://deno.land/) v1.38+
- A Mastodon access token (Settings > Development > New Application)
- A Bluesky App Password (Settings > App Passwords)

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your credentials:

```
MASTODON_INSTANCE=https://mastodon.social
MASTODON_ACCESS_TOKEN=your_access_token_here
BLUESKY_IDENTIFIER=your.handle.bsky.social
BLUESKY_PASSWORD=your_app_password_here
```

3. Run the service:

```bash
# Development (reads from .env file)
deno task dev

# Production
deno task start --unstable-kv
```

The service starts an HTTP health check on port 8000 and polls for new posts every 5 minutes.

## How it works

1. **main.ts** — Entry point. Authenticates with both services, sets up a cron-based polling loop, and runs a health check server.
2. **mastodon.ts** — Fetches new public/unlisted statuses from the Mastodon API, filtering out replies and boosts.
3. **transform.ts** — Converts Mastodon's HTML content to plain text and truncates to Bluesky's grapheme limit.
4. **bluesky.ts** — Logs into Bluesky via the AT Protocol, uploads images, and creates posts with rich text facets.

## License

MIT
