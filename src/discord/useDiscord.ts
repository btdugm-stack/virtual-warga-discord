import { useEffect, useState } from "react";
import type { Snapshot } from "./types";

/** `lost` means the stream dropped after working; the browser retries on its own and the last picture stays up. */
export type LinkState = "connecting" | "live" | "lost";

/** Subscribes to the server's snapshot stream. Every event carries the whole picture, so there is nothing to merge. */
export function useDiscord(): { snapshot: Snapshot | null; link: LinkState } {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [link, setLink] = useState<LinkState>("connecting");

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.addEventListener("snapshot", (event) => {
      try {
        setSnapshot(JSON.parse((event as MessageEvent<string>).data) as Snapshot);
        setLink("live");
      } catch {
        // A malformed frame is skipped; the next one replaces the picture anyway.
      }
    });
    source.onerror = () => setLink((current) => (current === "live" ? "lost" : current));
    return () => source.close();
  }, []);

  return { snapshot, link };
}
