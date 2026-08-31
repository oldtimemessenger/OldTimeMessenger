const { expo } = require("./app.json");

const projectId = process.env.EAS_PROJECT_ID;
if (!projectId && process.env.CI) {
  throw new Error("Missing EAS_PROJECT_ID environment variable for CI/EAS builds.");
}

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
