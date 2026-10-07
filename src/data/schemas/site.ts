export const SITE_URL = 'https://pwa.odio.love';
export const ODIO_URL = 'https://odio.love';
export const DOCS_URL = 'https://docs.odio.love';
export const REPO_URL = 'https://github.com/b0bbywan/odio-pwa';

export const DEFAULT_TITLE = 'Odio Web App - Multimedia remote for your local odio nodes';

export const DEFAULT_DESCRIPTION =
  "Open-source remote for your odio nodes: see what's playing and control playback on all of them from one screen. Installable PWA, no account, no telemetry.";

export const SHORT_DESCRIPTION =
  "See what's playing and control playback on every odio node of your network from one screen. Open-source, installable PWA.";

export const OG_IMAGE = `${SITE_URL}/logo.png`;
export const OG_IMAGE_ALT = 'odio logo';

export const ORG_ID = `${ODIO_URL}/#organization`;
export const OS_ID = `${ODIO_URL}/#os`;

export interface SchemaRef {
  '@id': string;
}

export const ORG_REF: SchemaRef = { '@id': ORG_ID };
export const OS_REF: SchemaRef = { '@id': OS_ID };

const FEATURE_LIST = [
  'Discover and add odio nodes by IP or hostname',
  'Now playing on every node: cover art, title, artist, progress',
  'Playback controls (play/pause, previous, next) for any MPRIS media player, audio or video',
  'One tab per active player when a node plays several',
  'Power off a node from the list, with confirmation',
  'Real-time status via Server-Sent Events with HTTP polling fallback',
  'Smart reconnect with exponential backoff',
  'One-tap switching between online nodes',
  'Reboot and power-off handling: wait for the node to come back',
  'Installable as a Progressive Web App',
];

const KEYWORDS = [
  'odio',
  'odio web app',
  'odio remote',
  'multimedia remote',
  'media player remote',
  'MPRIS remote',
  'now playing',
  'Raspberry Pi multimedia remote',
  'multi-node control',
  'multi-room media control',
  'Progressive Web App',
  'self-hosted multimedia',
];

export interface BuildSiteSchemaArgs {
  version: string;
}

export function buildSiteSchema({ version }: BuildSiteSchemaArgs) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORG_ID,
        name: 'odio',
        url: ODIO_URL,
        logo: {
          '@type': 'ImageObject',
          url: `${ODIO_URL}/og-cover.png`,
        },
        sameAs: [ODIO_URL, DOCS_URL, 'https://github.com/b0bbywan', REPO_URL],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: 'Odio Web App',
        url: `${SITE_URL}/`,
        description: SHORT_DESCRIPTION,
        inLanguage: 'en',
        publisher: ORG_REF,
      },
      {
        '@type': 'WebApplication',
        '@id': `${SITE_URL}/#webapp`,
        name: 'Odio Web App',
        url: `${SITE_URL}/`,
        description:
          "Progressive Web App to discover and control your local odio nodes. See what's playing on each node and control playback, power nodes off, follow their live status over Server-Sent Events, switch between them with one tap, install to your home screen.",
        applicationCategory: 'MultimediaApplication',
        applicationSubCategory: 'Multimedia Remote',
        operatingSystem: 'Any (Progressive Web App)',
        browserRequirements:
          'Requires a modern browser with Service Worker and Server-Sent Events support',
        softwareVersion: version,
        inLanguage: 'en',
        isAccessibleForFree: true,
        license: 'https://opensource.org/licenses/BSD-2-Clause',
        codeRepository: REPO_URL,
        softwareHelp: { '@type': 'CreativeWork', url: `${DOCS_URL}/guides/pwa/` },
        about: OS_REF,
        author: ORG_REF,
        publisher: ORG_REF,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        screenshot: OG_IMAGE,
        featureList: FEATURE_LIST,
        keywords: KEYWORDS,
      },
    ],
  };
}
