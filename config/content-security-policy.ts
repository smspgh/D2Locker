import builder from 'content-security-policy-builder';
import { FeatureFlags } from './feature-flags';

const SELF = "'self'";

/**
 * Generate a Content Security Policy directive for a particular D2 Locker environment (beta, release)
 */
export default function csp(
  env: 'release' | 'beta' | 'dev' | 'pr',
  featureFlags: FeatureFlags,
  version: string | undefined,
) {
  const baseCSP: Record<string, string[] | string | boolean> = {
    defaultSrc: ["'none'"],
    scriptSrc: [
      SELF,
      '',
      '',
      // OpenCollective backers
      '',
    ],
    workerSrc: [SELF],
    styleSrc: [
      SELF,
      // For our inline styles
      "'unsafe-inline'",
      // Google Fonts
      'https://fonts.googleapis.com/',
    ],
    connectSrc: [
      SELF,
      // Google Analytics
      '',
      '',
      '',
      // Bungie.net API
      'https://www.bungie.net',
      // Sentry
      featureFlags.sentry && '',
      // Wishlists
      featureFlags.wishLists && '',
      featureFlags.wishLists && '',
      // DIM Sync
      'https://shirezaks.com',
      // Clarity
      featureFlags.clarityDescriptions && '',
      // Stream Deck Plugin
      featureFlags.elgatoStreamDeck && '',
      featureFlags.elgatoStreamDeck && '',
      // Game2Give
      featureFlags.issueBanner && '',
    ].filter((s) => s !== false),
    imgSrc: [
      SELF,
      // Webpack inlines some images
      'data:',
      // Bungie.net images
      'https://www.bungie.net',
      // Google analytics tracking
      '',
      '',
      // OpenCollective backers
      '',
    ],
    fontSrc: [
      SELF,
      'data:',
      // Google Fonts
      'https://fonts.gstatic.com',
    ],
    childSrc: [SELF],
    frameSrc: [
      // OpenCollective backers
      '',
      // Mastodon feed
      '',
    ],
    prefetchSrc: [SELF],
    objectSrc: SELF,
    // Web app manifest
    manifestSrc: SELF,
  };

  // Turn on CSP reporting to sentry.io on beta only
  if (featureFlags.sentry && env === 'beta') {
    baseCSP.reportUri = ``;
    if (version) {
      baseCSP.reportUri += `&sentry_release=0`;
    }
  }

  return builder({
    directives: baseCSP,
  });
}
