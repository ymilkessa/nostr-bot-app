import { getPublicKey, nip04 } from "nostr-tools";
import EventBuilder from "./eventBuilder";
import { EventCreationParams, EventKinds } from "../types";

global.crypto = require("crypto");

export default class DirectMessageEventBuilder extends EventBuilder {
  private constructor(eventParams: EventCreationParams) {
    super(eventParams);
  }

  public static async createDirectMessageEvent(
    privateKey: string,
    recipientPubkey: string,
    message: string
  ) {
    const encryptedMessage = await nip04.encrypt(
      privateKey,
      recipientPubkey,
      message
    );
    const eventParams: EventCreationParams = {
      pubkey: getPublicKey(privateKey),
      content: encryptedMessage,
      kind: EventKinds.ENCRYPTED_MESSAGE,
      tags: [["p", recipientPubkey]],
    };
    return new DirectMessageEventBuilder(eventParams);
  }
}
