import { NostrBotApp } from "../../src/bot/nostrBot";
import DirectMessageEventBuilder from "../../src/events/builders/directMessageEventBuilder";
import { getPublicKey } from "nostr-tools";
import DirectMessageEvent from "../../src/events/kinds/directMessageEvent";
import dotevn from "dotenv";

dotevn.config();

const stringToPrepend = "This is my reply to your text: \n";
const directMessageHandler = async (
  dmObject: DirectMessageEvent,
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
  let bot1: NostrBotApp;
  let bot2: NostrBotApp;
  let privateKey1: string;
  let privateKey2: string;
  let publicKey1: string;
  let publicKey2: string;
  let testRelayUrl: string;

  beforeAll(async () => {
    testRelayUrl = process.env.TEST_RELAY_URL || "wss://<your_relay_url>";
    privateKey1 = process.env.BOT_1_KEY || "<bot_1_key_here>";
    privateKey2 = process.env.BOT_2_KEY || "<bot_2_key_here>";
    publicKey1 = getPublicKey(privateKey1);
    publicKey2 = getPublicKey(privateKey2);

    // Create two bots that both use the same relay url
    bot1 = new NostrBotApp({
      privateKey: privateKey1,
      relays: [testRelayUrl],
    });
    bot2 = new NostrBotApp({
      privateKey: privateKey2,
      relays: [testRelayUrl],
    });
    bot2.onDirectMessageEvent(directMessageHandler);
    await Promise.all([bot1.waitForConnections(), bot2.waitForConnections()]);

    // (In case the relay requires that the bots subscribe to each other to receive DMs.)
    await Promise.all([
      bot1.subscribeToUser(publicKey2),
      bot2.subscribeToUser(publicKey1),
    ]);
  });

  afterAll(async () => {
    await Promise.all([bot1.close(), bot2.close()]);
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
});
