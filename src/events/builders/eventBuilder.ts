import { getSignature, getEventHash, getPublicKey } from "nostr-tools";
import { SignedEventData, EventCreationParams, EventPayload } from "../types";

export default class EventBuilder {
  private createdAt: number;
  private content: string;
  private tags: string[][] = [];
  private id: string | null = null;
  private sig: string | null = null;
  private kind: number;
  private pubkey: string;

  constructor(eventParams: EventCreationParams) {
    this.pubkey = eventParams.pubkey;
    this.createdAt = Math.floor(Date.now() / 1000);
    this.content = eventParams.content;
    this.kind = eventParams.kind;
    if (eventParams.tags && eventParams.tags.length > 0) {
      for (const tag of eventParams.tags) {
        this.addTag([...tag]);
      }
    }
  }

  isEventFixed() {
    return this.id !== null;
  }

  isEventSigned() {
    return this.sig !== null;
  }

  addTag(tag: string[]) {
    if (this.isEventFixed()) {
      throw new Error("Event is fixed");
    }

    this.tags.push(tag);
  }

  setEventKind(kind: number) {
    if (this.isEventFixed()) {
      throw new Error("Event is fixed");
    }

    this.kind = kind;
  }

  setEventContent(content: string) {
    if (this.isEventFixed()) {
      throw new Error("Event is fixed");
    }

    this.content = content;
  }

  getEventContent() {
    return this.content;
  }

  /**
   * Returns the portion of the event data that gets hashed (and then signed).
   */
  getEventPayload(): EventPayload {
    return {
      pubkey: this.pubkey,
      created_at: this.createdAt,
      kind: this.kind,
      tags: this.tags,
      content: this.content,
    };
  }

  getSignedEventData(): SignedEventData {
    if (!this.isEventSigned()) {
      throw new Error("Event is not signed.");
    }
    return {
      id: this.id!,
      sig: this.sig!,
      ...this.getEventPayload(),
    };
  }

  serialize() {
    if (this.isEventFixed()) {
      return;
    }
    const eventData = this.getEventPayload();
    this.id = getEventHash(eventData);
  }

  /**
   * Sign the event using the given private key only if the key matches
   * with the public key.
   *
   * No need to run serialize() prior to this.
   */
  singEvent(privKey: string): void {
    if (this.sig) {
      return;
    }
    const pubkey = getPublicKey(privKey);
    if (pubkey !== this.pubkey) {
      throw new Error(
        "Event can only be signed by the author. Given private key does not match the public key of the author."
      );
    }

    // In case it was not serialized.
    this.serialize();

    this.sig = getSignature(this.getEventPayload(), privKey);
  }

  getAuthorPublicKey() {
    return this.pubkey;
  }

  getEventId() {
    if (!this.isEventFixed()) {
      throw new Error("Event has not been finalized.");
    }
    return this.id!;
  }
}
