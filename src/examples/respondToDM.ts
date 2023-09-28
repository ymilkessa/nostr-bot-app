import {
  NostrBotApp,
  DirectMessageEvent,
  DirectMessageEventBuilder,
} from "../index";

import dotevn from "dotenv";
dotevn.config();

const nostrPrivKey = process.env.TEST_NOSTR_PRIVATE_KEY;
const secondBotKey = process.env.BOT_1_KEY;
const testRelayUrl = process.env.TEST_RELAY_URL;

// Create a new NostrBotApp instance
const nostrBotApp = new NostrBotApp({
  privateKey: nostrPrivKey || "<your_private_key>",
  relays: [testRelayUrl || "wss://<your_relay_url>"],
});

// Make another bot to chat with the first bot.
const otherBot = new NostrBotApp({
  privateKey: secondBotKey || "<your_private_key>",
  relays: [testRelayUrl || "wss://<your_relay_url>"],
});

// Add the direct message handler to the main bot.
nostrBotApp.onDirectMessageEvent(
  async (dmObject: DirectMessageEvent, botRef: NostrBotApp) => {
    // Use the Direct Message Event Builder to create a new direct message event. This handles
    // the encryption for you.
    const replyDM = await DirectMessageEventBuilder.createDirectMessageEvent(
      botRef.getPrivateKey(),
      dmObject.pubkey,
      "Hello there! You just sent me a message." +
        "Your decrypted message is: " +
        dmObject.decryptedMessage
    );

    // Use the signEvent method to sign the event with the bot's private key.
    const signedReplyDM = botRef.signEvent(replyDM);

    // Simply return the signed event data. The bot will automatically post it.
    return signedReplyDM.getSignedEventData();
  }
);

// Make your test bot simply print out the response it gets from nostrBotApp.
otherBot.onDirectMessageEvent(
  async (dmObject: DirectMessageEvent, _botRef: NostrBotApp) => {
    console.log(
      "Got this response from nostrBotApp: \n",
      dmObject.decryptedMessage
    );
  }
);

// Allow the bots to connect to the relays.
Promise.all([
  nostrBotApp.waitForConnections(),
  otherBot.waitForConnections(),
]).then(async () => {
  // Subscribe the two bots to each other.
  await nostrBotApp.subscribeToUser(otherBot.getPublicKey());
  await otherBot.subscribeToUser(nostrBotApp.getPublicKey());

  // Then have the other bot send a message to your nostr bot app.
  const newDMEvent = await DirectMessageEventBuilder.createDirectMessageEvent(
    otherBot.getPrivateKey(),
    nostrBotApp.getPublicKey(),
    "Hello from Bot 1!"
  );

  otherBot.signEvent(newDMEvent);
  await otherBot.publishSignedEvent(newDMEvent.getSignedEventData());
});
