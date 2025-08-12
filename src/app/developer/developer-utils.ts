// This function will automatically set the environment API keys into localStorage
// for development purposes, bypassing the need for the developer setup page.
export function setEnvironmentApiKeys() {
  const apiKey = $D2L_WEB_API_KEY; // Bungie.net API Key
  const clientId = $D2L_WEB_CLIENT_ID; // Bungie.net OAuth Client ID
  const clientSecret = $D2L_WEB_CLIENT_SECRET; // Bungie.net OAuth Client Secret
  const d2lApiKey = $D2L_API_KEY; // D2L API Key (used by our backend)
  const d2lAppName = 'D2Locker-dev'; // D2L App Name

  localStorage.setItem('apiKey', apiKey);
  localStorage.setItem('oauthClientId', clientId);
  localStorage.setItem('oauthClientSecret', clientSecret);
  localStorage.setItem('d2lAppName', d2lAppName);
  localStorage.setItem('d2lApiKey', d2lApiKey);
  // No longer needed with hardcoded keys, and was causing issues
  // localStorage.removeItem('d2lApiToken');
  // localStorage.removeItem('authorization');
}
