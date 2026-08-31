const { expo } = require("./app.json");

const projectId =
  process.env.EAS_PROJECT_ID ||
  process.env.EXPO_EAS_PROJECT_ID ||
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

module.exports = {
  ...expo,
  extra: {
    ...(expo.extra ?? {}),
    eas: {
      ...((expo.extra && expo.extra.eas) ?? {}),
      projectId,
    },
  },
};
