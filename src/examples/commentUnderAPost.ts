import dotenv from "dotenv";
import { NostrBotApp, GenericEvent, EventBuilder } from "../index";

dotenv.config();

const testRelayUrl = process.env.TEST_RELAY_URL || "<your relay url>";
const mainBotKey = process.env.TEST_NOSTR_PRIVATE_KEY || "<your main bot key>";
const commenterBotKey = process.env.BOT_1_KEY || "<your bot 1 key>";

const mainBot = new NostrBotApp({
  privateKey: mainBotKey,
  relays: [testRelayUrl],
});

const commenterBot = new NostrBotApp({
  privateKey: commenterBotKey,
  relays: [testRelayUrl],
});

// Make the commenterBot respond to events of kind 1 by posting a comment.
commenterBot.onEvent(
  1,
  async (event: GenericEvent, commenterBotRef: NostrBotApp) => {
    const eventData = event.getEventData();

    // Create a new event that will be a comment to this event.
    const commentEvent = new EventBuilder({
      pubkey: commenterBot.getPublicKey(),
      kind: 1,
      content: "I disagree!",
      // You need to reference the id of the event that you are commenting on.
      tags: [["e", eventData.id]],
    });

    const signedEvent = commenterBotRef.signEvent(commentEvent);

    // When using `onEvent`, you are responsible to prepare the event in a Nostr-compabible
    // message format. (Except you don't need to stringify it here; the bot will do that before publishing.)
    const nostrEventMessage = ["EVENT", signedEvent.getSignedEventData()];

    return nostrEventMessage;
  }
);

// Now prepare an event that the main bot will post.
const eventToPost = new EventBuilder({
  pubkey: mainBot.getPublicKey(),
  kind: 1,
  content: "Hello world! (testing auto-commenting bot)",
});

// Now waits for the bots to be live, and have the commenter subscribe to the main bot.
Promise.all([
  mainBot.waitForConnections(),
  commenterBot.waitForConnections(),
]).then(async () => {
  await commenterBot.subscribeToUser(mainBot.getPublicKey());

  // Now have the main bot sign and post the event.
  const sigenedEvent = mainBot.signEvent(eventToPost);
  await mainBot.publishSignedEvent(sigenedEvent.getSignedEventData());
});
