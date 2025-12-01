const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const config = getDefaultConfig(__dirname);

// Ignore the corrupted backup folders so Metro doesn't choke on them when walking the tree.
config.resolver.blockList = exclusionList([/node_modules_old.*/]);

module.exports = config;
