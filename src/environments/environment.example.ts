//!NOTE: For build pipeline ENV_CONFIG_FILE swap ) to \)
export const environment = { //copy this file, rename it to environment.ts and fill in your firebase app config values
    useEmulators: true,
    firestoreUsername: '',
    firestorePassword: '',
    firebase: {
      projectId: '',
      appId: '',
      storageBucket: '',
      apiKey: '',
      authDomain: '',
      messagingSenderId: '',
      measurementId: ''
    },
    turnIceServer: {
      urls: [],
      username: '',
      credential: '',
    }
};