import { getToken } from '../bungie-api/oauth-tokens';

/**
 * A Bungie account is an account on Bungie.net, which is associated
 * with one or more Destiny accounts.
 */
export interface BungieAccount {
  /** Bungie.net membership ID */
  membershipId: string;
}

/**
 * Get the Bungie accounts for this D2L user. For now, we only have one (or none if you're not logged in).
 *
 * A D2L user may associate one or more Bungie.net accounts with their
 * D2L account. These accounts are identified with a membership ID,
 * and have references to one or more Destiny accounts.
 */
export function getBungieAccount(): BungieAccount | undefined {
  const token = getToken();
  
  console.log('🔍 getBungieAccount called - Token check:', {
    tokenExists: !!token,
    bungieMembershipId: token?.bungieMembershipId,
    hasAccessToken: !!token?.accessToken,
    hasRefreshToken: !!token?.refreshToken
  });

  if (token?.bungieMembershipId) {
    return {
      membershipId: token.bungieMembershipId,
    };
  }
  
  console.log('❌ getBungieAccount returning undefined - no valid token');
}
