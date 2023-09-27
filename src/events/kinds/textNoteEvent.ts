import { EventKinds, SignedEventData } from "../types";
import GenericEvent from "./genericEvent";

/**
 * Contains a text note in the .content property.
 */
export default class TextNoteEvent extends GenericEvent {
  constructor(eventData: any) {
    if (eventData.kind !== EventKinds.TEXT_NOTE) {
      throw new Error("Invalid kind for TextNoteEvent");
    }

    super(eventData);
  }

  public static async deconstructEvent(eventData: SignedEventData) {
    return new TextNoteEvent(eventData);
  }
}
