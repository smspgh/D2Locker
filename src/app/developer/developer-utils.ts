// This function will automatically set the hardcoded API keys into localStorage
// for development purposes, bypassing the need for the developer setup page.
export function setHardcodedApiKeys() {
  const apiKey = '5661f030fee44a7b9f3a7beac0423012'; // Bungie.net API Key
  const clientId = '49737'; // Bungie.net OAuth Client ID
  const clientSecret = '6pMn9Tafgvj6.wfe0lpx7lZnbY45gnHTDckhwVJiB0Q'; // Bungie.net OAuth Client Secret
  const dimApiKey = 'hardcoded-for-private-use'; // DIM API Key (used by our backend)
  const dimAppName = 'yourname-dev'; // DIM App Name

  localStorage.setItem('apiKey', apiKey);
  localStorage.setItem('oauthClientId', clientId);
  localStorage.setItem('oauthClientSecret', clientSecret);
  localStorage.setItem('dimAppName', dimAppName);
  localStorage.setItem('dimApiKey', dimApiKey);
  // No longer needed with hardcoded keys, and was causing issues
  // localStorage.removeItem('dimApiToken');
  // localStorage.removeItem('authorization');
}
