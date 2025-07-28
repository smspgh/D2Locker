import React from 'react';

const createAppUrl = 'https://www.bungie.net/en/Application/Create';

export default function Developer(this: never) {
  // Hardcode API keys and client info as per user's request for private setup
  const apiKey = '5661f030fee44a7b9f3a7beac0423012';
  const clientId = '49737';
  const clientSecret = '6pMn9Tafgvj6.wfe0lpx7lZnbY45gnHTDckhwVJiB0Q';
  const dimApiKey = 'hardcoded-for-private-use'; // This will be sent as X-API-Key
  const dimAppName = 'yourname-dev'; // This can be anything for private use

  const URL = window.location.origin;
  const URLRet = `${URL}/return.html`;

  let warning;
  if (window.location.protocol === 'http:') {
    warning = 'Bungie.net will not accept the http protocol. Serve over https:// and try again.';
  }

  // Prefill link is no longer strictly necessary with hardcoded values,
  // but keeping it for completeness if needed for other purposes.
  const prefillLink = `${URL}/developer?apiKey=${apiKey}&oauthClientId=${clientId}&oauthClientSecret=${clientSecret}&dimApiKey=${dimApiKey}&dimAppName=${dimAppName}`;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    // Save hardcoded values to localStorage for consistency with app's existing flow
    localStorage.setItem('apiKey', apiKey);
    localStorage.setItem('oauthClientId', clientId);
    localStorage.setItem('oauthClientSecret', clientSecret);
    localStorage.setItem('dimAppName', dimAppName);
    localStorage.setItem('dimApiKey', dimApiKey);
    localStorage.removeItem('dimApiToken');
    localStorage.removeItem('authorization');
    window.location.href = window.location.origin;
  };

  return (
    <div className="dim-page">
      <h1>Developer Settings</h1>
      <p>
        To run DIM locally, you need to create and register your own personal app with both the
        Bungie.net and DIM APIs.
      </p>
      {/* Show prefill link only if all values are present (which they now are by default) */}
      {apiKey && clientId && clientSecret && dimAppName && dimApiKey && (
        <a href={prefillLink}>
          Open this link in another browser to clone these settings to DIM there
        </a>
      )}
      {warning ? (
        <div>
          <h3>Configuration Error</h3>
          <span>{warning}</span>
        </div>
      ) : (
        <form onSubmit={save}>
          <h3>Bungie.net API Key</h3>
          <ol>
            <li>
              Visit{' '}
              <a href={createAppUrl} target="_blank" rel="noreferrer noopener">
                {createAppUrl}
              </a>
            </li>
            <li>
              Paste <input name="redirectUrl" type="text" value={URLRet} readOnly size={30} /> into
              the "Redirect URL" section under "App Authentication".
            </li>
            <li>
              Paste <input name="originHeader" type="text" value={URL} readOnly size={20} /> into
              the "Origin Header" section under "Browser Based Apps".
            </li>
            <li>Select "Confidential" OAuth type.</li>
            <li>
              Select all scopes <i>except</i> for Administrate Groups/Clans
            </li>
            <li>
              After saving, copy the "API Key" here:
              <br />
              <input
                name="apiKey"
                type="text"
                value={apiKey}
                size={40}
                readOnly // Make it read-only
              />
            </li>
            <li>
              Copy the "OAuth client_id" here:
              <br />
              <input
                name="clientId"
                type="text"
                value={clientId}
                size={5}
                readOnly // Make it read-only
              />
            </li>
            <li>
              Copy the "OAuth client_secret" here:
              <br />
              <input
                name="clientSecret"
                type="text"
                value={clientSecret}
                size={50}
                readOnly // Make it read-only
              />
            </li>
          </ol>

          {/* Removed DIM API Key section as it's hardcoded and no longer needs user input */}
          <button
            type="submit"
            className="dim-button"
            disabled={!(apiKey && clientId && clientSecret && dimAppName && dimApiKey)}
          >
            Save API Keys
          </button>
        </form>
      )}
    </div>
  );
}
