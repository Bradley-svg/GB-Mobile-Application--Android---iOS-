const {EventEmitter: NodeEventEmitter} = require('events');

class MockEventEmitter {
  constructor() {
    this._emitter = new NodeEventEmitter();
  }

  addListener(eventType, listener, context) {
    const wrappedListener =
      typeof context !== 'undefined' ? listener.bind(context) : listener;
    this._emitter.on(eventType, wrappedListener);
    return {
      remove: () => this._emitter.removeListener(eventType, wrappedListener),
    };
  }

  emit(eventType, ...args) {
    this._emitter.emit(eventType, ...args);
  }

  removeAllListeners(eventType) {
    this._emitter.removeAllListeners(eventType);
  }

  listenerCount(eventType) {
    return this._emitter.listenerCount(eventType);
  }

  removeSubscription(subscription) {
    if (subscription && typeof subscription.remove === 'function') {
      subscription.remove();
    }
  }
}

module.exports = MockEventEmitter;
module.exports.default = MockEventEmitter;
