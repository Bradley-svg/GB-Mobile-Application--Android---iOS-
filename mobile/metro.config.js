const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const config = getDefaultConfig(__dirname);

// Ignore the corrupted backup folder so Metro doesn't choke on it when walking the tree.
config.resolver.blockList = exclusionList([/node_modules_old\\.*$/]);

module.exports = config;
