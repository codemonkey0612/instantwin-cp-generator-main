import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Spinner from "../components/Spinner";
import { useParticipationTicket } from "./hooks/useParticipationTicket";
import { db, auth } from "../firebase";
import { Campaign } from "../types";

const ParticipationTicketPage: React.FC = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const {
    status,
    setStatus,
    error,
    setError,
    chancesGranted,
    campaignData,
    setCampaignData,
    claimTicket,
  } = useParticipationTicket();
  const [countdown, setCountdown] = useState(5);
  const claimAttempted = useRef(false);

  // This effect runs once to validate ticket, fetch campaign data,
  // ensure user auth, and then claim the ticket.
  const initializeAndClaim = useCallback(async () => {
    // 1. Validate URL params
    if (!campaignId || !token) {
      setError("無効なURLです。");
      setStatus("error");
      return;
    }

    try {
      // 2. Fetch and validate campaign data
      const campaignDoc = await db
        .collection("campaigns")
        .doc(campaignId)
        .get();
      if (!campaignDoc.exists) {
        setError("キャンペーンが見つかりませんでした。");
        setStatus("error");
        return;
      }
      const campaign = {
        ...campaignDoc.data(),
        id: campaignDoc.id,
      } as Campaign;
      const isValidToken = campaign.participationTickets?.some(
        (ticket: any) => ticket.token === token,
      );

      if (!isValidToken) {
        setError("参加券のURLが無効か、期限切れです。");
        setStatus("error");
        return;
      }
      setCampaignData(campaign); // Set campaign data for UI

      // 3. Ensure user is authenticated (anonymous is fine)
      let currentUser = auth.currentUser;
      if (!currentUser) {
        setStatus("prompt_login"); // Show "Preparing..." message
        const userCredential = await auth.signInAnonymously();
        currentUser = userCredential.user;
      }

      if (!currentUser) {
        throw new Error("AUTH_FAILED");
      }

      // 4. Claim the ticket
      await claimTicket(currentUser.uid, campaign, token);
    } catch (err: any) {
      console.error("Ticket claim process failed:", err);
      let message = "参加券の処理中に予期せぬエラーが発生しました。";
      if (err.message === "AUTH_FAILED") {
        message = "参加の準備に失敗しました。もう一度お試しください。";
      } else if (err.message) {
        // Use the specific error from claimTicket if available
        message = error || err.message;
      }
      setError(message);
      // The status might have been set inside claimTicket, but this is a fallback.
      if (status !== "success" && status !== "already_claimed") {
        setStatus("error");
      }
    }
  }, [
    campaignId,
    token,
    claimTicket,
    setError,
    setStatus,
    setCampaignData,
    status,
    error,
  ]);

  useEffect(() => {
    // Run the sequence only once
    if (!claimAttempted.current) {
      claimAttempted.current = true;
      initializeAndClaim();
    }
  }, [claimAttempted, initializeAndClaim]);

  const redirectToCampaign = useCallback(() => {
    navigate(`/campaign/${campaignId}`);
  }, [navigate, campaignId]);

  useEffect(() => {
    if (status === "success") {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            redirectToCampaign();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status, redirectToCampaign]);

  const renderContent = () => {
    const themeColor = campaignData?.designSettings?.themeColor || "#4F46E5";
    const buttonClass =
      "w-full px-6 py-3 text-white font-semibold rounded-lg hover:opacity-90";

    switch (status) {
      case "loading":
      case "claiming":
        return <Spinner size="lg" />;
      case "prompt_login":
        return (
          <>
            <h2 className="text-xl font-bold text-slate-800 mb-4">
              参加券を利用します
            </h2>
            <p className="text-slate-600 mb-6">
              参加の準備をしています。しばらくお待ちください...
            </p>
            <Spinner />
          </>
        );
      case "success":
        return (
          <>
            <p className="text-slate-600 my-6 text-xl">
              参加回数が{" "}
              <span
                className="font-bold text-2xl"
                style={{ color: themeColor }}
              >
                {chancesGranted}
              </span>{" "}
              回分付与されました。
              <br />
              <span className="text-base">
                {countdown}秒後にキャンペーンページに自動的に移動します。
              </span>
            </p>
            <button
              onClick={redirectToCampaign}
              style={{ backgroundColor: themeColor }}
              className={buttonClass}
            >
              今すぐキャンペーンページへ
            </button>
          </>
        );
      case "already_claimed":
        return (
          <>
            <p className="text-slate-600 my-6">{error}</p>
            <button
              onClick={redirectToCampaign}
              style={{ backgroundColor: themeColor }}
              className={buttonClass}
            >
              キャンペーンページへ戻る
            </button>
          </>
        );
      case "error":
        return (
          <>
            <h2 className="text-xl font-bold text-red-700 mb-4">エラー</h2>
            <p className="text-slate-600 mb-6">{error}</p>
            <button
              onClick={redirectToCampaign}
              style={{ backgroundColor: themeColor }}
              className={buttonClass}
            >
              キャンペーンページへ戻る
            </button>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-center p-4">
      <div className="bg-white p-8 sm:p-12 rounded-2xl shadow-xl max-w-md w-full text-center flex flex-col justify-center items-center min-h-[300px]">
        {renderContent()}
      </div>
    </div>
  );
};

export default ParticipationTicketPage;
