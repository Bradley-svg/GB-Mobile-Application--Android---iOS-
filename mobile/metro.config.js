// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const config = getDefaultConfig(__dirname);

// Exclude the broken backup folder from Metro so it never scans it
config.resolver.blockList = exclusionList([/node_modules_old\/.*/, /node_modules_old_unused\/.*/]);

// Use Hermes parser so Flow syntax in react-native 0.76 transforms correctly
config.transformer = config.transformer || {};
config.transformer.hermesParser = true;

// Server tweaks:
// - Force single-part JS responses (no multipart/mixed).
// - Rewrite Expo dev-client virtual entry to index.bundle so the dev client loads correctly.
config.server = config.server || {};
const originalEnhanceMiddleware = config.server.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const enhanced = originalEnhanceMiddleware ? originalEnhanceMiddleware(middleware, server) : middleware;
    return (req, res, next) => {
      // 1) Kill multipart/mixed so Metro serves a plain JS bundle.
      const accept = req.headers && req.headers.accept;
      if (typeof accept === 'string' && accept.includes('multipart/mixed')) {
        req.headers.accept = 'application/javascript,application/json;q=0.9,*/*;q=0.8';
      }

      // 2) Rewrite Expo dev-client virtual entry to index.bundle (keep query string intact).
      if (req.url && req.url.startsWith('/.expo/.virtual-metro-entry.bundle')) {
        const [, query = ''] = req.url.split('?', 2);
        req.url = `/index.bundle${query ? `?${query}` : ''}`;
      }

      return enhanced(req, res, next);
    };
  },
};

module.exports = config;
