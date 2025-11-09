import { useState, useCallback } from "react";
import { db } from "../../firebase";
import type { Campaign } from "../../types";

export function useParticipationTicket() {
  const [status, setStatus] = useState<
    | "loading"
    | "prompt_login"
    | "claiming"
    | "success"
    | "error"
    | "already_claimed"
  >("loading");
  const [chancesGranted, setChancesGranted] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [campaignData, setCampaignData] = useState<Campaign | null>(null);

  const claimTicket = useCallback(
    async (userId: string, campaign: Campaign, token: string) => {
      setStatus("claiming");

      try {
        const campaignRef = db.collection("campaigns").doc(campaign.id);
        // The user's override document will now store which tickets they have claimed.
        const overrideRef = campaignRef.collection("overrides").doc(userId);
        const userTicketClaimRef = overrideRef
          .collection("claimedTickets")
          .doc(token);

        const ticketData = campaign.participationTickets?.find(
          (t) => t.token === token,
        );
        if (!ticketData) {
          throw new Error("INVALID_TICKET_DATA");
        }

        const defaultChances =
          (Number(campaign.participationLimitPerUser) > 0
            ? Number(campaign.participationLimitPerUser)
            : 1) || 1;
        const chancesToGrant = ticketData?.chancesToGrant ?? defaultChances;

        await db.runTransaction(async (transaction) => {
          const campaignDoc = await transaction.get(campaignRef);
          if (!campaignDoc.exists) {
            throw new Error("CAMPAIGN_NOT_FOUND");
          }

          const userTicketClaimDoc = await transaction.get(userTicketClaimRef);
          if (userTicketClaimDoc.exists) {
            // This specific user has already claimed this specific ticket.
            throw new Error("ALREADY_CLAIMED_BY_USER");
          }

          const overrideDoc = await transaction.get(overrideRef);
          // Safer way to get currentChances
          const currentChances = overrideDoc.data()?.extraChances || 0;
          const newTotalChances = currentChances + chancesToGrant;

          // Grant chances to the user.
          transaction.set(
            overrideRef,
            { extraChances: newTotalChances },
            { merge: true },
          );

          // Mark this ticket as claimed *for this user*.
          transaction.set(userTicketClaimRef, {
            claimedAt: new Date(),
            chancesGranted: chancesToGrant,
            ticketId: ticketData.id,
          });

          // Update the overall ticket usage count for the dashboard
          const currentUsage = campaignDoc.data()?.ticketUsage || {};
          const ticketId = ticketData.id;
          const ticketLabel = ticketData.label;

          const newTicketUsageData = currentUsage[ticketId] || {
            label: ticketLabel,
            count: 0,
          };
          newTicketUsageData.count += 1;

          transaction.update(campaignRef, {
            [`ticketUsage.${ticketId}`]: newTicketUsageData,
          });
        });

        setChancesGranted(chancesToGrant);
        sessionStorage.removeItem("postLoginRedirect");
        setStatus("success");
      } catch (err: any) {
        console.error("Ticket claim failed:", err);
        if (err.code === "permission-denied") {
          setError(
            "参加券の利用に必要な権限がありません。キャンペーンの管理者にFirebaseのセキュリティルール設定を確認するよう依頼してください。",
          );
          setStatus("error");
        } else if (err.message === "ALREADY_CLAIMED_BY_USER") {
          setError("あなたはこの参加券を既に使用しています。");
          setStatus("already_claimed");
        } else if (err.message === "INVALID_TICKET_DATA") {
          setError(
            "参加券のデータが見つかりません。キャンペーン設定を確認してください。",
          );
          setStatus("error");
        } else {
          setError(
            "参加券の利用登録に失敗しました。予期せぬエラーが発生しました。",
          );
          setStatus("error");
        }
      }
    },
    [setStatus, setError, setChancesGranted],
  );

  return {
    status,
    setStatus,
    error,
    setError,
    chancesGranted,
    campaignData,
    setCampaignData,
    claimTicket,
  };
}
