import { NostrBotApp } from "../../src/bot/nostrBot";
import DirectMessageEventBuilder from "../../src/events/builders/directMessageEventBuilder";
import { getPublicKey } from "nostr-tools";
import DirectMessageEvent from "../../src/events/kinds/directMessageEvent";
import dotevn from "dotenv";
import EventBuilder from "../../src/events/builders/eventBuilder";

dotevn.config();

const stringToPrepend = "This is my reply to your text: \n";
const directMessageHandler = async (
  dmObject: DirectMessageEvent,
  _subscriptionId: string,
  botRef: NostrBotApp
) => {
  const replyDM = await DirectMessageEventBuilder.createDirectMessageEvent(
    botRef.getPrivateKey(),
    dmObject.pubkey,
    stringToPrepend + dmObject.decryptedMessage
  );
  // Add the id of the event that we are replying to.
  replyDM.addTag(["e", dmObject.id]);
  const signedReplyDM = botRef.signEvent(replyDM);
  return signedReplyDM.getSignedEventData();
};

describe("NostrBotApp", () => {
  let bot0: NostrBotApp;
  let bot1: NostrBotApp;
  let bot2: NostrBotApp;
  let privateKey0: string;
  let privateKey1: string;
  let privateKey2: string;
  let publicKey1: string;
  let publicKey2: string;
  let testRelayUrl: string;

  beforeAll(async () => {
    testRelayUrl = process.env.TEST_RELAY_URL || "wss://<your_relay_url>";
    privateKey0 = process.env.TEST_NOSTR_PRIVATE_KEY || "<bot_0_key_here>";
    privateKey1 = process.env.BOT_1_KEY || "<bot_1_key_here>";
    privateKey2 = process.env.BOT_2_KEY || "<bot_2_key_here>";
    publicKey1 = getPublicKey(privateKey1);
    publicKey2 = getPublicKey(privateKey2);

    bot0 = new NostrBotApp({
      privateKey: privateKey0,
      relays: [testRelayUrl],
    });
    bot1 = new NostrBotApp({
      privateKey: privateKey1,
      relays: [testRelayUrl],
    });
    bot2 = new NostrBotApp({
      privateKey: privateKey2,
      relays: [testRelayUrl],
    });
    bot2.onDirectMessageEvent(directMessageHandler);
    await Promise.all([
      bot0.waitForConnections(),
      bot1.waitForConnections(),
      bot2.waitForConnections(),
    ]);

    // (In case the relay requires that the bots subscribe to each other to receive DMs.)
    await Promise.all([
      bot1.subscribeToUser(publicKey2),
      bot2.subscribeToUser(publicKey1),
    ]);
  });

  afterAll(async () => {
    await Promise.all([bot0.close(), bot1.close(), bot2.close()]);
  });

  it("should send a message from one bot to another and receive a reply", async () => {
    // Send a message from bot1 to bot2
    const message = "Hello, bot2! Today is " + new Date().toDateString();
    const newEvent = await DirectMessageEventBuilder.createDirectMessageEvent(
      bot1.getPrivateKey(),
      bot2.getPublicKey(),
      message
    );
    const signedEvent = bot1.signEvent(newEvent);
    await bot1.publishSignedEvent(signedEvent.getSignedEventData());

    // Wait for 6 seconds.
    await new Promise((resolve) => setTimeout(resolve, 6000));

    // Check for the reply message
    const reply = bot1.getLastMessage();
    expect(reply).toBeTruthy();
    const dmEvent = await DirectMessageEvent.deconstructEvent(
      reply!,
      bot1.getPrivateKey()
    );
    expect(dmEvent.decryptedMessage).toBe(stringToPrepend + message);
    expect(dmEvent.tags.find((tag) => tag[0] === "e")).toBeTruthy();
  }, 10000);

  /**
   * should recieve a successful 'ok' response after posting an event.
   */
  it("should recieve a successful 'ok' response after posting an event", async () => {
    const newEvent = new EventBuilder({
      pubkey: bot0.getPublicKey(),
      kind: 1,
      content: "Hello world",
      tags: [],
    });
    const signedEvent = bot0.signEvent(newEvent);
    const eventId = signedEvent.getEventId();

    const okResponseMarker = {
      okMessageCount: 0,
      eventId: "",
    };
    bot0.onOkResponse((_relayUrl, eventId, okStatus) => {
      if (okStatus) {
        okResponseMarker.okMessageCount++;
        okResponseMarker.eventId = eventId;
      }
    });
    await bot0.publishSignedEvent(signedEvent.getSignedEventData());
    await new Promise((resolve) => setTimeout(resolve, 6000));

    expect(okResponseMarker.okMessageCount).toBe(1);
    expect(okResponseMarker.eventId).toBe(eventId);
  }, 10000);
});
