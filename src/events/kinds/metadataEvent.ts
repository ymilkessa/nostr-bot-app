import { EventKinds, SignedEventData } from "../types";
import GenericEvent from "./genericEvent";

export type NostrMetaData = {
  name?: string;
  about?: string;
  picture?: string;
};

/**
 * Provides Nostr metadata in the .authorMetaData property.
 */
export default class MetadataEvent extends GenericEvent {
  authorMetaData: NostrMetaData;

  constructor(eventData: any) {
    if (eventData.kind !== EventKinds.METADATA) {
      throw new Error("Invalid kind for MetadataEvent");
    }

    super(eventData);
    this.authorMetaData = JSON.parse(this.content) as NostrMetaData;
  }

  public static async deconstructEvent(eventData: SignedEventData) {
    return new MetadataEvent(eventData);
  }
}
