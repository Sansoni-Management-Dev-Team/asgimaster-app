const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require('nativewind/metro');

const config = getSentryExpoConfig(__dirname, { includeWebReplay: false });

module.exports = withNativeWind(config, { input: './src/global.css' });
