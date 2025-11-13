import { useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { firebase, auth } from "../firebase";
import type { Prize, Participant } from "../types";
import {
  getContrastingTextColor,
  formatDate,
  isPrizeDateValid,
} from "./campaignPageUtils";

import { useCampaignData } from "./hooks/useCampaignData";
import { useCampaignState } from "./hooks/useCampaignState";
import { useCampaignActions } from "./hooks/useCampaignActions";
import { captureException } from "@sentry/react";
import { 
  isAuthenticatedForCampaign, 
  setCampaignAuth, 
  getAndClearStoredCampaignId,
  storePendingParticipationCampaign,
  getAndClearPendingParticipationCampaign
} from "../utils/campaignAuth";

export type PresentationTexts = {
  multiParticipationButton: (n: number) => string;
  winDetailsTitle: string;
  winCount: (n: number) => string;
  singleWinText: string;
  prizeListTitle: string;
  resultTitle: string;
  remainingChances: (n: number) => string;
  drawing: string;
  multipleResultsText: (n: number) => string;
  prizeDetails: string;
  wonPrizeTapInstruction: string;
  prizeTapInstruction: string;
  saveResultPrompt: string;
  resultNote: string;
  agreeAndParticipate: string;
  limitReached: string;
};

export const useCampaignPage = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  
  // Clear pending participation when switching to a different campaign
  // This ensures participation from one campaign doesn't trigger in another
  useEffect(() => {
    if (campaignId) {
      // Check if there's a pending participation for a different campaign
      const pendingCampaignId = window.localStorage.getItem("pendingParticipationCampaign");
      if (pendingCampaignId && pendingCampaignId !== campaignId) {
        // Clear the pending participation if it's for a different campaign
        window.localStorage.removeItem("pendingParticipationCampaign");
        // Also reset isParticipating to prevent cross-campaign participation
        isParticipating.current = false;
      }
    }
  }, [campaignId]);

  // --- DATA HOOK ---
  const {
    campaign,
    loading,
    error,
    user,
    campaignRef,
    allParticipantRecords,
    setAllParticipantRecords,
    participantRecord,
    setParticipantRecord,
    participationCount,
    setParticipationCount,
    extraChances,
    userParticipationRequest,
    setUserParticipationRequest,
    lastTicketToken,
    isRequiredTicket,
    hasTicket,
    nextAvailableTime,
    timeLeftMessage,
    loadParticipantData,
  } = useCampaignData(campaignId);

  const isAuthenticatedForThisCampaign = campaignId
    ? isAuthenticatedForCampaign(campaignId)
    : false;

  // --- STATE HOOKS ---
  const { modalState, formState, interactionState } = useCampaignState();

  const presentationTexts = useMemo((): PresentationTexts => {
    const type = campaign?.presentationSettings?.type || "simple";
    switch (type) {
      case "lottery-box":
        return {
          multiParticipationButton: (n: number) => `${n}回くじを引く`,
          winDetailsTitle: "獲得内容",
          winCount: (n: number) => `${n}回当選`,
          singleWinText: "獲得",
          prizeListTitle: "景品一覧",
          resultTitle: "くじ引き結果",
          remainingChances: (n: number) => `残りくじ引き回数: ${n}回`,
          drawing: "くじ引き中...",
          multipleResultsText: (n: number) =>
            `${n}回のくじ引きの結果はこちらです。`,
          prizeDetails: "景品詳細",
          wonPrizeTapInstruction:
            "当選した景品は景品一覧からもご確認いただけます",
          prizeTapInstruction: "景品をタップすると詳細を確認できます",
          saveResultPrompt: "くじ引きの結果を保存しませんか？",
          resultNote: "当選した景品は景品一覧からもご確認いただけます",
          agreeAndParticipate: "同意して実施する",
          limitReached: "実施回数の上限に達しました。",
        };
      case "gacha":
        return {
          multiParticipationButton: (n: number) => `${n}回ガチャを回す`,
          winDetailsTitle: "ガチャの中身",
          winCount: (n: number) => `${n}回獲得`,
          singleWinText: "獲得",
          prizeListTitle: "ガチャの中身",
          resultTitle: "獲得特典",
          remainingChances: (n: number) => `残りガチャ回数: ${n}回`,
          drawing: "ガチャ実行中...",
          multipleResultsText: (n: number) =>
            `${n}回のガチャの結果はこちらです。`,
          prizeDetails: "ガチャの中身詳細",
          wonPrizeTapInstruction:
            "獲得した中身をタップすると、取得・使用について案内が表示されます",
          prizeTapInstruction: "ガチャの中身をタップすると詳細を確認できます",
          saveResultPrompt: "ガチャの結果を保存しませんか？",
          resultNote: "獲得したガチャの中身は一覧からもご確認いただけます",
          agreeAndParticipate: "同意して実施する",
          limitReached: "実施回数の上限に達しました。",
        };
      case "scratch":
        return {
          multiParticipationButton: (n: number) => `${n}枚スクラッチを削る`,
          winDetailsTitle: "獲得特典内容",
          winCount: (n: number) => `${n}回獲得`,
          singleWinText: "獲得",
          prizeListTitle: "特典一覧",
          resultTitle: "獲得特典",
          remainingChances: (n: number) => `残り挑戦回数: ${n}回`,
          drawing: "スクラッチ削り中...",
          multipleResultsText: (n: number) =>
            `${n}枚のスクラッチの結果はこちらです。`,
          prizeDetails: "特典詳細",
          wonPrizeTapInstruction:
            "獲得した特典をタップすると、取得・使用について案内が表示されます",
          prizeTapInstruction: "特典をタップすると詳細を確認できます",
          saveResultPrompt: "獲得特典を保存しませんか？",
          resultNote: "獲得した特典は特典一覧からもご確認いただけます",
          agreeAndParticipate: "同意して実施する",
          limitReached: "実施回数の上限に達しました。",
        };
      case "simple":
      default:
        return {
          multiParticipationButton: (n: number) => `${n}回抽選する`,
          winDetailsTitle: "当選内容",
          winCount: (n: number) => `${n}回当選`,
          singleWinText: "当選",
          prizeListTitle: "景品一覧",
          resultTitle: "抽選結果",
          remainingChances: (n: number) => `残り抽選回数: ${n}回`,
          drawing: "抽選中...",
          multipleResultsText: (n: number) => `${n}回の抽選結果はこちらです。`,
          prizeDetails: "景品詳細",
          wonPrizeTapInstruction:
            "当選した景品は景品一覧からもご確認いただけます",
          prizeTapInstruction: "景品をタップすると詳細を確認できます",
          saveResultPrompt: "抽選結果を保存しませんか？",
          resultNote: "当選した景品は景品一覧からもご確認いただけます",
          agreeAndParticipate: "同意して参加する",
          limitReached: "参加回数の上限に達しました。",
        };
    }
  }, [campaign?.presentationSettings?.type]);

  // If tickets or forms are required, the base limit is 0. Chances come from tickets/approval (`extraChances`).
  // Otherwise, use the campaign's default limit.
  const limit =
    campaign?.requireTicket || campaign?.requireFormApproval
      ? 0
      : campaign?.participationLimitPerUser || 0;

  const effectiveLimit = limit + extraChances;
  const availableChances = Math.max(0, effectiveLimit - participationCount);

  // --- ACTIONS HOOK ---
  const {
    isParticipating,
    performLottery,
    handleConfirmAndParticipate,
    handleUseCoupon,
    confirmCouponUsage,
    handleAddressSubmit,
    handleApprovalFormSubmit,
    handleInquirySubmit,
    handleApprovalFileUpload,
  } = useCampaignActions({
    campaign,
    user,
    campaignId,
    allParticipantRecords,
    setAllParticipantRecords,
    setParticipantRecord,
    setParticipationCount,
    modalState,
    formState,
    interactionState,
    loadParticipantData,
    availableChances,
  });

  const { modalStep, setModalStep, promptToSaveResult, closeModal } =
    modalState;

  // Ref to track if redirect result has been processed (only process once)
  const redirectProcessedRef = useRef(false);

  const continueParticipationFlow = useCallback(() => {
    if (!user) {
      return;
    }
    const isLoggedIn = user && !user.isAnonymous;

    if (
      campaign?.requireFormApproval &&
      userParticipationRequest?.status !== "approved"
    ) {
      if (userParticipationRequest?.status === "pending") {
        modalState.setAuthError("参加申請は現在審査中です。");
        return;
      }
      formState.setShowApprovalFormModal(true);
      return;
    }

    if (campaign?.requireTicket && !hasTicket) {
      interactionState.setShowTicketRequiredModal(true);
      return;
    }

    // Check participation interval restriction
    if (nextAvailableTime && nextAvailableTime.getTime() > Date.now()) {
      // Interval has not passed yet - the button should already be disabled
      // but we check here as well for safety
      return;
    }

    // Check if campaign requires authentication and if user is authenticated for this campaign
    const requiresAuth = campaign?.participantAuthMethod === "required";

    if (requiresAuth && (!isLoggedIn || !isAuthenticatedForThisCampaign)) {
      setModalStep("auth");
    } else {
      const hasParticipatedBefore = allParticipantRecords.length > 0;
      const needsConfirmation =
        !hasParticipatedBefore &&
        ((campaign?.questionnaireFields?.length || 0) > 0 ||
          campaign?.pageContent?.termsOfServiceEnabled);
      if (needsConfirmation) {
        setModalStep("confirm");
      } else {
        formState.pendingAnswersRef.current = {};
        performLottery(formState.useMultipleChances);
      }
    }
  }, [
    user,
    campaign,
    campaignId,
    userParticipationRequest,
    hasTicket,
    allParticipantRecords,
    modalState,
    formState,
    interactionState,
    performLottery,
    nextAvailableTime,
  ]);

  useEffect(() => {
    const completeSignInWithEmailLink = async () => {
      if (auth.isSignInWithEmailLink(window.location.href)) {
        let email = window.localStorage.getItem("emailForSignIn");
        if (!email)
          email = window.prompt(
            "認証を完了するために、メールアドレスを再度入力してください。",
          );
        if (email) {
          try {
            // DO NOT set isParticipating here - participation should only happen when user clicks the button
            await auth.signInWithEmailLink(email, window.location.href);
            window.localStorage.removeItem("emailForSignIn");
            
            // Mark campaign as authenticated after email link sign-in
            const storedCampaignId = getAndClearStoredCampaignId();
            if (storedCampaignId && campaignId === storedCampaignId) {
              setCampaignAuth(campaignId);
            } else if (campaignId) {
              setCampaignAuth(campaignId);
            }
            
            if (window.history?.replaceState) {
              window.history.replaceState(
                {},
                document.title,
                window.location.pathname + window.location.hash.split("?")[0],
              );
            }
          } catch (e) {
            captureException(e, { level: "error" });
          }
        }
      }
    };
    completeSignInWithEmailLink();

    // Check if user is authenticated for this campaign (check this first, before isParticipating check)
    const isLoggedIn = user && !user.isAnonymous;
    const requiresAuth = campaign?.participantAuthMethod === "required";

    // Debug logging
    if (modalStep === "auth" && requiresAuth) {
      console.log("Auth check:", {
        isLoggedIn,
        isAuthenticatedForThisCampaign,
        campaignId,
        userId: user?.uid,
        isAnonymous: user?.isAnonymous,
      });
    }

    // If user is authenticated and modal is showing auth, proceed to next step immediately
    if (
      modalStep === "auth" &&
      requiresAuth &&
      isLoggedIn &&
      isAuthenticatedForThisCampaign
    ) {
      console.log("Proceeding to confirm step - user is authenticated");
      modalState.setIsAuthLoading(false);
      setModalStep("confirm");
    }

    // Only process participation if it's for THIS campaign
    // This prevents Campaign A's authentication from triggering participation in Campaign B
    if (isParticipating.current && user) {
      // Check if the pending participation is for the current campaign (check before clearing)
      const pendingCampaignId = window.localStorage.getItem("pendingParticipationCampaign");
      
      // Only proceed if the pending participation matches the current campaign
      // If there's no pending campaign ID, we can't verify it's for this campaign, so we ignore it
      if (pendingCampaignId !== campaignId) {
        console.log("Ignoring participation from different campaign:", {
          pendingCampaignId,
          currentCampaignId: campaignId
        });
        isParticipating.current = false;
        // Clear the pending participation for the other campaign
        if (pendingCampaignId) {
          window.localStorage.removeItem("pendingParticipationCampaign");
        }
        return;
      }
      
      // Clear the pending participation now that we've verified it's for this campaign
      if (pendingCampaignId) {
        window.localStorage.removeItem("pendingParticipationCampaign");
      }
      isParticipating.current = false;

      if (
        modalStep === "auth" &&
        campaign?.participantAuthMethod === "required"
      ) {
        // If user just authenticated and is now authenticated for this campaign, proceed
        if (isLoggedIn && isAuthenticatedForThisCampaign) {
        modalState.setIsAuthLoading(false);
        setModalStep("confirm");
        } else {
          // Still not authenticated, keep showing auth modal
          modalState.setIsAuthLoading(false);
        }
      } else if (promptToSaveResult) {
        closeModal();
        loadParticipantData();
      } else {
        continueParticipationFlow();
      }
    } else if (
      promptToSaveResult &&
      user &&
      !user.isAnonymous &&
      isAuthenticatedForThisCampaign
    ) {
      modalState.setPromptToSaveResult(false);
    }
  }, [
    user,
    campaign,
    campaignId,
    modalStep,
    promptToSaveResult,
    navigate,
    loadParticipantData,
    performLottery,
    closeModal,
    setModalStep,
    modalState,
    formState,
    interactionState,
    allParticipantRecords,
    hasTicket,
    userParticipationRequest,
    continueParticipationFlow,
    isAuthenticatedForThisCampaign,
    isAuthenticatedForCampaign,
    setCampaignAuth,
    getAndClearStoredCampaignId,
  ]);

  // Handle Firebase Auth redirect result (for Google sign-in, etc.)
  // This must be called once when the page loads after redirect
  useEffect(() => {
    if (redirectProcessedRef.current) return;
    
    const handleRedirectResult = async () => {
      try {
        console.log("Checking for redirect result...");
        console.log("Current URL:", window.location.href);
        console.log("URL search params:", window.location.search);
        console.log("Current user before getRedirectResult:", auth.currentUser?.uid, auth.currentUser?.isAnonymous);
        
        // Check if we have a stored campaign ID (meaning we initiated auth)
        const storedCampaignId = window.localStorage.getItem("pendingCampaignAuth");
        console.log("Stored campaign ID (pendingCampaignAuth):", storedCampaignId);
        
        // Check if there are any URL parameters that indicate we're coming from a redirect
        const urlParams = new URLSearchParams(window.location.search);
        const hasRedirectParams =
          urlParams.has("apiKey") ||
          urlParams.has("mode") ||
          urlParams.has("oobCode") ||
          urlParams.has("continueUrl") ||
          urlParams.has("code") ||
          urlParams.has("state");
        
        // If there's no pending campaign and no redirect parameters, skip processing
        if (!storedCampaignId && !hasRedirectParams) {
          console.log("No pending campaign auth or redirect params detected - skipping getRedirectResult");
          redirectProcessedRef.current = true;
          return;
        }
        
        // If we have a stored campaign ID but no redirect params and no user,
        // this is likely a stale stored ID from a previous failed attempt
        // Clear it immediately to allow new login attempts
        if (storedCampaignId && !hasRedirectParams && !auth.currentUser) {
          console.log("Clearing stale stored campaign ID - no active redirect detected");
          console.log("This allows new login attempts to proceed");
          window.localStorage.removeItem("pendingCampaignAuth");
          // Don't return here - still check for redirect result in case auth state updates
        }
        
        // Wait for auth to be ready (sometimes it takes a moment)
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const result = await auth.getRedirectResult();
        console.log("Redirect result:", result);
        console.log("Current user after getRedirectResult:", auth.currentUser?.uid, auth.currentUser?.isAnonymous);
        
        if (result.user && !result.user.isAnonymous) {
          console.log("Redirect result: User authenticated", result.user.uid, result.user.email);
          // User successfully signed in via redirect
          const clearedCampaignId = getAndClearStoredCampaignId();
          console.log("Cleared stored campaign ID:", clearedCampaignId, "Current campaign ID:", campaignId);
          
          // Always set campaign auth for the current campaign if we're on a campaign page
          // DO NOT set isParticipating here - participation should only happen when user clicks the button
          if (campaignId) {
            setCampaignAuth(campaignId);
            console.log("Campaign auth set for:", campaignId);
          } else if (clearedCampaignId) {
            // If we have a stored campaign ID but not on a campaign page, set it anyway
            setCampaignAuth(clearedCampaignId);
            console.log("Campaign auth set for stored ID:", clearedCampaignId);
          }
          redirectProcessedRef.current = true;
        } else if (result.user && result.user.isAnonymous) {
          console.log("Redirect result: Got anonymous user (unexpected)");
          redirectProcessedRef.current = true;
        } else {
          console.log("Redirect result: No user - result:", result);
          console.log("Stored campaign ID still exists:", window.localStorage.getItem("pendingCampaignAuth"));
          // getRedirectResult returned null - this is common if:
          // 1. No redirect happened
          // 2. Redirect was already processed
          // 3. Authorized domains not configured (localhost not in authorized domains)
          // 4. Redirect was cancelled or failed
          
          // Check if we're on localhost and might have domain issues
          const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          if (isLocalhost && storedCampaignId) {
            console.warn("⚠️ Running on localhost - make sure 'localhost' is added to Firebase Authorized Domains");
            console.warn("Go to Firebase Console → Authentication → Settings → Authorized domains");
          }
          
          // Check if there are any URL parameters that might indicate a failed redirect
          const urlParams = new URLSearchParams(window.location.search);
          const hasAuthParams = urlParams.has('error') || urlParams.has('code') || urlParams.has('state');
          if (hasAuthParams) {
            console.log("URL has auth-related parameters:", Object.fromEntries(urlParams.entries()));
          }
          
          // If we have a stored campaign ID but no user and no redirect result,
          // and we're not coming from a redirect (no auth params), the redirect might have failed
          // Clear the stored campaign ID after a delay to allow auth state to update
          if (storedCampaignId && !hasAuthParams) {
            console.log("Have stored campaign ID but no redirect result and no auth params - redirect may have failed");
            console.log("This could mean:");
            console.log("1. The redirect was cancelled by the user");
            console.log("2. The redirect failed (e.g., 'page not found' error)");
            console.log("3. The redirect completed but Firebase didn't process it");
            // Wait a bit for auth state to potentially update
            setTimeout(() => {
              const currentUser = auth.currentUser;
              if (!currentUser || currentUser.isAnonymous) {
                console.log("Still no authenticated user after delay - clearing stored campaign ID");
                window.localStorage.removeItem("pendingCampaignAuth");
                // If we're still on the auth modal step, we should show an error or reset
                if (modalStep === "auth") {
                  console.log("User is still on auth step - they may need to try logging in again");
                }
              }
            }, 2000);
          }
          
          // We'll rely on onAuthStateChanged fallback instead
          // But also check if user is already authenticated (maybe from previous session)
          if (storedCampaignId) {
            console.log("Have stored campaign ID but no redirect result - will wait for auth state change");
            // Also check immediately if user is already authenticated
            const currentUser = auth.currentUser;
            if (currentUser && !currentUser.isAnonymous) {
              console.log("User is already authenticated - setting campaign auth now");
          // DO NOT set isParticipating here - participation should only happen when user clicks the button
          if (campaignId && campaignId === storedCampaignId) {
            setCampaignAuth(campaignId);
            window.localStorage.removeItem("pendingCampaignAuth");
          } else if (!campaignId && storedCampaignId) {
            setCampaignAuth(storedCampaignId);
            window.localStorage.removeItem("pendingCampaignAuth");
          }
            }
          }
          redirectProcessedRef.current = true;
        }
      } catch (error: any) {
        // Redirect result might fail if there's no pending redirect
        // This is expected and not an error, but log it for debugging
        console.error("Redirect result error:", error);
        if (error.code !== "auth/operation-not-allowed") {
          console.log("Redirect result error details:", error.code, error.message);
        }
        redirectProcessedRef.current = true;
      }
    };
    
    // Call immediately on mount
    handleRedirectResult();
  }, [campaignId, setCampaignAuth, getAndClearStoredCampaignId]);

  // Also listen for auth state changes to catch authentication that happens via redirect
  // This is a fallback in case getRedirectResult doesn't work
  // Use a ref to track the previous user state
  const previousUserRef = useRef<any>(null);
  const authStateChangeProcessedRef = useRef(false);
  
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((newUser) => {
      const previousUser = previousUserRef.current;
      previousUserRef.current = newUser;
      
      console.log("Auth state changed:", {
        previousUser: previousUser?.uid || "null",
        previousIsAnonymous: previousUser?.isAnonymous,
        newUser: newUser?.uid || "null",
        newIsAnonymous: newUser?.isAnonymous,
        hasStoredCampaignId: !!window.localStorage.getItem("pendingCampaignAuth"),
      });
      
      // Only process if we have a stored campaign ID (meaning we initiated auth)
      const storedCampaignId = window.localStorage.getItem("pendingCampaignAuth");
      
      // Check if user just authenticated (was anonymous/null, now authenticated)
      const justAuthenticated = 
        (!previousUser || previousUser.isAnonymous) && 
        newUser && 
        !newUser.isAnonymous;
      
      if (storedCampaignId && justAuthenticated && !authStateChangeProcessedRef.current) {
        console.log("Auth state changed: User just authenticated via redirect", newUser.uid, newUser.email);
        console.log("Stored campaign ID:", storedCampaignId, "Current campaign ID:", campaignId);
        
        authStateChangeProcessedRef.current = true;
        
        // DO NOT set isParticipating here - participation should only happen when user clicks the button
        if (campaignId && campaignId === storedCampaignId) {
          setCampaignAuth(campaignId);
          console.log("Campaign auth set via auth state change:", campaignId);
          // Clear the stored campaign ID
          window.localStorage.removeItem("pendingCampaignAuth");
        } else if (!campaignId && storedCampaignId) {
          // Use stored campaign ID if we're not on a campaign page
          setCampaignAuth(storedCampaignId);
          console.log("Campaign auth set for stored ID:", storedCampaignId);
          window.localStorage.removeItem("pendingCampaignAuth");
        }
      } else if (!newUser) {
        // User signed out, reset flags
        authStateChangeProcessedRef.current = false;
    } else if (newUser && !newUser.isAnonymous && storedCampaignId && !authStateChangeProcessedRef.current) {
        // User is already authenticated but we have a stored campaign ID
        // This might happen if the page reloaded after auth but before we processed it
        console.log("User already authenticated with stored campaign ID - processing now");
        authStateChangeProcessedRef.current = true;
        
        // DO NOT set isParticipating here - participation should only happen when user clicks the button
        if (campaignId && campaignId === storedCampaignId) {
          setCampaignAuth(campaignId);
          console.log("Campaign auth set for already-authenticated user:", campaignId);
          window.localStorage.removeItem("pendingCampaignAuth");
        } else if (!campaignId && storedCampaignId) {
          setCampaignAuth(storedCampaignId);
          console.log("Campaign auth set for stored ID (already-authenticated):", storedCampaignId);
          window.localStorage.removeItem("pendingCampaignAuth");
        }
      }
    });
    
    return unsubscribe;
  }, [campaignId, setCampaignAuth]);

  useEffect(() => {
    if (modalState.authView === "sms_phone") {
      if (modalState.recaptchaVerifierRef.current)
        modalState.recaptchaVerifierRef.current.clear();
      try {
        modalState.recaptchaVerifierRef.current =
          new firebase.auth.RecaptchaVerifier("recaptcha-container", {
            "size": "invisible",
            "callback": () => {},
          });
        modalState.recaptchaVerifierRef.current.render().catch((err: any) => {
          captureException(err, { level: "error" });
        });
      } catch (e) {
        captureException(e, { level: "error" });
      }
    }
  }, [modalState.authView]);

  const handleAuthInitiation = async () => {
    modalState.setAuthError(null);

    // Mark that user wants to participate - this ensures participation continues after authentication
    // This is set when user clicks the button, not when authentication happens
    isParticipating.current = true;
    if (campaignId) {
      storePendingParticipationCampaign(campaignId);
    }

    // Check if campaign requires authentication and if user is authenticated for this campaign
    const requiresAuth = campaign?.participantAuthMethod === "required";
    const isAuthenticatedForThisCampaign = campaignId 
      ? isAuthenticatedForCampaign(campaignId)
      : false;

    if (user) {
      // If user is logged in but campaign requires auth and they're not authenticated for this campaign
      if (requiresAuth && !isAuthenticatedForThisCampaign) {
        setModalStep("auth");
        return;
      }
      continueParticipationFlow();
      return;
    }

    if (campaign?.participantAuthMethod === "required") {
      setModalStep("auth");
      return;
    }

    try {
      await auth.signInAnonymously();
    } catch (error) {
      isParticipating.current = false;
      if (campaignId) {
        getAndClearPendingParticipationCampaign();
      }
      modalState.setAuthError(
        "参加処理の準備に失敗しました。ページを再読み込みしてください。",
      );
      captureException(error, { level: "error" });
    }
  };

  const now = new Date();
  let isWithinApplicationPeriod = true;
  if (campaign?.applicationStartDate && now < campaign.applicationStartDate)
    isWithinApplicationPeriod = false;
  if (campaign?.applicationEndDate && now > campaign.applicationEndDate)
    isWithinApplicationPeriod = false;

  const allPrizesInCampaign = [
    ...(campaign?.prizes || []),
    campaign?.consolationPrize,
  ].filter((p): p is Prize => !!p && !!p.title);
  const participationBlockedByStock =
    !allPrizesInCampaign.some((p) => p.unlimitedStock || (p.stock || 0) > 0) &&
    campaign?.outOfStockBehavior === "prevent_participation";

  const hasReachedLimit = useMemo(() => {
    if (campaign?.requireFormApproval) {
      if (
        !userParticipationRequest ||
        userParticipationRequest.status === "rejected"
      ) {
        return false; // Can always apply or re-apply.
      }
      if (userParticipationRequest.status === "pending") {
        return true; // Is "limited" from participating while pending.
      }
      // If approved, the availableChances logic applies.
      return availableChances <= 0;
    }

    const isUnlimited = limit === 0 && !campaign?.requireTicket;
    if (isUnlimited) return false;

    return availableChances <= 0;
  }, [campaign, userParticipationRequest, availableChances, limit]);

  const limitMessage = useMemo(() => {
    if (
      campaign?.requireFormApproval &&
      userParticipationRequest?.status === "pending"
    ) {
      return "参加申請は現在審査中です。";
    }

    if (
      campaign?.requireTicket &&
      !hasTicket &&
      (!campaign.participantAuthMethod ||
        campaign.participantAuthMethod === "anonymous")
    ) {
      return "参加券が必要です。";
    }

    return presentationTexts.limitReached;
  }, [campaign, userParticipationRequest, presentationTexts, hasTicket]);

  const truncate = (str: string, num: number) =>
    str.length <= num ? str : str.slice(0, num) + "...";

  const handleShowPrizeDetails = useCallback(
    (prize: Prize | Participant["prizeDetails"]) => {
      const wonRecord = allParticipantRecords.find(
        (p) => p.prizeId === prize.id,
      );

      if (wonRecord) {
        const allWinsForThisPrize = allParticipantRecords.filter(
          (p) => p.prizeId === prize.id,
        );
        const totalWins = allWinsForThisPrize.length;

        if (totalWins > 1) {
          const aggregatedRecord: Participant & {
            totalWins: number;
            assignedUrls?: string[];
            totalUsageLimit?: number;
          } = { ...wonRecord, totalWins };

          if (prize.type === "url") {
            aggregatedRecord.assignedUrls = allWinsForThisPrize
              .map((p) => p.assignedUrl)
              .filter((url): url is string => !!url);
          }
          if (prize.type === "e-coupon") {
            const totalUsedCount = allWinsForThisPrize.reduce(
              (sum, p) => sum + (p.couponUsedCount || 0),
              0,
            );
            aggregatedRecord.couponUsedCount = totalUsedCount;
            aggregatedRecord.totalUsageLimit =
              (prize.couponUsageLimit || 1) * totalWins;
          }
          interactionState.setPrizeDetailsInModal(aggregatedRecord);
        } else {
          interactionState.setPrizeDetailsInModal(wonRecord);
        }
      } else {
        const dummyParticipant: Participant = {
          id: `dummy_${prize.id}`,
          campaignId: campaignId || "",
          userId: "",
          authInfo: { provider: "", identifier: "" },
          wonAt: new Date(),
          prizeId: prize.id,
          prizeDetails: prize as Prize,
        };
        interactionState.setPrizeDetailsInModal(dummyParticipant);
      }
    },
    [allParticipantRecords, campaignId, interactionState],
  );

  return {
    loading,
    error,
    campaign,
    campaignRef,
    user,
    allParticipantRecords,
    setAllParticipantRecords,
    participantRecord,
    setParticipantRecord,
    participationCount,
    extraChances,
    userParticipationRequest,
    setUserParticipationRequest,
    lastTicketToken,
    isRequiredTicket,
    hasTicket,
    nextAvailableTime,
    timeLeftMessage,
    loadParticipantData,
    userId: user?.uid,
    ...modalState,
    ...formState,
    ...interactionState,
    performLottery,
    handleConfirmAndParticipate,
    handleUseCoupon,
    confirmCouponUsage,
    handleAddressSubmit,
    handleApprovalFormSubmit,
    handleInquirySubmit,
    handleApprovalFileUpload,
    handleAuthInitiation,
    handleShowPrizeDetails,
    // Calculated values
    presentationTexts,
    availableChances,
    isWithinApplicationPeriod,
    participationBlockedByStock,
    hasReachedLimit,
    limitMessage,
    allPrizesInCampaign,
    wonPrizeIds: new Set(
      allParticipantRecords
        .filter((p) => p.prizeId !== "loss")
        .map((p) => p.prizeId),
    ),
    shouldShowLoginPromptBanner:
      campaign?.authProviders &&
      Object.values(campaign.authProviders).some((v) => v) &&
      !isAuthenticatedForThisCampaign,
    participationButtonDisabled:
      !!nextAvailableTime ||
      interactionState.isEventParticipationDone ||
      hasReachedLimit,
    contactFieldsToRender: (campaign?.contactFields || []).filter(
      (field) => field.enabled,
    ),
    enabledProviders: campaign
      ? Object.entries(campaign.authProviders || {})
          .filter(([_, v]) => v)
          .map(([k]) => k as keyof typeof campaign.authProviders)
      : [],
    getContrastingTextColor,
    formatDate,
    isPrizeDateValid,
    truncate,
  };
};
