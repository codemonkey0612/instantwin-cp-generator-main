import { useEffect, useCallback, useMemo } from "react";
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

    if (campaign?.participantAuthMethod === "required" && !isLoggedIn) {
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
    userParticipationRequest,
    hasTicket,
    allParticipantRecords,
    modalState,
    formState,
    interactionState,
    performLottery,
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
            isParticipating.current = true;
            await auth.signInWithEmailLink(email, window.location.href);
            window.localStorage.removeItem("emailForSignIn");
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

    if (isParticipating.current && user) {
      isParticipating.current = false;

      if (
        modalStep === "auth" &&
        campaign?.participantAuthMethod === "required"
      ) {
        modalState.setIsAuthLoading(false);
        setModalStep("confirm");
      } else if (promptToSaveResult) {
        closeModal();
        loadParticipantData();
      } else {
        continueParticipationFlow();
      }
    } else if (promptToSaveResult && user && !user.isAnonymous) {
      modalState.setPromptToSaveResult(false);
    }
  }, [
    user,
    campaign,
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
  ]);

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

    if (user) {
      continueParticipationFlow();
      return;
    }

    if (campaign?.participantAuthMethod === "required") {
      setModalStep("auth");
      return;
    }

    try {
      isParticipating.current = true;
      await auth.signInAnonymously();
    } catch (error) {
      isParticipating.current = false;
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
      (user === null || user.isAnonymous),
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
