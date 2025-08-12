import UAParser from 'ua-parser-js';

export const [systemInfo, browserName, browserVersion] = getSystemInfo();

function getSystemInfo() {
  const parser = new UAParser();
  const { name: browserName, version: browserVersion } = parser.getBrowser();
  const { name: osName, version: osVersion } = parser.getOS();
  const userAgent = parser.getUA();
  const d2lAppStoreIndex = userAgent.indexOf('D2L AppStore');
  let browserInfo = `${browserName} ${browserVersion}`;
  if (d2lAppStoreIndex >= 0) {
    browserInfo = userAgent.substring(d2lAppStoreIndex);
  }

  const info = `${browserInfo} - ${osName} ${osVersion}`;
  return [info, browserName, browserVersion] as const;
}
