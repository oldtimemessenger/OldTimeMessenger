import appJson from './app.json';

export default {
  ...appJson,
  expo: {
    ...appJson.expo,
    owner: 'oldtimemessengers-team',
    extra: {
      ...appJson.expo.extra,
      eas: {
        projectId: 'bcc56753-60bc-4e41-954e-e32e3e1b6d1a',
      },
    },
  },
};
