export const SITE_URL = 'https://pwa.odio.love';
export const ODIO_URL = 'https://odio.love';
export const DOCS_URL = 'https://docs.odio.love';
export const REPO_URL = 'https://github.com/b0bbywan/odio-pwa';

export const DEFAULT_TITLE = 'Odio Web App - Multimedia remote for your local odio audio nodes';

export const DEFAULT_DESCRIPTION =
  'Open-source multimedia remote to discover and control your local odio audio nodes. Installable PWA, real-time status, multi-node switching. Free, no account, no telemetry.';

export const SHORT_DESCRIPTION =
  'Open-source multimedia remote to discover and control your local odio audio nodes. Installable PWA, real-time status, multi-node switching.';

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
  'Real-time status via Server-Sent Events with HTTP polling fallback',
  'Smart reconnect with exponential backoff',
  'One-tap switching between online nodes',
  'Power event handling (reboot wait, poweroff)',
  'Installable as a Progressive Web App',
];

const KEYWORDS = [
  'odio',
  'odio web app',
  'odio remote',
  'multimedia remote',
  'audio streamer remote',
  'Raspberry Pi multimedia remote',
  'Raspberry Pi audio remote',
  'multi-node control',
  'multi-room audio control',
  'Progressive Web App',
  'self-hosted multimedia',
  'self-hosted audio',
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
          'Progressive Web App to discover and control your local odio audio nodes. Add multiple nodes, see live status over Server-Sent Events, switch between them with one tap, install to your home screen.',
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
