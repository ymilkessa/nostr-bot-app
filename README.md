# Nostr Bot Package

This will implement a nostr bot that can be customized into various apps by the use
of event handlers.

### Installation

```bash
npm install nostr-bot-app
```

### Web apps vs Nostr bots

We can design Nostr bots to function similar to web apps. Instead of https requests and responses, Nostr bots receive and send information using Nostr events.

The most obvious advantage of this paradigm is that a Nostr bot automatically knows and trusts the identity of the entity on the other side.

This essentially eliminates the need for the very complicated user authentication processes that are required for web apps.

### Code comparison

The design of this library is inspired by that of web app libraries.

The example below shows an express app that just returns "Hello" on the left, and a Nostr-bot that responds to a direct message with a "Hello" on the right.

<table>
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
```
