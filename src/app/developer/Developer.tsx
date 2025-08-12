import React from 'react';

const createAppUrl = 'https://www.bungie.net/en/Application/Create';

export default function Developer(this: never) {
  // Use environment variables injected by webpack
  const apiKey = $D2L_WEB_API_KEY;
  const clientId = $D2L_WEB_CLIENT_ID;
  const clientSecret = $D2L_WEB_CLIENT_SECRET;
  const d2lApiKey = $D2L_API_KEY;
  const d2lAppName = 'D2Locker-dev'; // App name for D2L API

  const URL = window.location.origin;
  const URLRet = `${URL}/return.html`;

  let warning;
  if (window.location.protocol === 'http:') {
    warning = 'Bungie.net will not accept the http protocol. Serve over https:// and try again.';
  }

  // Prefill link is no longer strictly necessary with hardcoded values,
  // but keeping it for completeness if needed for other purposes.
  const prefillLink = `${URL}/developer?apiKey=${apiKey}&oauthClientId=${clientId}&oauthClientSecret=${clientSecret}&d2lApiKey=${d2lApiKey}&d2lAppName=${d2lAppName}`;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    // Save hardcoded values to localStorage for consistency with app's existing flow
    localStorage.setItem('apiKey', apiKey);
    localStorage.setItem('oauthClientId', clientId);
    localStorage.setItem('oauthClientSecret', clientSecret);
    localStorage.setItem('d2lAppName', d2lAppName);
    localStorage.setItem('d2lApiKey', d2lApiKey);
    localStorage.removeItem('d2lApiToken');
    localStorage.removeItem('authorization');
    window.location.href = window.location.origin;
  };

  return (
    <div className="d2l-page">
      <h1>Developer Settings</h1>
      <p>
        To run D2L locally, you need to create and register your own personal app with both the
        Bungie.net and D2L APIs.
      </p>
      {/* Show prefill link only if all values are present (which they now are by default) */}
      {apiKey && clientId && clientSecret && d2lAppName && d2lApiKey && (
        <a href={prefillLink}>
          Open this link in another browser to clone these settings to D2L there
        </a>
      )}
      {warning ? (
        <div>
          <h3>Configuration Error</h3>
          <span>{warning}</span>
        </div>
      ) : (
        <form onSubmit={save}>
          <h3>API Configuration</h3>
          <p><strong>Note:</strong> API keys are loaded from environment variables (.dev.env for development).</p>
          <ol>
            <li>
              Bungie.net API Key (from .dev.env):
              <br />
              <input
                name="apiKey"
                type="text"
                value={apiKey}
                size={40}
                readOnly
              />
            </li>
            <li>
              OAuth client_id (from .dev.env):
              <br />
              <input
                name="clientId"
                type="text"
                value={clientId}
                size={5}
                readOnly
              />
            </li>
            <li>
              OAuth client_secret (from .dev.env):
              <br />
              <input
                name="clientSecret"
                type="text"
                value={clientSecret}
                size={50}
                readOnly
              />
            </li>
            <li>
              D2L API Key (from .dev.env):
              <br />
              <input
                name="d2lApiKey"
                type="text"
                value={d2lApiKey}
                size={40}
                readOnly
              />
            </li>
          </ol>

          <p>
            <strong>Setup Instructions:</strong><br />
            1. Visit <a href={createAppUrl} target="_blank" rel="noreferrer noopener">{createAppUrl}</a><br />
            2. Use <code>{URLRet}</code> as "Redirect URL"<br />
            3. Use <code>{URL}</code> as "Origin Header"<br />
            4. Select "Confidential" OAuth type and all scopes except "Administrate Groups/Clans"<br />
            5. Update your .dev.env file with the generated keys
          </p>
          <button
            type="submit"
            className="d2l-button"
            disabled={!(apiKey && clientId && clientSecret && d2lAppName && d2lApiKey)}
          >
            Save API Keys
          </button>
        </form>
      )}
    </div>
  );
}
