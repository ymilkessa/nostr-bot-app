import GenericEvent from "../../../src/events/kinds/genericEvent";

describe("GenericEvent", () => {
  it("Initialize created an instance correctly", () => {
    const signedEvent = {
      id: "36f199f8905fc542a7bc07e11ab06c21d72ffd29a7a9ac7660cfca6fca3b58ec",
      content:
        "/oZSofupWmPmH1bV/aV/6muFUVSEQfGHZBdQm7X/ULChIQURCyM5F15GtymJUcp7?iv=Z1vLlaNREnVULUMRjFUlYA==",
      kind: 4,
      tags: [
        [
          "p",
          "8cf2bff12ca4ae52478bda0b425a7673eb1cf595618f0ba338fa7f73201686a8",
        ],
      ],
      created_at: 1695838606,
      sig: "d6d088521c6362bd29a9691528e7f265e6c3a9fca72d2ec648496acd0d29d56201ad58651d4b2994a4e99ad6893ad73bb0c700decae007e93aab488a4c57d1db",
      pubkey:
        "29442e9d6e9ff198bd42c3c55054a1c705198dfe2fed5cb6c0359f78823670e1",
    };
    const event = new GenericEvent(signedEvent);
    expect(event.id).toEqual(signedEvent.id);
    expect(event.content).toEqual(signedEvent.content);
    expect(event.kind).toEqual(signedEvent.kind);
    expect(event.tags).toEqual(signedEvent.tags);
    expect(event.created_at).toEqual(signedEvent.created_at);
    expect(event.sig).toEqual(signedEvent.sig);
  });
});
