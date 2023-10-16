/**
 * Raw content for an event, with zero event-specific metadata (such as pubkey or signature).
 */
export type UnauthoredEventData = {
  content: string;
  kind: number;
  tags?: string[][];
};

/**
 * Raw event content plus author's pubkey. Unsigned and no timestamp.
 */
export type EventCreationParams = {
  pubkey: string;
  content: string;
  kind: number;
  tags?: string[][];
};

/**
 * Elements of an event data that are signed.
 */
export type EventPayload = {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
};

/**
 * A nostr event as specified in nip-01.
 */
export type SignedEventData = {
  id: string;
  sig: string;
} & EventPayload;

export enum ClientMessageTypes {
  /**
   * ["EVENT", event JSON as defined above], used to publish events.
   */
  EVENT = "EVENT",
  /**
   * ["REQ", subscription_id, filters JSON...], used to request events and subscribe to new updates.
   */
  REQ = "REQ",
  /**
   * ["CLOSE", subscription_id], used to stop previous subscriptions.
   */
  CLOSE = "CLOSE",
}

export enum RelayResponseTypes {
  /**
   * ["EVENT", subscription_id, event JSON]
   */
  EVENT = "EVENT",
  /**
   * ["OK", event_id, true|false, message]
   */
  OK = "OK",
  /**
   * ["EOSE", subscription_id]: indicates 'end of stored events' (all stored events have been sent over to the recepient).
   */
  EOSE = "EOSE",
  /**
   * ["NOTICE", message]: For human-readable messages.
   */
  NOTICE = "NOTICE",
}

export type OkResponse = [RelayResponseTypes.OK, string, boolean, string];
export type Notice = [RelayResponseTypes.NOTICE, string];
export type EOSE = [RelayResponseTypes.EOSE, string];

export enum EventKinds {
  METADATA = 0,
  TEXT_NOTE = 1,
  ENCRYPTED_MESSAGE = 4,
}

export interface SubscriptionFilters {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  since?: number;
  until?: number;
  limit?: number;
  ["#e"]?: string[];
  ["#p"]?: string[];
}

/**
 * ["EVENT", <signed event data>]
 */
export type EventFromClient = [ClientMessageTypes.EVENT, SignedEventData];

/**
 * ["REQ", <subscription id>, <filters>]
 */
export type SubscriptionRequest = [
  ClientMessageTypes.REQ,
  string,
  SubscriptionFilters
];
/**
 * ["CLOSE", <subscription id>]
 */
export type CloseSubscriptionRequest = [ClientMessageTypes.CLOSE, string];

export type AnyClientMessage =
  | EventFromClient
  | SubscriptionRequest
  | CloseSubscriptionRequest;

/**
 * ["EVENT", <subscription id>, <signed event data>]
 */
export type EventFromRelay = [
  ClientMessageTypes.EVENT,
  string,
  SignedEventData
];
