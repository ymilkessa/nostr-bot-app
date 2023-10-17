/**
 * Write a program for a bot where
 */
import { EventBuilder, NostrBotApp } from "../index";

const nostrApp = new NostrBotApp({
  privateKey: "<bot_private_key>",
  relays: ["<my_relay_urls..."],
});

// Print 'event accepted' when the event is accepted by the relay.
nostrApp.onOkResponse((relayUrl, eventId, okStatus, message) => {
  if (okStatus) {
    console.log(`Event ${eventId} accepted by ${relayUrl}.`);
  } else {
    console.log(
      `Event ${eventId} rejected by ${relayUrl} for the following reason: ${message}`
    );
  }
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
