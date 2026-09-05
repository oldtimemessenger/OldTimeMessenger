/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'broadcast-upload',
  name: 'OldTimeBroadcast',
  displayName: 'Old Time Screen Share',
  bundleIdentifier: '.broadcast',
  deploymentTarget: '15.1',
  frameworks: ['ReplayKit', 'CoreImage', 'CoreMedia'],
  entitlements: {
    'com.apple.security.application-groups': ['group.com.oldtime.messenger'],
  },
};