# Nostr Bot Package

A Nostr bot implementation that can also be customized into various app-like use cases.

## Usage

Here is a simple example of a Nostr bot that posts "Hello world" to a relay.

```typescript
import { EventBuilder, NostrBotApp } from "nostr-bot-app";

const nostrApp = new NostrBotApp({
  privateKey: "<your private key here>",
  relays: ["wss://<your relay url here>"],
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
```

## Usage as Nostr-based Apps

We can design Nostr bots to function similar to web apps. Instead of https requests and responses, Nostr bots use Nostr events to interact, such as direct messages.

The most obvious advantage of this paradigm is that a Nostr bot automatically knows and trusts the identity of the entity on the other side.

This essentially eliminates the need for the very complicated user authentication processes that are required for web apps.

#### Drawbacks

At the time or writing this, relays seem to restrict the ways in which bots can receive direct message events for some reason. For instance, many relays require both the sender and recipient to follow each other in order for a bot to recieve message updates. Hence you might need to setup your own dedicated relay in order to receive direct message events to your bot.

#### Code comparison

The event-callback design of this library is inspired by that of web app libraries.

<table>
<tr>
<td>
Web app using express
</td>
<td>
A Nostr bot
</td>
</tr>

<tr>
<td>

```typescript
import express from "express";

//
//
//
//
//

const app = express();

//
//
//

app.get("/", (req, res) => {
  res.send("Hello there! You just made a get request.");
});

//
//
//
//
//
//
//
//
//
//
//
//
//

app.listen(3000, () => {
  console.log("Example app listening on port 3000!");
});
```

</td>
<td>

```typescript
import {
  NostrBotApp,
  DirectMessageEvent,
  DirectMessageEventBuilder,
} from "nostr-bot-app";

// Create a new NostrBotApp instance.
const nostrApp = new NostrBotApp({
  privateKey: "your private key here",
  relays: ["wss://your-relay-url-here"],
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

// Allow the bot to connect to the relays.
nostrApp.waitForConnections();

//
```

</td>
</tr>
</table>

## `onEvent`

The `onEvent` method allows you to write a callback for any specific event kind. This is useful to write special handlers for any custom event kinds that you might have.

Below is an implementation that uses `onEvent` to make a bot that comments under posts by a particular pubkey.

```typescript
import { NostrBotApp, GenericEvent, EventBuilder } from "nostr-bot-app";

const commenterBot = new NostrBotApp({
  privateKey: "<commenter_bot_key>",
  relays: ["<your_relay_url>"],
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

// Wait for the bot to go online, then subscribe to the pubkey that you want it to comment under.
commenterBot.waitForConnections().then(async () => {
  await commenterBot.subscribeToUser("<pub key to subscribe to>");
});
```
