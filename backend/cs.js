// ES Module version for projects with "type": "module" in package.json

import cloudscraper from 'cloudscraper';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

async function downloadGodRollData() {
  const url = 'https://www.light.gg/god-roll/roll-appraiser/data/';

  try {
    // Use cloudscraper to get the data
    const response = await new Promise((resolve, reject) => {
      cloudscraper.get(url, (error, response, body) => {
        if (error) {
          reject(error);
        } else {
          resolve(body);
        }
      });
    });

    // Parse the JSON response
    const data = JSON.parse(response);

    // Ensure directory exists
    const dir = path.dirname('light/rollAppraiserData.json');
    await fs.mkdir(dir, { recursive: true });

    // Save the data to a file
    await fs.writeFile('light/rollAppraiserData.json', JSON.stringify(data, null, 4), 'utf-8');

    console.log('Successfully downloaded and saved the data to light/rollAppraiserData.json');
  } catch (error) {
    console.error(`An error occurred: ${error.message || error}`);
    if (error.statusCode === 403 || (error.message && error.message.includes('403'))) {
      console.error("If the error is still a 403, the site's protection may have been updated.");
    }
  }
}

// Check if this file is being run directly
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename;

if (isMainModule) {
  downloadGodRollData();
}

// Export for use as module
export default downloadGodRollData;
export { downloadGodRollData };
