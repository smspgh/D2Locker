declare module 'postcss-assets-webpack-plugin';
declare module 'postcss-sort-media-queries';
declare module 'chalk'; // Added for chalk module

declare const $DIM_FLAVOR: string;
declare const $DIM_VERSION: string;
declare const $PUBLIC_PATH: string;
declare const $featureFlags: Record<string, boolean>;
declare const $DIM_BUILD_DATE: string; // Added for $DIM_BUILD_DATE
declare const $DIM_WEB_API_KEY: string; // Added for DIM_WEB_API_KEY
declare const $DIM_WEB_CLIENT_ID: string; // Added for DIM_WEB_CLIENT_ID
declare const $DIM_WEB_CLIENT_SECRET: string; // Added for DIM_WEB_CLIENT_SECRET
declare const $ANALYTICS_PROPERTY: string; // Added for ANALYTICS_PROPERTY
declare const $DEFAULT_DESTINY_VERSION: string; // Added for DEFAULT_DESTINY_VERSION

interface Performance {
  measureUserAgentSpecificMemory?: () => Promise<any>;
}

interface Window {
  enableMockProfile?: boolean; // Added for enableMockProfile
  OC?: any; // Added for OC
  MSStream?: any; // Added for MSStream
}

declare const self: ServiceWorkerGlobalScope;

interface ServiceWorkerGlobalScope {
  __precacheManifest: any[];
  __WB_MANIFEST: any[];
  skipWaiting: () => void;
  // Add other properties that might be accessed on 'self' in service worker context
  // For example, if you access 'self.clients', you might need:
  // clients: Clients;
}

interface Navigator {
  standalone?: boolean; // Added for standalone
}
