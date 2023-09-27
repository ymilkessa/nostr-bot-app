import { SubscriptionFilters } from "../events/types";

/**
 * A record of a subscription and which relay it has registered with.
 */
export type SubscriptionRecordValue = {
  relayUrls: Set<string>;
  subscriptionFilters: SubscriptionFilters;
};
