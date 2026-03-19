import type { CampaignChatMessage } from "@umbra/shared";

type Listener = (message: CampaignChatMessage) => void;

export class CampaignLiveHub {
  private readonly listeners = new Map<string, Set<Listener>>();

  subscribe(campaignId: string, listener: Listener): () => void {
    const bucket = this.listeners.get(campaignId) ?? new Set<Listener>();
    bucket.add(listener);
    this.listeners.set(campaignId, bucket);

    return () => {
      const current = this.listeners.get(campaignId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        this.listeners.delete(campaignId);
      }
    };
  }

  publish(campaignId: string, message: CampaignChatMessage): void {
    const bucket = this.listeners.get(campaignId);
    if (!bucket) return;

    for (const listener of bucket) {
      listener(message);
    }
  }
}

export const campaignLiveHub = new CampaignLiveHub();
