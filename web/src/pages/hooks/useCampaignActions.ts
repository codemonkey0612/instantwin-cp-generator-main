import React, { useCallback, useRef } from "react";
import { firebase, db, storage, Timestamp } from "../../firebase";
import type { Campaign, Participant } from "../../types";
import { runLotteryTransaction, isPrizeDateValid } from "../campaignPageUtils";
import { captureException } from "@sentry/react";

type UseCampaignActionsProps = {
  campaign: Campaign | null;
  user: firebase.User | null;
  campaignId: string | undefined;
  allParticipantRecords: Participant[];
  setAllParticipantRecords: React.Dispatch<React.SetStateAction<Participant[]>>;
  setParticipantRecord: React.Dispatch<
    React.SetStateAction<Participant | null>
  >;
  setParticipationCount: React.Dispatch<React.SetStateAction<number>>;
  modalState: any; // From useCampaignState
  formState: any; // From useCampaignState
  interactionState: any; // From useCampaignState
  loadParticipantData: (preserveCurrentRecord?: boolean) => void;
  availableChances: number;
};

export const useCampaignActions = ({
  campaign,
  user,
  campaignId,
  allParticipantRecords,
  setParticipantRecord,
  setParticipationCount,
  modalState,
  formState,
  interactionState,
  loadParticipantData,
  availableChances,
}: UseCampaignActionsProps) => {
  const {
    setModalStep,
    setAuthError,
    setPromptToSaveResult,
    setMultipleLotteryResults,
  } = modalState;

  const {
    useMultipleChances,
    setUseMultipleChances,
    setQuestionnaireError,
    pendingAnswersRef,
    setApprovalFormError,
    setIsSubmittingApproval,
    setApprovalFormSuccess,
    setInquiryError,
    setIsSubmittingInquiry,
    setInquirySuccess,
  } = formState;

  const {
    setPrizeDetailsInModal,
    setIsSubmittingAddress,
    setShowStoreSelectionModal,
    setSelectedStore,
    setShowCouponUsedConfirmation,
  } = interactionState;

  const isParticipating = useRef(false);

  const performLottery = useCallback(
    async (useMultiple: boolean) => {
      setAuthError(null);
      setModalStep("participating");
      setMultipleLotteryResults([]); // clear stale multi-results from previous participation

      const currentUser = user;
      if (!campaignId || !currentUser || !campaign) {
        setAuthError("認証情報またはキャンペーン情報が取得できませんでした。");
        setModalStep("auth");
        return;
      }

      const chancesToUse = useMultiple ? availableChances : 1;
      if (chancesToUse <= 0) {
        setAuthError("抽選回数がありません。");
        setModalStep("closed");
        return;
      }

      try {
        const participantsQuery = db
          .collection("participants")
          .where("campaignId", "==", campaignId)
          .where("userId", "==", currentUser.uid);
        let currentAlreadyWonPrizeIds = new Set<string>();
        
        // Get last participation time for interval check
        const freshParticipantsSnap = await participantsQuery.get();
        let lastParticipationTime: Date | null = null;
        
        if (!freshParticipantsSnap.empty) {
          const records = freshParticipantsSnap.docs.map((doc) => {
            const data = doc.data();
            return {
              ...data,
              wonAt: data.wonAt?.toDate(),
            } as Participant;
          });
          
          // Find most recent participation
          const sortedRecords = records.sort(
            (a, b) => (b.wonAt?.getTime() || 0) - (a.wonAt?.getTime() || 0),
          );
          if (sortedRecords.length > 0 && sortedRecords[0].wonAt) {
            lastParticipationTime = sortedRecords[0].wonAt;
          }
          
        if (campaign.preventDuplicatePrizes) {
          currentAlreadyWonPrizeIds = new Set(
              records
              .filter((p) => !p.isConsolationPrize)
              .map((p) => p.prizeId),
          );
          }
        }

        if (useMultiple && chancesToUse > 1) {
          const results: Participant[] = [];
          for (let i = 0; i < chancesToUse; i++) {
            const result = await runLotteryTransaction({
              campaignId,
              user: currentUser,
              alreadyWonPrizeIds: currentAlreadyWonPrizeIds,
              pendingAnswers: pendingAnswersRef.current || {},
              lastParticipationTime: i === 0 ? lastParticipationTime : null, // Only check interval for first participation
            });
            results.push(result);
            if (
              campaign.preventDuplicatePrizes &&
              result.prizeId !== "loss" &&
              !result.isConsolationPrize
            ) {
              currentAlreadyWonPrizeIds.add(result.prizeId);
            }
            // Update last participation time for next iteration
            if (result.wonAt) {
              lastParticipationTime = result.wonAt;
            }
          }

          setParticipationCount((prev) => prev + chancesToUse);
          setMultipleLotteryResults(results);
          if (useMultipleChances) {
            setUseMultipleChances(false);
          }
          pendingAnswersRef.current = null;
          // Delay reload to allow modal to transition to result step first
          // Pass true to preserveCurrentRecord to avoid clearing the result during transition
          setTimeout(() => {
            loadParticipantData(false);
          }, 3000);
        } else {
          const resultParticipant = await runLotteryTransaction({
            campaignId,
            user: currentUser,
            alreadyWonPrizeIds: currentAlreadyWonPrizeIds,
            pendingAnswers: pendingAnswersRef.current || {},
            lastParticipationTime,
          });

          setParticipationCount((prev) => prev + 1);
          setMultipleLotteryResults([]);
          setParticipantRecord(resultParticipant);
          pendingAnswersRef.current = null;

          if (
            currentUser?.isAnonymous &&
            resultParticipant?.prizeId !== "loss"
          ) {
            setPromptToSaveResult(true);
          }
          // Delay reload to allow modal to transition to result step first
          // The participantRecord is already set above, so we delay reload
          setTimeout(() => {
            loadParticipantData(false);
          }, 3000);
        }
      } catch (error: any) {
        let errorMessage = "抽選に失敗しました。もう一度お試しください。";

        if (error.message === "PARTICIPATION_LIMIT_REACHED") {
          errorMessage = "参加回数の上限に達しました。";
        } else if (error.message === "OUT_OF_STOCK") {
          errorMessage = "申し訳ありません、全ての景品がなくなりました。";
        } else if (error.message?.startsWith("PARTICIPATION_INTERVAL_NOT_PASSED")) {
          // Parse the remaining time from the error message
          const match = error.message.match(/PARTICIPATION_INTERVAL_NOT_PASSED:(\d+):(\d+)/);
          if (match) {
            const hours = parseInt(match[1], 10);
            const minutes = parseInt(match[2], 10);
            if (hours > 0 && minutes > 0) {
              errorMessage = `参加間隔制限により、あと${hours}時間${minutes}分後に参加できます。`;
            } else if (hours > 0) {
              errorMessage = `参加間隔制限により、あと${hours}時間後に参加できます。`;
            } else if (minutes > 0) {
              errorMessage = `参加間隔制限により、あと${minutes}分後に参加できます。`;
            } else {
              errorMessage = "参加間隔制限により、しばらくしてから再度お試しください。";
            }
          } else {
            errorMessage = "参加間隔制限により、しばらくしてから再度お試しください。";
          }
        } else {
          errorMessage = `抽選中にエラーが発生しました: ${error.message}`;
          captureException(error, { level: "error" });
        }

        setAuthError(errorMessage);
        setModalStep("closed");
        loadParticipantData(); // Reload to update nextAvailableTime
      }
    },
    [
      campaignId,
      campaign,
      user,
      loadParticipantData,
      pendingAnswersRef,
      setAuthError,
      setModalStep,
      setPromptToSaveResult,
      availableChances,
      setParticipantRecord,
      setMultipleLotteryResults,
      useMultipleChances,
      setUseMultipleChances,
    ],
  );

  const handleConfirmAndParticipate = () => {
    setQuestionnaireError(null);
    const fields = campaign?.questionnaireFields || [];
    for (const field of fields) {
      if (field.required) {
        const answer = formState.questionnaireAnswers[field.id];
        const isAnswered = Array.isArray(answer)
          ? answer.length > 0
          : answer && String(answer).trim() !== "";
        if (!isAnswered) {
          setQuestionnaireError(`${field.question} は必須項目です。`);
          return;
        }
      }
    }

    const termsContent =
      campaign?.pageContent?.termsOfServiceEnabled &&
      campaign.pageContent.termsOfServiceContent
        ? campaign.pageContent.termsOfServiceContent
        : campaign?.pageContent?.participationGuideType === "custom_text"
          ? campaign.pageContent.participationGuideCustomText
          : "";
    const hasTerms = !!termsContent?.trim();
    if (hasTerms && !formState.termsAgreed) {
      setQuestionnaireError("利用規約への同意が必要です。");
      return;
    }

    pendingAnswersRef.current = formState.questionnaireAnswers;
    performLottery(useMultipleChances);
  };

  const handleUseCoupon = async () => {
    if (!interactionState.prizeDetailsInModal) return;
    const { prizeDetails } = interactionState.prizeDetailsInModal;

    if (!isPrizeDateValid(prizeDetails)) {
      alert("このクーポンは利用可能期間外です。");
      return;
    }

    // Check if there's at least one record with remaining uses
    const prizeId =
      prizeDetails.id ||
      (interactionState.prizeDetailsInModal as Participant).prizeId;
    const recordsForThisPrize = prizeId
      ? allParticipantRecords.filter((p) => p.prizeId === prizeId)
      : [];
    const hasAvailableRecord = recordsForThisPrize.some(
      (p) => (p.couponUsedCount || 0) < (p.prizeDetails.couponUsageLimit || 1),
    );

    if (!hasAvailableRecord) {
      alert("このクーポンは既に使用済みです。");
      return;
    }

    if (
      prizeDetails.type === "e-coupon" &&
      prizeDetails.availableStores &&
      prizeDetails.availableStores.length > 0
    ) {
      setShowStoreSelectionModal(true);
    } else {
      // Set a default store value if no store selection is needed
      if (!interactionState.selectedStore) {
        setSelectedStore("店舗未設定");
      }
      if (
        window.confirm(
          "このクーポンを使用済みにしますか？この操作は元に戻せません。",
        )
      ) {
        await confirmCouponUsage();
      }
    }
  };

  // FIX: Refactored to not take arguments and use state from closure scope.
  const confirmCouponUsage = async () => {
    const { prizeDetailsInModal, selectedStore } = interactionState;
    if (!prizeDetailsInModal) return;

    // Use default store if not selected (for coupons without store selection)
    const storeToUse = selectedStore || "店舗未設定";

    if (!isPrizeDateValid(prizeDetailsInModal)) {
      alert("このクーポンは利用可能期間外です。");
      return;
    }

    const prizeId =
      prizeDetailsInModal.prizeId || prizeDetailsInModal.prizeDetails?.id;
    const recordsForThisPrize = prizeId
      ? allParticipantRecords.filter((p) => p.prizeId === prizeId)
      : [];
    const targetRecord = recordsForThisPrize.find(
      (p) => (p.couponUsedCount || 0) < (p.prizeDetails.couponUsageLimit || 1),
    );

    if (!targetRecord) {
      alert("エラー: 利用可能なクーポンが見つかりませんでした。");
      setShowStoreSelectionModal(false);
      setSelectedStore(null);
      return;
    }

    try {
      // Use transaction to ensure atomicity - both couponUsedCount and couponUsageHistory
      // must be updated together to prevent data inconsistencies
      const participantRef = db.collection("participants").doc(targetRecord.id);
      await db.runTransaction(async (transaction) => {
        const participantDoc = await transaction.get(participantRef);
        if (!participantDoc.exists) {
          throw new Error("Participant record not found");
        }

        const currentData = participantDoc.data();
        const currentCount = currentData?.couponUsedCount || 0;
        const currentHistory = currentData?.couponUsageHistory || [];
        // Use the individual record's usage limit, not the aggregated totalUsageLimit
        const usageLimit = targetRecord.prizeDetails.couponUsageLimit || 1;

        // Verify usage limit - check if there's at least 1 use remaining
        if (currentCount >= usageLimit) {
          throw new Error("Usage limit already reached");
        }

        // Prepare new values atomically
        const newCount = currentCount + 1;
        const newHistoryEntry = { store: storeToUse, usedAt: Timestamp.now() };
        const newHistory = [...currentHistory, newHistoryEntry];

        // Update both fields atomically in transaction
        transaction.update(participantRef, {
          couponUsedCount: newCount,
          couponUsageHistory: newHistory,
        });
      });

      loadParticipantData(); // Reload data to get fresh state
      setShowStoreSelectionModal(false);
      setSelectedStore(null);
      setShowCouponUsedConfirmation(true);
    } catch (error) {
      console.error("Coupon usage error:", error);
      alert("クーポンの利用に失敗しました。もう一度お試しください。");
      captureException(error, { level: "error" });
    }
  };

  // FIX: Refactored to not take arguments and use state from closure scope.
  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { prizeDetailsInModal, shippingAddress } = interactionState;
    if (!prizeDetailsInModal) return;

    if (!isPrizeDateValid(prizeDetailsInModal)) {
      alert("この特典は有効期間外です。");
      return;
    }

    setIsSubmittingAddress(true);
    try {
      const recordsToUpdate = allParticipantRecords.filter(
        (p) =>
          p.prizeId === prizeDetailsInModal.prizeId &&
          (!p.shippingAddress || Object.keys(p.shippingAddress).length === 0),
      );
      if (recordsToUpdate.length > 0) {
        const batch = db.batch();
        recordsToUpdate.forEach((record) => {
          const docRef = db.collection("participants").doc(record.id);
          batch.update(docRef, { shippingAddress });
        });
        await batch.commit();
      }

      // FIX: Optimistically update the prizeDetailsInModal state to immediately reflect the change.
      // This ensures the UI updates to show the confirmation message instead of the form.
      setPrizeDetailsInModal((prev: Participant | null) =>
        prev ? { ...prev, shippingAddress } : null,
      );

      // Now, reload all data from the source of truth to ensure consistency for subsequent actions.
      loadParticipantData();
      interactionState.setShippingAgreements({ terms: false, privacy: false });
    } catch (error) {
      alert("住所の登録に失敗しました。");
      captureException(error, { level: "error" });
    } finally {
      setIsSubmittingAddress(false);
    }
  };

  // FIX: Refactored to not take arguments and use state from closure scope.
  const handleApprovalFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign || !campaignId || !user) return;

    setApprovalFormError(null);
    setIsSubmittingApproval(true);
    try {
      const newRequestRef = db.collection("participationRequests").doc();
      await newRequestRef.set({
        campaignId,
        userId: user.uid,
        authInfo: {
          provider: user.providerData[0]?.providerId || "anonymous",
          identifier: user.email || user.phoneNumber || user.uid,
        },
        formData: formState.approvalFormData,
        status: "pending",
        createdAt: new Date(),
      });
      setApprovalFormSuccess(true);
      loadParticipantData();
    } catch (error) {
      setApprovalFormError("申請の送信に失敗しました。");
      captureException(error, { level: "error" });
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // FIX: Added missing function
  const handleApprovalFileUpload = async (file: File, fieldId: string) => {
    if (!campaignId || !user) return;

    formState.setIsUploadingApprovalFile((prev: any) => ({
      ...prev,
      [fieldId]: true,
    }));
    formState.setApprovalFileUploadError((prev: any) => ({
      ...prev,
      [fieldId]: "",
    }));
    try {
      const filePath = `campaigns/${campaignId}/approvals/${user.uid}/${fieldId}/${file.name}`;
      const fileRef = storage.ref(filePath);
      await fileRef.put(file);
      const url = await fileRef.getDownloadURL();
      formState.setApprovalFormData((prev: any) => ({
        ...prev,
        [fieldId]: url,
      }));
    } catch (error) {
      formState.setApprovalFileUploadError((prev: any) => ({
        ...prev,
        [fieldId]: "アップロードに失敗しました。",
      }));
      captureException(error, { level: "error" });
    } finally {
      formState.setIsUploadingApprovalFile((prev: any) => ({
        ...prev,
        [fieldId]: false,
      }));
    }
  };

  // FIX: Refactored to not take arguments and use state from closure scope.
  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign || !campaignId) return;

    setInquiryError(null);
    setIsSubmittingInquiry(true);
    try {
      await db.collection("inquiries").add({
        campaignId,
        formData: formState.contactFormData,
        createdAt: new Date(),
        ...(user && {
          userId: user.uid,
          authInfo: {
            provider: user.providerData[0]?.providerId || "anonymous",
            identifier: user.email || user.phoneNumber || user.uid,
          },
        }),
      });
      setInquirySuccess(true);
    } catch (error) {
      setInquiryError("送信に失敗しました。時間をおいて再度お試しください。");
      captureException(error, { level: "error" });
    } finally {
      setIsSubmittingInquiry(false);
    }
  };

  return {
    isParticipating,
    performLottery,
    handleConfirmAndParticipate,
    handleUseCoupon,
    confirmCouponUsage,
    handleAddressSubmit,
    handleApprovalFormSubmit,
    handleInquirySubmit,
    handleApprovalFileUpload,
  };
};
