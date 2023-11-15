import { verifySignature, getPublicKey } from "nostr-tools";
import { v4 } from "uuid";
import { WebSocket } from "ws";

import { NostrBotParams } from "./types";
import EventBuilder from "../events/builders/eventBuilder";
import {
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
  subscriptionId: string,
  botRef: NostrBotApp,
  ..._otherArgs: any[]
) => any;

export type OkResponseHandlerFunction = (
  relayUrl: string,
  eventId: string,
  okStatus: boolean,
  message?: string
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
  private connectWithRelays: boolean;
  protected webSocketConnections: Map<string, WebSocket> = new Map();

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

  constructor({
    privateKey,
    relays,
    hanldeOldEvents,
    connectWithRelays,
  }: NostrBotParams) {
    this.connectWithRelays = connectWithRelays ?? true;
    if (this.connectWithRelays && (!relays || relays.length === 0)) {
      throw new Error(
        "You must provide at least one relay url if you want the bot to be connected. Otherwise, set connectWithRelays to false."
      );
    }

    this.privateKey = privateKey;
    this.publicKey = getPublicKey(privateKey);
    this.creationTime = Math.floor(Date.now() / 1000);
    this.hanldeOldEvents = hanldeOldEvents || false;
    console.log(`Bot created with the public key ${this.publicKey}`);

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

    if (this.connectWithRelays) {
      this.init();
    }
  }

  /**
   * Initiate connections with the relays and setup the core callbacks.
   */
  private async init() {
    for (const relayUrl of this.relayUrls) {
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
         * Post a dummy message every 10 minutes to keep the connection alive.
         */
        setInterval(async () => {
          await this.sendDataToRelays("ping");
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
    if (!this.connectWithRelays) {
      throw new Error(
        "You must enable connections with relays to use this function."
      );
    }
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
    message: string,
    relays: string[] = this.relayUrls
  ) {
    if (!this.connectWithRelays) {
      throw new Error(
        "You must enable connections with relays to use this function."
      );
    }
    const promises = relays.map(async (relayUrl) => {
      const ws = this.webSocketConnections.get(relayUrl);
      if (!ws) {
        throw new Error("No connection exists for " + relayUrl);
      }
      if (ws?.readyState === WebSocket.OPEN) {
        await ws?.send(message);
        return;
      }
    });
    await Promise.all(promises);
  }

  async publishSignedEvent(
    event: SignedEventData,
    relays: string[] = this.relayUrls
  ) {
    if (event.pubkey === this.publicKey && verifySignature(event)) {
      const message = prepareEventPayload(event);
      await this.sendDataToRelays(JSON.stringify(message, null, 2), relays);
    }
  }

  signEvent(event: EventBuilder): EventBuilder {
    if (event.getAuthorPublicKey() === this.publicKey) {
      event.signEvent(this.privateKey);
      // The signature should already be set in the mutable event instance.
      // Just return the event to keep elegance.
      return event;
    }

    throw new Error("Event is not authored by this bot.");
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
    await this.sendDataToRelays(JSON.stringify(message, null, 2));
  }

  async subscribeToUser(id: string) {
    return await this.makeSubscriptionRequest({ authors: [id] });
  }

  /**
   * Invoke the handler that has been assigned for this event kind, if it exists.
   */
  protected async handleRecievedEvent(eventString: any, relayUrl: string) {
    const data = JSON.parse(eventString);
    switch (data[0]) {
      case RelayResponseTypes.EVENT:
        const eventMessage = data as EventFromRelay;
        const eventData = extractEventFromPayload(eventMessage);
        if (!this.hanldeOldEvents && eventData.created_at < this.creationTime) {
          break;
        }

        const genericEvent = await GenericEvent.deconstructEvent(eventData);
        const handler = this.allEventHandlers.get(eventData.kind);
        if (handler) {
          const response = await handler(genericEvent, eventMessage[1], this);
          if (response) {
            this.sendDataToRelays(JSON.stringify(response, null, 2), [
              relayUrl,
            ]);
          }
        }
        this.recentMessages.push(eventData);
        break;
      case RelayResponseTypes.OK:
        await this.okResponseHandler(relayUrl, data[1], data[2], data[3] ?? "");
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
    if (!this.connectWithRelays) {
      throw new Error(
        "You must enable connections with relays to use this function."
      );
    }
    this.allEventHandlers.set(eventKind, handler);
  }

  onDirectMessageEvent(handler: DirectMessageHandlerFunction) {
    if (!this.connectWithRelays) {
      throw new Error(
        "You must enable connections with relays to use this function."
      );
    }
    this.handleDirectMessageFunction = handler;
  }
  onMetadataEvent(handler: MetadataEventHandlerFunction) {
    if (!this.connectWithRelays) {
      throw new Error(
        "You must enable connections with relays to use this function."
      );
    }
    this.handleMetadataFunction = handler;
  }
  onTextNoteEvent(handler: TextNoteEventHandlerFunction) {
    if (!this.connectWithRelays) {
      throw new Error(
        "You must enable connections with relays to use this function."
      );
    }
    this.handleTextNoteFunction = handler;
  }

  onOkResponse(handler: OkResponseHandlerFunction) {
    if (!this.connectWithRelays) {
      throw new Error(
        "You must enable connections with relays to use this function."
      );
    }
    this.okResponseHandler = handler;
  }

  private handleDirectMessageFunction: DirectMessageHandlerFunction = () => {};
  private handleMetadataFunction: MetadataEventHandlerFunction = () => {};
  private handleTextNoteFunction: TextNoteEventHandlerFunction = () => {};
  /**
   * Default response to an ok message: just log the status to the console.
   */
  private okResponseHandler: OkResponseHandlerFunction = (
    relayUrl,
    eventId: string,
    okStatus: boolean,
    message?: string
  ) => {
    if (okStatus) {
      console.log(`${relayUrl} has accepted your event with id ${eventId}.`);
    } else {
      console.log(
        `${relayUrl} has rejected your event with id ${eventId}.\n` +
          `Reason: ${message || "None provided."}`
      );
    }
  };

  private async defaultDirectMessageHandler(
    genericEvent: GenericEvent,
    subId: string
  ) {
    const directMessageEvent = await DirectMessageEvent.deconstructEvent(
      genericEvent.getEventData(),
      this.privateKey
    );
    const responseEvent: SignedEventData =
      await this.handleDirectMessageFunction(directMessageEvent, subId, this);
    return responseEvent && prepareEventPayload(responseEvent);
  }

  private async defaultMetadataHandler(
    genericEvent: GenericEvent,
    subId: string
  ) {
    const metadataEvent = await MetadataEvent.deconstructEvent(
      genericEvent.getEventData()
    );
    const responseEvent = await this.handleMetadataFunction(
      metadataEvent,
      subId,
      this
    );
    return responseEvent && prepareEventPayload(responseEvent);
  }

  private async defaultTextNoteHandler(
    genericEvent: GenericEvent,
    subId: string
  ) {
    const textNoteEvent = await TextNoteEvent.deconstructEvent(
      genericEvent.getEventData()
    );
    const responseEvent = await this.handleTextNoteFunction(
      textNoteEvent,
      subId,
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
