import { verifySignature, getPublicKey } from "nostr-tools";
import { v4 } from "uuid";
import { WebSocket } from "ws";

import { NostrBotParams } from "./types";
import EventBuilder from "../events/builders/eventBuilder";
import {
  AnyClientMessage,
  EventFromRelay,
  EventKinds,
  ClientMessageTypes,
  SignedEventData,
  SubscriptionFilters,
  SubscriptionRequest,
  EventPayload,
  RelayResponseTypes,
  OkResponse,
} from "../events/types";
import {
  extractEventFromPayload,
  prepareEventPayload,
} from "../events/nostrDataHandlers";
import DirectMessageEvent from "../events/kinds/directMessageEvent";
import GenericEvent from "../events/kinds/genericEvent";
import MetadataEvent from "../events/kinds/metadataEvent";
import TextNoteEvent from "../events/kinds/textNoteEvent";
import { SubscriptionRecordValue } from "./localTypes";

export type EventHandlerFunction<T extends GenericEvent> = (
  eventObject: T,
  botRef: NostrBotApp,
  ..._otherArgs: any[]
) => any;

export type OkResponseHandlerFunction = (
  okResponse: OkResponse,
  relayUrl: string
) => any;

/**
 * A specialized handler function for direct messages.
 * @param eventObject instance of DirectMessageEvent.
 */
export type DirectMessageHandlerFunction =
  EventHandlerFunction<DirectMessageEvent>;

/**
 * A specialized handler function for metadata events.
 * @param eventObject instance of MetadataEvent.
 */
export type MetadataEventHandlerFunction = EventHandlerFunction<MetadataEvent>;

/**
 * A specialized handler function for text note events.
 * @param eventObject instance of TextNoteEvent.
 */
export type TextNoteEventHandlerFunction = EventHandlerFunction<GenericEvent>;

export class NostrBotApp {
  private privateKey: string;
  private publicKey: string;
  private relayUrls: string[];
  private recentMessages: SignedEventData[] = [];
  private creationTime: number;
  private hanldeOldEvents: boolean;
  webSocketConnections: Map<string, WebSocket> = new Map();

  /**
   * Maps a given event kind to a function that has been assigned to handle it.
   */
  allEventHandlers: Map<number, EventHandlerFunction<any>> = new Map();

  /**
   * A map from user pubkeys to the subscriptions id that this bot has
   * for that user.
   */
  private subscriptions: Map<string, SubscriptionRecordValue> = new Map();
  /**
   * Requests for subscriptions that have been sent but not yet confirmed.
   */
  private subscriptionRequests: Map<string, SubscriptionFilters> = new Map();

  constructor({ privateKey, relays, hanldeOldEvents }: NostrBotParams) {
    this.privateKey = privateKey;
    this.publicKey = getPublicKey(privateKey);
    this.creationTime = Math.floor(Date.now() / 1000);
    this.hanldeOldEvents = hanldeOldEvents || false;
    console.log(`Bot initiated with the public key ${this.publicKey}`);

    if (typeof relays === "string") {
      relays = [relays];
    }
    this.relayUrls = relays;
    if (relays.length > 1) {
      console.log(
        `It is highly recommended that you only use one relay. 
        Otherwise, you might need to take care of duplicate events on your own.`
      );
    }

    // Setup the default event handle wrappers.
    this.allEventHandlers.set(
      EventKinds.METADATA,
      this.defaultMetadataHandler.bind(this)
    );
    this.allEventHandlers.set(
      EventKinds.ENCRYPTED_MESSAGE,
      this.defaultDirectMessageHandler.bind(this)
    );

    this.allEventHandlers.set(
      EventKinds.TEXT_NOTE,
      this.defaultTextNoteHandler.bind(this)
    );

    for (const relayUrl of relays) {
      const ws = new WebSocket(relayUrl);
      ws.on("open", () => {
        console.log("Connection started with " + relayUrl);

        ws.on(
          "message",
          async (event: MessageEvent) =>
            await this.handleRecievedEvent.bind(this)(event, relayUrl)
        );

        ws.on("close", () => {});

        /**
         * Post a dummy event every 10 minutes to keep the connection alive.
         */
        setInterval(async () => {
          const dummyEvent = new EventBuilder({
            pubkey: this.publicKey,
            content: "ping",
            kind: EventKinds.TEXT_NOTE,
          });
          const signedDummyEvent = this.signEvent(dummyEvent);
          await this.publishSignedEvent(signedDummyEvent.getSignedEventData(), [
            relayUrl,
          ]);
        }, 600000);
      });

      ws.on("error", (err) => {
        console.log("Error occured with " + relayUrl);
        console.log(err);
      });

      this.webSocketConnections.set(relayUrl, ws);
    }
  }

  /**
   * Wait until all connections are established (either open or failed).
   */
  async waitForConnections() {
    const promises = Array.from(this.webSocketConnections.values()).map(
      (ws) =>
        new Promise((resolve) => {
          ws.on("open", () => {
            resolve(0);
          });
          ws.on("error", () => {
            resolve(1);
          });
        })
    );
    await Promise.all(promises);
  }

  /**
   * Close all websocket connections and shut down the bot.
   */
  async close() {
    await Promise.all(
      Array.from(this.webSocketConnections.keys()).map((relayUrl) =>
        this.closeWebsocket(relayUrl)
      )
    );
  }

  async closeWebsocket(relayUrl: string) {
    const ws = this.webSocketConnections.get(relayUrl);
    if (!ws) {
      throw new Error("No connection exists for " + relayUrl);
    }
    try {
      console.log("Closing connection with " + relayUrl);
      await ws.close();
    } catch (error) {
      console.error(
        `Error closing WebSocket connection with ${relayUrl}: `,
        error
      );
    }
  }

  private async sendDataToRelays(
    message: AnyClientMessage,
    relays: string[] = this.relayUrls
  ) {
    const promises = relays.map(async (relayUrl) => {
      const ws = this.webSocketConnections.get(relayUrl);
      if (!ws) {
        throw new Error("No connection exists for " + relayUrl);
      }
      if (ws?.readyState === WebSocket.OPEN) {
        await ws?.send(JSON.stringify(message, null, 2));
        return;
      }
    });
    await Promise.all(promises);
  }

  async publishSignedEvent(
    event: SignedEventData,
    relays: string[] = this.relayUrls
  ) {
    if (this.eventConfirmed(event)) {
      const message = prepareEventPayload(event);
      await this.sendDataToRelays(message, relays);
    }
  }

  signEvent(event: EventBuilder): EventBuilder {
    if (this.eventIsSelfAuthored(event.getEventPayload())) {
      event.singEvent(this.privateKey);
      // The signature should already be set in the mutable event instance.
      // Just return the event to keep elegance.
      return event;
    }

    throw new Error("Event is not authored by this bot.");
  }

  /**
   * Returns true if the event has been signed by this bot.
   */
  eventConfirmed(event: SignedEventData) {
    if (!this.eventIsSelfAuthored(event)) {
      return false;
    }

    // Cloning the event because verifySignature would mutates the original.
    return verifySignature({ ...event });
  }

  /**
   * Returns true if the public key of the given event matches the public key of this bot.
   */
  eventIsSelfAuthored(event: EventPayload) {
    return event.pubkey === this.publicKey;
  }

  async makeSubscriptionRequest(filters: SubscriptionFilters) {
    // await this.waitForConnections();
    const id = v4();
    /**
     * TODO: Make sure you receive the OK response before saving the subscription.
     */
    this.subscriptionRequests.set(id, filters);
    const message = [
      ClientMessageTypes.REQ,
      id,
      filters,
    ] as SubscriptionRequest;
    await this.sendDataToRelays(message);
  }

  async subscribeToUser(id: string) {
    return await this.makeSubscriptionRequest({ authors: [id] });
  }

  /**
   * Invoke the handler that has been assigned for this event kind, if it exists.
   */
  async handleRecievedEvent(eventString: any, relayUrl: string) {
    const data = JSON.parse(eventString);
    switch (data[0]) {
      case RelayResponseTypes.EVENT:
        const eventData = extractEventFromPayload(data as EventFromRelay);
        if (!this.hanldeOldEvents && eventData.created_at < this.creationTime) {
          break;
        }

        this.recentMessages.push(eventData);
        const genericEvent = await GenericEvent.deconstructEvent(eventData);
        const handler = this.allEventHandlers.get(eventData.kind);
        if (handler) {
          const response = await handler(genericEvent, this);
          if (response) {
            this.sendDataToRelays(response, [relayUrl]);
          }
        }
        break;
      case RelayResponseTypes.OK:
        await this.okResponseHandler(data as OkResponse, relayUrl);
        break;
      case RelayResponseTypes.EOSE:
        const subscriptionId = data[1];
        // If this subscription already exists, then just add this relay url to the list.
        const existingSubscription = this.subscriptions.get(subscriptionId);
        if (existingSubscription) {
          existingSubscription.relayUrls.add(relayUrl);
        } else {
          // If it doesn't exist, then create a new entry.
          this.subscriptions.set(subscriptionId, {
            subscriptionFilters: this.subscriptionRequests.get(subscriptionId)!,
            relayUrls: new Set([relayUrl]),
          });
        }
        break;
      case RelayResponseTypes.NOTICE:
        console.log(`${relayUrl} says: '${data[1]}'`);
      default:
        console.log(
          `This is an unregistered message type\n${JSON.stringify(
            data,
            null,
            2
          )}`
        );
        break;
    }
  }

  /**
   * Set the handler to be used for a specific event kind.
   * Caution: this will override any custom pre-processing that the bot does for
   * certain event kinds (e.g. decrypting direct messages).
   */
  onEvent(eventKind: EventKinds, handler: EventHandlerFunction<GenericEvent>) {
    this.allEventHandlers.set(eventKind, handler);
  }

  onDirectMessageEvent(handler: DirectMessageHandlerFunction) {
    this.handleDirectMessageFunction = handler;
  }
  onMetadataEvent(handler: MetadataEventHandlerFunction) {
    this.handleMetadataFunction = handler;
  }
  onTextNoteEvent(handler: TextNoteEventHandlerFunction) {
    this.handleTextNoteFunction = handler;
  }

  onOkResponse(handler: OkResponseHandlerFunction) {
    this.okResponseHandler = handler;
  }

  private handleDirectMessageFunction: DirectMessageHandlerFunction = () => {};
  private handleMetadataFunction: MetadataEventHandlerFunction = () => {};
  private handleTextNoteFunction: TextNoteEventHandlerFunction = () => {};
  /**
   * Default response to an ok message: just log the status to the console.
   */
  private okResponseHandler: OkResponseHandlerFunction = (
    data: OkResponse,
    relayUrl: string
  ) => {
    if (data[2]) {
      console.log(`${relayUrl} has accepted your event with id ${data[1]}.`);
    } else {
      console.log(
        `${relayUrl} has rejected your event with id ${data[1]} for the following reason:\n` +
          data[3]
      );
    }
  };

  private async defaultDirectMessageHandler(genericEvent: GenericEvent) {
    const directMessageEvent = await DirectMessageEvent.deconstructEvent(
      genericEvent.getEventData(),
      this.privateKey
    );
    const responseEvent: SignedEventData =
      await this.handleDirectMessageFunction(directMessageEvent, this);
    return responseEvent && prepareEventPayload(responseEvent);
  }

  private async defaultMetadataHandler(genericEvent: GenericEvent) {
    const metadataEvent = await MetadataEvent.deconstructEvent(
      genericEvent.getEventData()
    );
    const responseEvent = await this.handleMetadataFunction(
      metadataEvent,
      this
    );
    return responseEvent && prepareEventPayload(responseEvent);
  }

  private async defaultTextNoteHandler(genericEvent: GenericEvent) {
    const textNoteEvent = await TextNoteEvent.deconstructEvent(
      genericEvent.getEventData()
    );
    const responseEvent = await this.handleTextNoteFunction(
      textNoteEvent,
      this
    );
    return responseEvent && prepareEventPayload(responseEvent);
  }

  /**
   * Get last message. Return null if there is no message.
   */
  getLastMessage(): SignedEventData | null {
    if (this.recentMessages.length === 0) {
      return null;
    }

    return this.recentMessages[this.recentMessages.length - 1];
  }

  getPrivateKey() {
    return this.privateKey;
  }

  getPublicKey() {
    return this.publicKey;
  }
}
