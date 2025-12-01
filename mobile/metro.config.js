// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const config = getDefaultConfig(__dirname);

// Exclude the broken backup folder from Metro so it never scans it
config.resolver.blockList = exclusionList([/node_modules_old\/.*/]);

module.exports = config;
