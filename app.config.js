import appJson from './app.json';

export default {
  ...appJson,
  expo: {
    ...appJson.expo,
    owner: 'oldtimemessengerteams-team',
    extra: {
      ...appJson.expo.extra,
      eas: {
        projectId: '03a08b75-fbf6-4183-b356-90fe21034a42',
      },
    },
  },
};
