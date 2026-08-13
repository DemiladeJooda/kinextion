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

// Follow pnpm's symlinks rather than treating them as opaque files.
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
