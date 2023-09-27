import {
  SignedEventData,
  EventFromClient,
  EventFromRelay,
  ClientMessageTypes,
} from "./types";

/**
 * Prepare event payload for publishing.
 */
export function prepareEventPayload(event: SignedEventData): EventFromClient {
  return [ClientMessageTypes.EVENT, event];
}

export function extractEventFromPayload(
  payload: EventFromRelay
): SignedEventData {
  return payload[2];
}
