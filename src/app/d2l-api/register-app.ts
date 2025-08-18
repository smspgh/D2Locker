import { ApiApp, ErrorResponse } from '@destinyitemmanager/dim-api-types';
import { unauthenticatedApi } from './d2l-api-helper';

export async function registerApp(d2lAppName: string, bungieApiKey: string) {
  const appResponse = await unauthenticatedApi<{ app: ApiApp } | ErrorResponse>({
    url: '/new_app',
    method: 'POST',
    body: {
      id: d2lAppName,
      bungieApiKey,
      origin: window.location.origin,
    },
  });

  // Check if request failed for various possible reasons
  if ('error' in appResponse) {
    const failResponse: ErrorResponse = appResponse; // Unexpected result, recast
    throw new Error(`Could not register app: ${failResponse.error} - ${failResponse.message}`);
  }
  return appResponse.app;
}
