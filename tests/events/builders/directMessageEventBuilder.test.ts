import { generatePrivateKey, getPublicKey } from "nostr-tools";
import { nip04 } from "nostr-tools";
import DirectMessageEventBuilder from "../../../src/events/builders/directMessageEventBuilder";

global.crypto = require("crypto");

describe("DirectMessageEventBuilder", () => {
  let alice: string;
  let bob: string;

  beforeAll(() => {
    alice = generatePrivateKey();
    bob = generatePrivateKey();
  });

  it("should correctly encrypt a new message.", async () => {
    const message = "Hello there, Bob.";
    const event = await DirectMessageEventBuilder.createDirectMessageEvent(
      alice,
      getPublicKey(bob),
      message
    );

    const decryptedMessage = await nip04.decrypt(
      bob,
      getPublicKey(alice),
      event.getEventContent()
    );

    expect(decryptedMessage).toBe(message);
  });
});
