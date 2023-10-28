import { WebSocket } from "ws";
import DirectMessageEvent from "../events/kinds/directMessageEvent";
import GenericEvent from "../events/kinds/genericEvent";
import MetadataEvent from "../events/kinds/metadataEvent";
import { SubscriptionFilters } from "../events/types";

/**
 * Params needed to create a nostr bot.
 */
export interface NostrBotParams {
  /**
   * The hexadecimal string version of a private key.
   */
  privateKey: string;

  /**
   * Relays urls to connect to.
   */
  relays: string[] | string;

  /**
   * Respond to events that were sent before the creation of the bot.
   */
  hanldeOldEvents?: boolean;

  /**
   * If true, the bot will start initiating websocket connections with its relays
   * as soon as it is created.
   */
  connectWithRelays?: boolean;
}
