# Nostr Bot Package

A Nostr bot implementation that can also be customized into various app-like use cases.

### Table of contents

- [Usage](#usage)
- [Usage as Nostr-based Apps](#usage-as-nostr-based-apps)
- [Callback setters](#callback-setters)
  - [1. `onEvent`](#1-onevent)
    - [`onDirectMessageEvent`](#ondirectmessageevent)
    - [`onMetadataEvent`](#onmetadataevent)
    - [`onTextNoteEvent`](#ontextnoteevent)
  - [2. `onOkResponse`](#2-onokresponse)

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
signedEvent = nostrApp.signEvent(newEvent);

// Allow the bot to connect to its relays. Then publish the event.
nostrApp.waitForConnections().then(() => {
  nostrApp.publishSignedEvent(signedEvent.getSignedEventData());
});
```

## Usage as Nostr-based Apps

We can design Nostr bots to function similar to web apps. Instead of https requests and responses, Nostr bots use Nostr events to interact, such as direct messages.

The most obvious advantage of this paradigm is that a Nostr bot automatically knows and trusts the identity of the entity on the other side.

This essentially eliminates the need for the very complicated user authentication processes that are required for web apps.

#### Drawbacks

At the time or writing this, relays seem to restrict the ways in which bots can receive direct message events for some reason. For instance, many relays require both the sender and recipient to follow each other in order for a bot to recieve message updates. Hence you might need to setup your own dedicated relay in order to receive direct message events to your bot.

#### Code comparison

The event-callback design of this library is inspired by that of web app libraries. Here is a side by side comparison of a web app and a Nostr bot that function analogously.

<table style="font-size: 0.8rem">
<tr>
<th>
Web app using express
</th>
<th>
A Nostr bot
</th>
</tr>

<tr>
<td>

```typescript
import express from "express";

//
//
//

const app = express();

//
//

app.get("/", (req, res) => {
  res.send("Hello there!");
});

//
//
//
//
//
//
//
//

app.listen(3000, () => {
  console.log("Listening.");
});
```

</td>
<td>

```typescript
import {
  NostrBotApp,
  DirectMessageEvent,
  DirectMessageEventBuilder as DMB,
} from "nostr-bot-app";

const nostrApp = new NostrBotApp({
  privateKey: "your private key here",
  relays: ["wss://your-relay-url-here"],
});

nostrApp.onDirectMessageEvent(async function (
  dmObject: DirectMessageEvent,
  botRef: NostrBotApp
) {
  const replyDM = await DMB.createDirectMessageEvent(
    botRef.getPrivateKey(),
    dmObject.pubkey,
    "Hello there!"
  );
  const signedReplyDM = botRef.signEvent(replyDM);
  return signedReplyDM.getSignedEventData();
});

nostrApp.waitForConnections();

//
```

</td>
</tr>
</table>

# Callback setters

You can write a custom callback for any message type received from a relay. These message types are described in [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md#from-relay-to-client-sending-events-and-notices).

## 1. `onEvent`

The `onEvent` method allows you to write a callback for any specific event kind. This is useful to write special handlers for any custom event kinds that you might have.

Below is an implementation that uses `onEvent` to make a bot that comments under posts.

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

This package also provides 3 special callback setters that include a special wrappers for each event kind.

### `onDirectMessageEvent`

As the name suggests, this is a specialized callback setter for direct messages (event kind 4). With this setter, your callback can access the decrypted version of the message inside the event parameter. Just use the `.decryptedMessage` property on the first argument as shown in the [example](./src/examples/respondToDM.ts).

In short, it just does the decryption step for you.

### `onMetadataEvent`

This is for event kind 0: author metadata event. This callback setter simply parses the metadata for you, and makes it available in an `.authorMetaData` property.

### `onTextNoteEvent`

Using this callback is identical with using `onEvent` with the event kind of 1.

## 2. `onOkResponse`

The okResponse is a message sent by relays (not other users) to confirm that your event has been received and processed. This callback setter allows you to write a custom callback for this message. See the [example](./src/examples/handleOkResponse.ts) for usage details.
