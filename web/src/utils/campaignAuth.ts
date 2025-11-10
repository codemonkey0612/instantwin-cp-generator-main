/**
 * Campaign-specific authentication utilities
 * Ensures users must authenticate separately for each campaign
 */

const CAMPAIGN_AUTH_PREFIX = "campaignAuth:";

/**
 * Store that a user is authenticated for a specific campaign
 * @param campaignId - The campaign ID
 */
export const setCampaignAuth = (campaignId: string): void => {
  if (!campaignId) return;
  const key = `${CAMPAIGN_AUTH_PREFIX}${campaignId}`;
  const timestamp = Date.now();
  window.localStorage.setItem(key, timestamp.toString());
};

/**
 * Check if user is authenticated for a specific campaign
 * @param campaignId - The campaign ID to check
 * @returns true if authenticated for this campaign
 */
export const isAuthenticatedForCampaign = (campaignId: string | undefined): boolean => {
  if (!campaignId) return false;
  const key = `${CAMPAIGN_AUTH_PREFIX}${campaignId}`;
  const authTimestamp = window.localStorage.getItem(key);
  return authTimestamp !== null;
};

/**
 * Clear authentication for a specific campaign
 * @param campaignId - The campaign ID
 */
export const clearCampaignAuth = (campaignId: string | undefined): void => {
  if (!campaignId) return;
  const key = `${CAMPAIGN_AUTH_PREFIX}${campaignId}`;
  window.localStorage.removeItem(key);
};

/**
 * Clear all campaign authentications
 * Useful when user signs out
 */
export const clearAllCampaignAuth = (): void => {
  const keys = Object.keys(window.localStorage);
  keys.forEach((key) => {
    if (key.startsWith(CAMPAIGN_AUTH_PREFIX)) {
      window.localStorage.removeItem(key);
    }
  });
};

/**
 * Get the campaign ID from the current URL
 * @returns campaign ID or null
 */
export const getCampaignIdFromUrl = (): string | null => {
  const path = window.location.pathname;
  // Match /campaign/:campaignId or /ticket/:campaignId or /monitor/:campaignId or /event/:campaignId
  const match = path.match(/\/(campaign|ticket|monitor|event)\/([^/]+)/);
  return match ? match[2] : null;
};

/**
 * Store campaign ID in return URL for OAuth redirects
 * @param campaignId - The campaign ID
 */
export const storeCampaignIdForAuth = (campaignId: string | undefined): void => {
  if (!campaignId) return;
  window.localStorage.setItem("pendingCampaignAuth", campaignId);
};

/**
 * Get and clear stored campaign ID from OAuth redirect
 * @returns campaign ID or null
 */
export const getAndClearStoredCampaignId = (): string | null => {
  const campaignId = window.localStorage.getItem("pendingCampaignAuth");
  if (campaignId) {
    window.localStorage.removeItem("pendingCampaignAuth");
  }
  return campaignId;
};

