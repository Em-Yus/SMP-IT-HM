const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

export default ({ config }) => ({
  ...config,
  name: IS_PREVIEW ? "SMP IT HM (Preview)" : (config.name || "SMP IT HM"),
  slug: config.slug || "mobile-app",
  scheme: IS_PREVIEW ? "mobileapp-preview" : (config.scheme || "mobileapp"),
  android: {
    ...config.android,
    package: IS_PREVIEW ? "com.emyusdev.smpithm.preview" : (config.android?.package || "com.emyusdev.smpithm"),
  },
});
