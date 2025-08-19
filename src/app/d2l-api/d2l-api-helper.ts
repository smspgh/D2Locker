import {
  FatalTokenError,
  getActiveToken as getBungieToken,
} from 'app/bungie-api/authenticated-fetch';
import { dedupePromise } from 'app/utils/promises';
import { HttpClientConfig } from 'bungie-api-ts/http';

const D2L_API_HOST =
  $D2L_FLAVOR === 'dev' ? 'https://localhost:8443/api' : 'https://d2locker.com/api';
export const API_KEY = '788600d2-9320-484e-86dd-5f5c9c458b66'; // Hardcoded for private use - This is our D2L API Key

const localStorageKey = 'd2lApiToken';

/**
 * Call one of the unauthenticated D2L APIs.
 */
export async function unauthenticatedApi<T>(
  config: HttpClientConfig,
  noApiKey?: boolean,
): Promise<T> {
  let url = `${D2L_API_HOST}${config.url}`;
  if (config.params) {
    // TODO: properly type HttpClientConfig
    url = `${url}?${new URLSearchParams(config.params as Record<string, string>).toString()}`;
  }

  const headers: RequestInit['headers'] = {};
  if (config.body) {
    headers['Content-Type'] = 'application/json';
  }
  if (!noApiKey) {
    headers['X-API-Key'] = API_KEY;
  }
  headers['X-D2L-Version'] = $D2L_VERSION;

  const response = await fetch(
    new Request(url, {
      method: config.method,
      body: config.body ? JSON.stringify(config.body) : undefined,
      headers,
    }),
  );

  if (response.status === 401) {
    // Delete our token
    deleteDimApiToken();
    throw new FatalTokenError(`Unauthorized call to ${config.url}`);
  }
  if (response.ok) {
    return response.json() as Promise<T>;
  }

  let responseData;
  try {
    responseData = (await response.json()) as { error: string; message: string };
  } catch {}
  if (responseData?.error) {
    throw new Error(`${responseData.error}: ${responseData.message}`);
  }

  throw new Error(`Failed to call D2L API: ${response.status}`);
}

/**
 * Call one of the authenticated D2L APIs.
 */
export async function authenticatedApi<T>(config: HttpClientConfig): Promise<T> {
  const token = await getAuthToken();

  let url = `${D2L_API_HOST}${config.url}`;
  if (config.params) {
    // TODO: properly type HttpClientConfig
    url = `${url}?${new URLSearchParams(config.params as Record<string, string>).toString()}`;
  }

  const headers: RequestInit['headers'] = {
    Authorization: `${token.accessToken}`,
    'X-API-Key': API_KEY,
    'X-D2L-Version': $D2L_VERSION,
  };
  if (config.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(
    new Request(url, {
      method: config.method,
      body: config.body ? JSON.stringify(config.body) : undefined,
      headers,
    }),
  );

  if (response.status === 401) {
    // Delete our token
    deleteDimApiToken();
  }
  if (response.ok) {
    return response.json() as Promise<T>;
  }

  let responseData;
  try {
    responseData = (await response.json()) as { error: string; message: string };
  } catch {}
  if (responseData?.error) {
    throw new Error(`${responseData.error}: ${responseData.message}`);
  }

  throw new Error(`Failed to call D2L API: ${response.status}`);
}

export interface DimAuthToken {
  /** Your D2L API access token, to be used in further requests. */
  accessToken: string;
  /** How many seconds from now the token will expire. */
  expiresInSeconds: number;
  /** A UTC epoch milliseconds timestamp representing when the token was acquired. */
  inception: number;
}

/**
 * Get all token information from saved storage.
 */
export function getToken(): DimAuthToken | undefined {
  const tokenString = localStorage.getItem(localStorageKey);
  return tokenString ? (JSON.parse(tokenString) as DimAuthToken) : undefined;
}

/**
 * Save all the information about access/refresh tokens.
 */
function setToken(token: DimAuthToken) {
  localStorage.setItem(localStorageKey, JSON.stringify(token));
}

export function deleteDimApiToken() {
  localStorage.removeItem(localStorageKey);
}

export interface AuthTokenRequest {
  /** The access token from authenticating with the Bungie.net API */
  bungieAccessToken: string;
  /** The user's Bungie.net membership ID */
  membershipId: string;
}

const refreshToken = dedupePromise(async () => {
  const bungieToken = await getBungieToken();
  const authRequest: AuthTokenRequest = {
    bungieAccessToken: bungieToken.accessToken.value,
    membershipId: bungieToken.bungieMembershipId,
  };
  // Ensure API Key is sent for this call
  const authToken = await unauthenticatedApi<DimAuthToken>({
    url: '/auth/token',
    method: 'POST',
    body: authRequest,
  }); // Removed noApiKey parameter

  authToken.inception = Date.now();
  setToken(authToken);

  return authToken;
});

async function getAuthToken(): Promise<DimAuthToken> {
  const token = getToken();
  if (!token || hasTokenExpired(token)) {
    // Get a token!
    return refreshToken();
  }
  return token;
}

/**
 * Has the token expired, based on its 'expires' property?
 */
function hasTokenExpired(token?: DimAuthToken) {
  if (!token) {
    return true;
  }
  const expires = token.inception + token.expiresInSeconds * 1000;
  const now = Date.now();
  return now > expires;
}
