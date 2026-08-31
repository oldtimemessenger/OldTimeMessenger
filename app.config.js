const { expo } = require("./app.json");

const projectId = process.env.EAS_PROJECT_ID;

module.exports = {
  expo: {
    ...expo,
    extra: {
      ...(expo.extra ?? {}),
      eas: {
        ...((expo.extra && expo.extra.eas) ?? {}),
        projectId,
      },
    },
  },
};
