const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

const getAppName = (defaultName) => {
  if (IS_DEV) return "SMP IT HM (Dev)";
  if (IS_PREVIEW) return "SMP IT HM (Preview)";
  return defaultName || "SMP IT HM";
};

const getAppScheme = (defaultScheme) => {
  if (IS_DEV) return "mobileapp-dev";
  if (IS_PREVIEW) return "mobileapp-preview";
  return defaultScheme || "mobileapp";
};

const getAndroidPackage = (defaultPackage) => {
  if (IS_DEV) return "com.emyusdev.smpithm.dev";
  if (IS_PREVIEW) return "com.emyusdev.smpithm.preview";
  return defaultPackage || "com.emyusdev.smpithm";
};

export default ({ config }) => ({
  ...config,
  name: getAppName(config.name),
  slug: config.slug || "mobile-app",
  scheme: getAppScheme(config.scheme),
  android: {
    ...config.android,
    package: getAndroidPackage(config.android?.package),
  },
});
