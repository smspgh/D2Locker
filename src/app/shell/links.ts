/** Shared constants for external links that may be used on multiple pages. */

export const bungieHelpLink = 'https://mastodon.social/@bungiehelp';
export const discordLink = 'https://discord.gg/UK2GWC7';
export const userGuideLink = 'https://guide.d2l.gg';
export const wishListGuideLink =
  'https://github.com/DestinyItemManager/D2L/wiki/Creating-Wish-Lists';
export const bungieHelpAccount = '@BungieHelp';

export function userGuideUrl(topic: string) {
  return `${userGuideLink}/${topic}`;
}

export const troubleshootingLink = userGuideUrl('Troubleshooting');
