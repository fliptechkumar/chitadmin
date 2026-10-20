// The app lives inside the admin web project. Keep Metro from resolving
// anything out of the admin's node_modules, which has its own React.
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
const parentModules = path.resolve(__dirname, '..', 'node_modules')
const escaped = parentModules.replace(/[/\\^$.*+?()[\]{}|]/g, '\\$&')

config.resolver.blockList = [new RegExp(`^${escaped}[/\\\\].*`)]
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')]

module.exports = config
