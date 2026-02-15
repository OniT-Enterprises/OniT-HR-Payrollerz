const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so Metro picks up changes in packages/shared
config.watchFolders = [monorepoRoot];

// Resolve packages from mobile first, then fall back to monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Prevent Metro from traversing up directory trees for resolution.
// Without this, react-native (hoisted to root) would resolve React 18
// from root instead of React 19 from mobile/node_modules.
config.resolver.disableHierarchicalLookup = true;

// Enable package exports so Metro can resolve ESM imports with explicit
// .js extensions (e.g., lucide-react-native's `./icons/home.js` imports).
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
