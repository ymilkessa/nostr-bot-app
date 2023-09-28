import {
  NostrBotApp,
  DirectMessageEvent,
  DirectMessageEventBuilder,
  EventBuilder,
} from "../index";

// Create a new NostrBotApp instance.
const nostrApp = new NostrBotApp({
  privateKey:
    "77392281e998a0fdc1959082192004c9be9a66dddce785d30e69853c512738a9",

  relays: [
    "wss://relay.primal.net",
    "wss://soloco.nl",
    "wss://relay.snort.social",
    "wss://relay.current.fyi",
    "wss://relay.damus.io",
    "wss://nostr.fmt.wiz.biz",
    "wss://eden.nostr.land",
    "wss://nostr-pub.wellorder.net",
    "wss://offchain.pub",
    "wss://nos.lol",
  ],
});

// Add the direct message handler to the bot.
nostrApp.onDirectMessageEvent(
  async (dmObject: DirectMessageEvent, botRef: NostrBotApp) => {
    // Use the Event builder to create a new direct message event. This handles
    // the encryption for you.
    const replyDM = await DirectMessageEventBuilder.createDirectMessageEvent(
      botRef.getPrivateKey(),
      dmObject.pubkey,
      "Hello there! You just sent me a message."
    );

    // Use the signEvent method to sign the event with the bot's private key.
    const signedReplyDM = botRef.signEvent(replyDM);

    // Simply return the signed event data. The bot will automatically post it.
    return signedReplyDM.getSignedEventData();
  }
);

// First make a post to announce your presence.
const newEvent = new EventBuilder({
  pubkey: nostrApp.getPublicKey(),
  content: "Hello world!",
  kind: 1,
});

// Sign the event.
nostrApp.signEvent(newEvent);

// Allow the bot to connect to the relays.
nostrApp.waitForConnections().then(() => {
  nostrApp.publishSignedEvent(newEvent.getSignedEventData());
});
