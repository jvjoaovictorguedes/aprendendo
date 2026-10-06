// Config do Metro (empacotador do app). Igual à padrão do Expo, mas ignora
// a pasta api/ — é o back-end em Node, com node_modules próprio, e não
// faz parte do app.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const apiDirPattern = path
  .join(__dirname, 'api')
  .split(/[/\\]/)
  .map(escapeRegex)
  .join('[/\\\\]');
config.resolver.blockList = [new RegExp(`^${apiDirPattern}[/\\\\].*$`)];

module.exports = config;
