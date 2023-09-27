# Nostr Bot Package

This will implement a nostr bot that can be customized into various apps by the use
of event handlers.

## Similar to Web Apps

<div style="display: flex; flex-direction: row;">
```typescript
import express from 'express';

const app = express();

app.get('/', (req, res) => {
res.send('Hello there! You just made a get request.');
});

app.listen(3000, () => {
console.log('Example app listening on port 3000!');
});

````


```typescript
import {NostrBotApp, DirectMessageEvent, DirectMessageEventBuilder} from 'nostr-bot-app';

const directMessageHandler = async (
  dmObject: DirectMessageEvent,
  botRef: NostrBotApp
) => {
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
  };

// Create a new NostrBotApp instance.
const nostrApp = new NostrBotApp({
    privateKey: "your private key here",
    relays: ["wss://your-relay-url-here"],
});

// Add the direct message handler to the bot.
nostrApp.onDirectMessageEvent(directMessageHandler);

// Allow the bot to connect to the relays.
nostrApp.waitForConnections()
````

</div>
