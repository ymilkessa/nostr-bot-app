import { verifySignature, getPublicKey, generatePrivateKey } from "nostr-tools";

import EventBuilder from "../../../src/events/builders/eventBuilder";
import { EventCreationParams, EventKinds } from "../../../src/events/types";

describe("EventBuilder", () => {
  let privateKey: string = "";
  let pubkey: string = "";

  beforeAll(() => {
    privateKey = generatePrivateKey();
    pubkey = getPublicKey(privateKey);
  });

  beforeEach(() => {});

  it("Event created with one public key can only be signed by its corresponding private key", () => {
    const otherPrivateKey = generatePrivateKey();
    const eventParams = {
      pubkey,
      kind: EventKinds.TEXT_NOTE,
      content: "This is to test signing.",
    };
    const newEvent = new EventBuilder(eventParams);

    // Signing this using the other private key should throw an error.
    expect(() => newEvent.signEvent(otherPrivateKey)).toThrow(Error);

    // Signing this using the correct private key should not throw an error.
    expect(() => newEvent.signEvent(privateKey)).not.toThrow(Error);
  });

  it("An event that has been serialized cannot be modified.", () => {
    const eventParams1 = {
      pubkey,
      kind: EventKinds.TEXT_NOTE,
      content: "This is to test immutability of signed events.",
    };
    const eventParams2 = {
      pubkey,
      kind: EventKinds.TEXT_NOTE,
      content: "This is to test immutability of serialized events.",
    };
    const eventToSign = new EventBuilder(eventParams1);
    const eventToSerialize = new EventBuilder(eventParams2);

    eventToSign.signEvent(privateKey);
    eventToSerialize.serialize();

    expect(() => eventToSerialize.addTag(["test"])).toThrow(Error);
    expect(() => eventToSign.addTag(["test"])).toThrow(Error);
    expect(() => eventToSerialize.setEventKind(1)).toThrow(Error);
    expect(() => eventToSign.setEventKind(1)).toThrow(Error);
  });

  it("Signing an event should also make it fixed.", () => {
    const eventParams = {
      pubkey,
      kind: EventKinds.TEXT_NOTE,
      content: "This is to test the isEventFixed method post signing.",
    };
    const event = new EventBuilder(eventParams);
    event.signEvent(privateKey);
    expect(event.isEventFixed()).toBe(true);
    expect(event.isEventSigned()).toBe(true);
    expect(event.getEventId()).not.toBeNull();
  });

  it("Serializing an event should make it fixed, but it should not be signed.", () => {
    const eventParams = {
      pubkey,
      kind: EventKinds.TEXT_NOTE,
      content: "This is to test the isEventFixed method post serialization.",
    };
    const event = new EventBuilder(eventParams);
    event.serialize();
    expect(event.isEventFixed()).toBe(true);
    expect(event.isEventSigned()).toBe(false);
    expect(event.getEventId()).not.toBeNull();
  });

  it("Creating a new instance of the EventBuilder should create a new event with the correct default properties.", () => {
    const precedingTimestamp = Math.floor(Date.now() / 1000);
    const contentString = "Test default properties of a new event.";
    const eventParams = {
      pubkey,
      kind: EventKinds.TEXT_NOTE,
      content: contentString,
    };
    const event = new EventBuilder(eventParams);

    expect(event.getAuthorPublicKey()).toBe(pubkey);

    const eventData = event.getEventPayload();
    expect(eventData.pubkey).toBe(pubkey);
    expect(eventData.created_at).toBeLessThanOrEqual(precedingTimestamp + 1);
    expect(eventData.created_at).toBeGreaterThanOrEqual(precedingTimestamp);
    expect(eventData.kind).toBe(eventParams.kind);
    expect(eventData.tags.length).toBe(0);
    expect(eventData.content).toBe(contentString);

    expect(event.isEventFixed()).toBe(false);
    expect(event.isEventSigned()).toBe(false);
  });

  it("The fields of an unfixed event should be capable of being modified.", () => {
    const initialContent = "Does the content modify?";
    const newContent = "Yes, the content does modify.";
    const eventParams = {
      pubkey,
      kind: EventKinds.TEXT_NOTE,
      content: initialContent,
    };
    const event = new EventBuilder(eventParams);
    expect(event.getEventPayload().content).toBe(initialContent);
    const testTag = ["testTag", "testTagValue2"];
    const testKind = 1190;
    event.addTag(testTag);
    event.setEventKind(testKind);
    event.setEventContent(newContent);

    const eventData = event.getEventPayload();
    const tagsLength = eventData.tags.length;
    expect(tagsLength).toBe(1);
    expect(eventData.tags[tagsLength - 1][0]).toEqual(testTag[0]);
    expect(eventData.tags[tagsLength - 1][1]).toEqual(testTag[1]);
    expect(eventData.kind).toBe(testKind);
    expect(eventData.content).toBe(newContent);
  });

  // A signed event should have valid values for the 'id' and 'sig' fields.
  it("A signed event should have valid values for the 'id' and 'sig' fields.", () => {
    const eventParams: EventCreationParams = {
      pubkey,
      kind: EventKinds.TEXT_NOTE,
      content: "This is to test the completeness of a signed event data.",
    };
    const event = new EventBuilder(eventParams);
    event.signEvent(privateKey);

    const signedEventData = event.getSignedEventData();
    expect(signedEventData.id).not.toBeNull();
    expect(signedEventData.sig).not.toBeNull();

    expect(verifySignature(signedEventData)).toBe(true);
  });
});
