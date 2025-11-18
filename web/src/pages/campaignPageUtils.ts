// pages/campaignPageUtils.ts
import { firebase, db } from "../firebase";
import type { Campaign, Participant, Prize } from "../types";

export const getContrastingTextColor = (
  hex: string,
): "text-white" | "text-slate-800" => {
  if (!hex || !hex.startsWith("#")) return "text-white";
  const hexValue = hex.substring(1);
  if (hexValue.length !== 6) return "text-white";
  const r = parseInt(hexValue.substring(0, 2), 16);
  const g = parseInt(hexValue.substring(2, 4), 16);
  const b = parseInt(hexValue.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "text-slate-800" : "text-white";
};

export const formatDate = (date: Date | undefined | null): string => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return ""; // Invalid date
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
};

export const formatDateTime = (date: Date | undefined | null): string => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}`;
};

type DateValidType = "expired" | "upcoming" | "invalid";
export const isPrizeDateValid = (
  prize: Prize,
  type: DateValidType = "invalid",
): boolean => {
  const now = new Date();
  let from;
  let to;

  if (prize.validFrom instanceof firebase.firestore.Timestamp) {
    from = prize.validFrom.toDate();
  } else if (
    typeof prize.validFrom === "object" &&
    "seconds" in prize.validFrom &&
    "nanoseconds" in prize.validFrom
  ) {
    from = new firebase.firestore.Timestamp(
      prize.validFrom.seconds as number,
      prize.validFrom.nanoseconds as number,
    ).toDate();
  } else if (prize.validFrom instanceof Date) {
    from = prize.validFrom;
  } else if (typeof prize.validFrom === "string") {
    from = new Date(prize.validFrom);
  } else {
    from = null;
  }

  if (prize.validTo instanceof firebase.firestore.Timestamp) {
    to = prize.validTo.toDate();
  } else if (
    typeof prize.validTo === "object" &&
    "seconds" in prize.validTo &&
    "nanoseconds" in prize.validTo
  ) {
    to = new firebase.firestore.Timestamp(
      prize.validTo.seconds as number,
      prize.validTo.nanoseconds as number,
    ).toDate();
  } else if (prize.validTo instanceof Date) {
    to = prize.validTo;
  } else if (typeof prize.validTo === "string") {
    to = new Date(prize.validTo);
  } else {
    to = null;
  }

  if (!from && !to) return true;

  if (type === "invalid" && ((from && now < from) || (to && now > to)))
    return false;
  if (type === "upcoming" && from && now < from) return false;
  if (type === "expired" && to && now > to) return false;

  return true;
};

interface LotteryParams {
  campaignId: string;
  user: any; // firebase user
  alreadyWonPrizeIds: Set<string>;
  pendingAnswers: Record<string, string | string[]>;
  lastParticipationTime?: Date | null; // Last participation time for interval check
}

// The core lottery logic as a standalone function
export const runLotteryTransaction = async ({
  campaignId,
  user,
  alreadyWonPrizeIds,
  pendingAnswers,
  lastParticipationTime,
}: LotteryParams): Promise<Participant> => {
  const campaignDocRef = db.collection("campaigns").doc(campaignId);

  // Check participation interval restriction BEFORE transaction
  // (Firestore transactions don't support queries, only document references)
  let intervalCheckPassed = true;
  let intervalError: string | null = null;
  
  if (lastParticipationTime) {
    // Get campaign data to check interval settings
    const campaignDoc = await campaignDocRef.get();
    if (campaignDoc.exists) {
      const campaignData = campaignDoc.data() as Campaign;
      const intervalHours = campaignData.participationIntervalHours || 0;
      const intervalMinutes = campaignData.participationIntervalMinutes || 0;
      
      if (intervalHours > 0 || intervalMinutes > 0) {
        const intervalMs = (intervalHours * 60 + intervalMinutes) * 60 * 1000;
        const nextAvailableTime = lastParticipationTime.getTime() + intervalMs;
        const now = Date.now();
        
        if (now < nextAvailableTime) {
          intervalCheckPassed = false;
          const remainingMs = nextAvailableTime - now;
          const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
          const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
          intervalError = `PARTICIPATION_INTERVAL_NOT_PASSED:${remainingHours}:${remainingMinutes}`;
        }
      }
    }
  }
  
  if (!intervalCheckPassed && intervalError) {
    throw new Error(intervalError);
  }

  return db.runTransaction(async (transaction) => {
    const campaignDoc = await transaction.get(campaignDocRef);
    if (!campaignDoc.exists)
      throw new Error("キャンペーンデータが見つかりません。");
    const campaignData = campaignDoc.data() as Campaign;

    const prizes = campaignData.prizes || [];
    const consolationPrize = campaignData.consolationPrize
      ? { ...campaignData.consolationPrize }
      : null;

    const hasAnyStock = [...prizes, consolationPrize].some(
      (p) => p && (p.unlimitedStock || (p.stock || 0) > 0),
    );
    if (
      !hasAnyStock &&
      campaignData.outOfStockBehavior === "prevent_participation"
    ) {
      throw new Error("OUT_OF_STOCK");
    }

    let wonPrize: Prize | null = null;
    let isConsolationWin = false;
    let assignedUrl: string | undefined = undefined;

    const isOverallWinner =
      Math.random() * 100 < (campaignData.overallWinProbability ?? 100);

    if (isOverallWinner) {
      let availablePrizes = prizes.filter(
        (p) => p.unlimitedStock || (p.stock || 0) > 0,
      );
      if (campaignData.preventDuplicatePrizes) {
        availablePrizes = availablePrizes.filter(
          (p) => !alreadyWonPrizeIds.has(p.id),
        );
      }

      if (availablePrizes.length > 0) {
        const totalAllocation = availablePrizes.reduce(
          (sum, p) => sum + (p.probability || 0),
          0,
        );
        if (totalAllocation > 0) {
          let randomNum = Math.random() * totalAllocation;
          for (const prize of availablePrizes) {
            randomNum -= prize.probability || 0;
            if (randomNum <= 0) {
              wonPrize = prize;
              break;
            }
          }
        }
      }

      if (wonPrize) {
        if (!wonPrize.unlimitedStock && wonPrize.type === "url") {
          const urlStock = (wonPrize.urlStockList || [])
            .map((s) => String(s).trim())
            .filter(Boolean);
          if (urlStock.length > 0) {
            assignedUrl = urlStock.pop();
            const prizeInMainArray = prizes.find((p) => p.id === wonPrize!.id);
            if (prizeInMainArray) {
              prizeInMainArray.urlStockList = urlStock;
              prizeInMainArray.stock = urlStock.length;
            }
          } else {
            wonPrize = null;
            assignedUrl = undefined;
          }
        }
      }
    }

    if (!wonPrize) {
      const sourceConsolationPrize = campaignData.consolationPrize;
      const isConfigured =
        sourceConsolationPrize &&
        typeof sourceConsolationPrize.title === "string" &&
        sourceConsolationPrize.title.trim() !== "";

      if (isConfigured) {
        const hasStock =
          sourceConsolationPrize.unlimitedStock === true ||
          (typeof sourceConsolationPrize.stock === "number" &&
            sourceConsolationPrize.stock > 0);

        if (hasStock) {
          wonPrize = { ...sourceConsolationPrize };
          isConsolationWin = true;

          if (!wonPrize.unlimitedStock && wonPrize.type === "url") {
            const urlStock = (wonPrize.urlStockList || [])
              .map((s) => String(s).trim())
              .filter(Boolean);
            if (urlStock.length > 0) {
              assignedUrl = urlStock.pop();
              if (consolationPrize) {
                consolationPrize.urlStockList = urlStock;
                consolationPrize.stock = urlStock.length;
              }
            } else {
              wonPrize = null;
              isConsolationWin = false;
            }
          }
        }
      }
    }

    const newParticipantRef = db.collection("participants").doc();
    const participantPayload: Omit<Participant, "id" | "wonAt"> = {
      campaignId: campaignId,
      userId: user.uid,
      authInfo: {
        provider: user.providerData[0]?.providerId || "anonymous",
        identifier: user.email || user.phoneNumber || user.uid,
      },
      prizeId: wonPrize ? wonPrize.id : "loss",
      prizeDetails: wonPrize
        ? JSON.parse(JSON.stringify(wonPrize))
        : {
            id: "loss",
            title: "ハズレ",
            rank: "-",
            description: "",
            imageUrl: "",
            stock: 0,
            unlimitedStock: true,
            type: "url",
          },
      isConsolationPrize: isConsolationWin,
      questionnaireAnswers: pendingAnswers,
      couponUsedCount: 0,
      couponUsageHistory: [],
      ...(assignedUrl && { assignedUrl: assignedUrl }),
    };
    const wonAtDate = new Date();

    transaction.set(newParticipantRef, {
      ...participantPayload,
      wonAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    if (wonPrize) {
      if (isConsolationWin && consolationPrize) {
        consolationPrize.winnersCount =
          (consolationPrize.winnersCount || 0) + 1;
        if (
          !consolationPrize.unlimitedStock &&
          consolationPrize.type !== "url"
        ) {
          consolationPrize.stock = (consolationPrize.stock || 0) - 1;
        }
        transaction.update(campaignDocRef, { consolationPrize });
      } else {
        const prizeToUpdate = prizes.find((p) => p.id === wonPrize!.id);
        if (prizeToUpdate) {
          prizeToUpdate.winnersCount = (prizeToUpdate.winnersCount || 0) + 1;
          if (!prizeToUpdate.unlimitedStock && prizeToUpdate.type !== "url") {
            prizeToUpdate.stock = (prizeToUpdate.stock || 0) - 1;
          }
          transaction.update(campaignDocRef, { prizes });
        }
      }
    }
    return {
      ...participantPayload,
      id: newParticipantRef.id,
      wonAt: wonAtDate,
    } as Participant;
  });
};
