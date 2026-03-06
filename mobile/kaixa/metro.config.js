const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Enable package exports so Metro can resolve ESM imports with explicit
// .js extensions (e.g., lucide-react-native's `./icons/home.js` imports).
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
