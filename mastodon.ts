export interface MastodonStatus {
  id: string;
  content: string;
  created_at: string;
  in_reply_to_id: string | null;
  reblog: MastodonStatus | null;
  media_attachments: MastodonMediaAttachment[];
  spoiler_text: string;
  visibility: string;
  url: string;
}

export interface MastodonMediaAttachment {
  id: string;
  type: "image" | "video" | "gifv" | "audio" | "unknown";
  url: string;
  preview_url: string;
  description: string | null;
}

interface MastodonAccount {
  id: string;
  username: string;
  display_name: string;
}

export async function verifyCredentials(
  instance: string,
  accessToken: string,
): Promise<MastodonAccount> {
  const res = await fetch(`${instance}/api/v1/accounts/verify_credentials`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(
      `Failed to verify Mastodon credentials: ${res.status} ${await res.text()}`,
    );
  }
  return await res.json();
}

export async function fetchNewStatuses(
  instance: string,
  accessToken: string,
  accountId: string,
  sinceId?: string,
): Promise<MastodonStatus[]> {
  const params = new URLSearchParams({
    exclude_replies: "true",
    exclude_reblogs: "true",
    limit: "20",
  });
  if (sinceId) {
    params.set("since_id", sinceId);
  }

  const res = await fetch(
    `${instance}/api/v1/accounts/${accountId}/statuses?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!res.ok) {
    throw new Error(
      `Failed to fetch statuses: ${res.status} ${await res.text()}`,
    );
  }

  const statuses: MastodonStatus[] = await res.json();

  // Filter to only public/unlisted posts (skip private/direct)
  const eligible = statuses.filter(
    (s) => s.visibility === "public" || s.visibility === "unlisted",
  );

  // API returns newest first — reverse to process chronologically
  return eligible.reverse();
}
