const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so Metro picks up changes in packages/shared
config.watchFolders = [monorepoRoot];

// Resolve packages: ekipa local → mobile shared → monorepo root
// React 19 + RN deps are hoisted to mobile/node_modules by npm workspaces
const mobileRoot = path.resolve(projectRoot, '..');
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(mobileRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Prevent Metro from traversing up directory trees for resolution
config.resolver.disableHierarchicalLookup = true;

// Enable package exports so Metro can resolve ESM imports with explicit .js extensions
config.resolver.unstable_enablePackageExports = true;

// Workaround: qrcode (dep of react-native-qrcode-svg) uses require('./can-promise')
// which fails under Metro's package exports mode. Override resolveRequest to handle
// relative requires within qrcode by resolving them as plain filesystem paths.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    context.originModulePath &&
    context.originModulePath.includes(path.join('node_modules', 'qrcode', '')) &&
    moduleName.startsWith('.')
  ) {
    const dir = path.dirname(context.originModulePath);
    const candidates = [
      path.resolve(dir, moduleName),
      path.resolve(dir, moduleName + '.js'),
      path.resolve(dir, moduleName + '.json'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return { type: 'sourceFile', filePath: candidate };
      }
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
