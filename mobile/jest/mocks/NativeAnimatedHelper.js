const noop = () => {};

const API = {
  startListeningToAnimatedNodeValue: noop,
  stopListeningToAnimatedNodeValue: noop,
  dropAnimatedNode: noop,
  connectAnimatedNodes: noop,
  disconnectAnimatedNodes: noop,
  createAnimatedNode: noop,
  restoreDefaultValues: noop,
  flushQueue: noop,
  setWaitingForIdentifier: noop,
  getValue: (_tag, callback) => {
    if (typeof callback === 'function') {
      callback(0);
    }
  },
};

module.exports = {
  default: {
    API,
    addListener: noop,
    removeListeners: noop,
    connectAnimatedNodes: noop,
    disconnectAnimatedNodes: noop,
    startAnimatingNode: noop,
    stopAnimation: noop,
    setWaitingForIdentifier: noop,
    getValue: API.getValue,
    NativeAnimatedModule: API,
    assertNativeAnimatedModule: noop,
  },
};
