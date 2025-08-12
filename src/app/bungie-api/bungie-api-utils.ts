import { HttpClientConfig, HttpQueryParams } from 'bungie-api-ts/http';

export const API_KEY = $D2L_FLAVOR !== 'dev' ? $D2L_WEB_API_KEY : localStorage.getItem('apiKey')!;

export function bungieApiUpdate(path: string, data?: Record<string, any>): HttpClientConfig {
  return {
    method: 'POST',
    url: `https://www.bungie.net${path}`,
    body: data,
  };
}

export function bungieApiQuery(path: string, params?: HttpQueryParams): HttpClientConfig {
  return {
    method: 'GET',
    url: `https://www.bungie.net${path}`,
    params,
  };
}

export function oauthClientId(): string {
  return $D2L_FLAVOR !== 'dev' ? $D2L_WEB_CLIENT_ID : localStorage.getItem('oauthClientId')!;
}

export function oauthClientSecret(): string {
  return $D2L_FLAVOR !== 'dev'
    ? $D2L_WEB_CLIENT_SECRET
    : localStorage.getItem('oauthClientSecret')!;
}
