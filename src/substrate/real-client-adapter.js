// Bridges a real, synced matrix-js-sdk MatrixClient to the plain-field duck
// type matrix-log.js is written against (see that file's header comment:
// "an integration layer between the real SDK and this class is expected to
// map one to the other"). This is that layer.
//
// matrix-js-sdk hides event data behind getters (getId(), getSender(),
// getTs(), getType(), getContent()) on MatrixEvent instances, rather than
// exposing plain fields. adaptClientForLog wraps getRoom() so its returned
// timeline events are plain objects instead, with no other behavior change
// — sendEvent passes straight through since MatrixClient#sendEvent already
// matches the shape MatrixLog calls it with.

function toPlainEvent(matrixEvent) {
  return {
    event_id: matrixEvent.getId(),
    sender: matrixEvent.getSender(),
    origin_server_ts: matrixEvent.getTs(),
    type: matrixEvent.getType(),
    content: matrixEvent.getContent(),
  };
}

export function adaptClientForLog(realClient) {
  if (!realClient || typeof realClient.sendEvent !== 'function' || typeof realClient.getRoom !== 'function') {
    throw new TypeError('adaptClientForLog requires a matrix-js-sdk MatrixClient (sendEvent, getRoom)');
  }

  return {
    sendEvent: (...args) => realClient.sendEvent(...args),
    getRoom(roomId) {
      const room = realClient.getRoom(roomId);
      if (!room) return null;
      return {
        getLiveTimeline: () => ({
          getEvents: () => room.getLiveTimeline().getEvents().map(toPlainEvent),
        }),
      };
    },
  };
}
