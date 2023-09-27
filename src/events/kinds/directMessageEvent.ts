import { EventKinds, SignedEventData } from "../types";
import GenericEvent from "./genericEvent";

import { nip04 } from "nostr-tools";

global.crypto = require("crypto");

/**
 * Contains the decrypted text of a direct message in the .decryptedMessage property.
 */
export default class DirectMessageEvent extends GenericEvent {
  decryptedMessage: string = "";

  private constructor(eventData: any) {
    if (eventData.kind !== EventKinds.ENCRYPTED_MESSAGE) {
      throw new Error("Invalid kind for DirectMessageEvent");
    }
    super(eventData);
  }

  public static async deconstructEvent(
    eventData: SignedEventData,
    recipientPrivateKey: string
  ) {
    const event = new DirectMessageEvent(eventData);
    event.decryptedMessage = await nip04.decrypt(
      recipientPrivateKey,
      event.pubkey,
      event.content
    );
    return event;
  }
}
