// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const config = getDefaultConfig(__dirname);

// Exclude the broken backup folder from Metro so it never scans it
config.resolver.blockList = exclusionList([/node_modules_old\/.*/, /node_modules_old_unused\/.*/]);

// Use Hermes parser so Flow syntax in react-native 0.76 transforms correctly
config.transformer = config.transformer || {};
config.transformer.hermesParser = true;

// Force bundle responses to be plain JS (no multipart streaming) to avoid
// the client choking on progressive responses.
config.server = config.server || {};
const originalEnhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const enhanced = originalEnhanceMiddleware ? originalEnhanceMiddleware(middleware, server) : middleware;
  return (req, res, next) => {
    if (req.headers && typeof req.headers.accept === 'string' && req.headers.accept.includes('multipart/mixed')) {
      req.headers.accept = 'application/javascript';
    }
    return enhanced(req, res, next);
  };
};

module.exports = config;
