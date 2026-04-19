import { AtpAgent, RichText } from "@atproto/api";
import type { MastodonMediaAttachment } from "./mastodon.ts";

export async function loginBluesky(
  identifier: string,
  password: string,
): Promise<AtpAgent> {
  const agent = new AtpAgent({ service: "https://bsky.social" });
  await agent.login({ identifier, password });
  return agent;
}

export async function crosspostToBluesky(
  agent: AtpAgent,
  text: string,
  attachments: MastodonMediaAttachment[],
): Promise<void> {
  // Build rich text with auto-detected facets (links, mentions, hashtags)
  const rt = new RichText({ text });
  await rt.detectFacets(agent);

  // Build the post record
  const record: Record<string, unknown> = {
    text: rt.text,
    facets: rt.facets,
    createdAt: new Date().toISOString(),
  };

  // Handle image attachments (Bluesky supports up to 4)
  const images = attachments.filter((a) => a.type === "image").slice(0, 4);

  if (images.length > 0) {
    const uploadedImages = await Promise.all(
      images.map(async (img) => {
        const blob = await uploadImage(agent, img.url);
        return {
          alt: img.description ?? "",
          image: blob,
        };
      }),
    );

    record.embed = {
      $type: "app.bsky.embed.images",
      images: uploadedImages,
    };
  }

  await agent.post(record);
}

async function uploadImage(
  agent: AtpAgent,
  imageUrl: string,
): Promise<unknown> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${res.status} ${imageUrl}`);
  }

  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const data = new Uint8Array(await res.arrayBuffer());

  const uploadRes = await agent.uploadBlob(data, { encoding: contentType });
  return uploadRes.data.blob;
}
