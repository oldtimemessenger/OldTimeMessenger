import appJson from './app.json';

export default {
  ...appJson,
  expo: {
    ...appJson.expo,
    owner: 'oldtimemessengers-team',
    extra: {
      ...appJson.expo.extra,
      eas: {
        projectId: '5d0acf68-ca5f-479f-8fa6-2fbf81342ebb',
      },
    },
  },
};
