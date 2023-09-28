import { EventBuilder, NostrBotApp } from "../../dist";

const nostrApp = new NostrBotApp({
  privateKey: "<bot_private_key>",
  relays: ["<my_relay_urls..."],
});

const newEvent = new EventBuilder({
  pubkey: nostrApp.getPublicKey(),
  content: "Hello world!",
  kind: 1,
});

// Sign the event.
nostrApp.signEvent(newEvent);

// Allow the bot to connect to its relays. Then publish the event.
nostrApp.waitForConnections().then(() => {
  nostrApp.publishSignedEvent(newEvent.getSignedEventData());
});
