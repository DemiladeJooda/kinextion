// Metro config for a pnpm workspace.
//
// pnpm stores dependencies as symlinks into a content-addressed store, and it
// keeps shared packages outside apps/mobile. Metro only watches the project
// directory and only resolves through the local node_modules by default, so
// without this the workspace imports (@kinextion/ai-core, @kinextion/shared)
// fail to resolve and edits to them don't trigger a reload.

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so changes in packages/* hot-reload the app.
config.watchFolders = [workspaceRoot];

// Resolve from the app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Symlink handling and hierarchical lookup are left at Expo's defaults: since
// SDK 52 Expo configures pnpm workspaces itself, and overriding them conflicts.

// The shared packages are also run by Node (apps/api), which needs ESM imports
// written with the extension of the *compiled* file: `./types/index.js` for a
// source file that is actually `./types/index.ts`. Metro resolves source files
// and won't make that leap on its own, so a relative `.js` import that doesn't
// exist is retried without its extension, letting Metro find the `.ts`.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    try {
      return context.resolveRequest(context, moduleName, platform);
    } catch {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform);
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
