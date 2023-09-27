import { verifySignature } from "nostr-tools";
import { SignedEventData } from "../types";

export default class GenericEvent {
  id: string;
  content: string;
  kind: number;
  tags: string[][];
  created_at: number;
  sig: string;
  pubkey: string;

  constructor(eventData: SignedEventData) {
    this.id = eventData.id;
    this.content = eventData.content;
    this.kind = eventData.kind;
    this.tags = eventData.tags;
    this.created_at = eventData.created_at;
    this.sig = eventData.sig;
    this.pubkey = eventData.pubkey;
  }

  getEventData(): SignedEventData {
    return {
      id: this.id,
      content: this.content,
      kind: this.kind,
      tags: this.tags,
      created_at: this.created_at,
      sig: this.sig,
      pubkey: this.pubkey,
    };
  }

  verifySignature() {
    return verifySignature(this.getEventData());
  }

  public static async deconstructEvent(
    eventData: SignedEventData,
    ..._otherArgs: any
  ) {
    return new GenericEvent(eventData);
  }
}
