import React from "react";
import type { Campaign, ParticipationRequest } from "../../types";
import { formatDateTime } from "../../pages/campaignPageUtils";
import type { PresentationTexts } from "../../pages/useCampaignPage";

interface ParticipationAreaProps {
  user: any; // Add user prop
  hasReachedLimit: boolean;
  limitMessage: string;
  campaign: Campaign;
  userParticipationRequest: ParticipationRequest | null;
  isWithinApplicationPeriod: boolean;
  participationBlockedByStock: boolean;
  authError: string | null;
  handleAuthInitiation: () => void;
  participationButtonDisabled: boolean;
  timeLeftMessage: string;
  presentationTexts: PresentationTexts;
  availableChances: number;
  useMultipleChances: boolean;
  setUseMultipleChances: (use: boolean) => void;
  extraChances: number;
  participationCount: number;
  isEventParticipationDone: boolean;
}

const ParticipationArea: React.FC<ParticipationAreaProps> = ({
  user,
  hasReachedLimit,
  limitMessage,
  campaign,
  userParticipationRequest,
  isWithinApplicationPeriod,
  participationBlockedByStock,
  authError,
  handleAuthInitiation,
  participationButtonDisabled,
  timeLeftMessage,
  presentationTexts,
  availableChances,
  useMultipleChances,
  setUseMultipleChances,
  isEventParticipationDone,
}) => {
  let participationButtonText: string;
  if (useMultipleChances && availableChances > 1) {
    participationButtonText =
      presentationTexts.multiParticipationButton(availableChances);
  } else {
    participationButtonText =
      campaign.presentationSettings?.participationButtonText ||
      "キャンペーンに参加する";
  }

  if (isEventParticipationDone) {
    return (
      <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-green-800 font-medium">
          イベントへのご参加ありがとうございました！
        </p>
        <p className="text-sm text-slate-600 mt-2">
          当選結果は景品一覧からご確認いただけます。
        </p>
      </div>
    );
  }
  if (campaign.requireFormApproval && userParticipationRequest) {
    switch (userParticipationRequest.status) {
      case "pending":
        participationButtonText = "審査中";
        break;
      case "rejected":
        participationButtonText = "再申請する";
        break;
    }
  }

  // Determine if participation is unlimited
  // Unlimited: participationLimitPerUser is 0 or undefined, and no ticket/form approval required
  const isUnlimited = 
    (campaign.participationLimitPerUser === 0 || !campaign.participationLimitPerUser) &&
    !campaign.requireTicket &&
    !campaign.requireFormApproval;

  return (
    <>
      {hasReachedLimit ? (
        campaign.requireFormApproval &&
        userParticipationRequest?.status === "pending" ? (
          <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 font-medium">
              参加申請をありがとうございました。現在審査中です。結果は改めてこのページに表示されます。
            </p>
          </div>
        ) : (
          <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 font-medium">{limitMessage}</p>
          </div>
        )
      ) : isWithinApplicationPeriod ? (
        participationBlockedByStock ? (
          <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 font-medium">
              すべての景品がなくなりました。たくさんのご参加ありがとうございました。
            </p>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            {authError && (
              <div className="text-center p-3 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
                <p className="text-red-700 text-sm font-medium">{authError}</p>
              </div>
            )}
            {timeLeftMessage && (
              <div className="text-center p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-amber-800 font-medium text-sm">
                  {timeLeftMessage}
                </p>
                <p className="text-amber-700 text-xs mt-1">
                  参加間隔制限により、上記の時間まで参加できません。
                </p>
              </div>
            )}
            <div>
              <button
                onClick={handleAuthInitiation}
                disabled={participationButtonDisabled || hasReachedLimit}
                style={{
                  backgroundColor:
                    participationButtonDisabled || hasReachedLimit
                      ? undefined
                      : "var(--theme-color, #4F46E5)",
                }}
                className={`w-full text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--theme-color, #4F46E5)] ${
                  participationButtonDisabled || hasReachedLimit
                    ? "bg-slate-400 cursor-not-allowed"
                    : "hover:opacity-90 hover:shadow-xl transform hover:-translate-y-1"
                }`}
              >
                {timeLeftMessage ? "参加間隔制限中" : participationButtonText}
              </button>
              {availableChances > 1 && !timeLeftMessage && (
                <div className="mt-3 text-center">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-600 hover:text-slate-800">
                    <input
                      type="checkbox"
                      checked={useMultipleChances}
                      onChange={(e) => setUseMultipleChances(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[color:var(--theme-color)] focus:ring-[color:var(--theme-color)]"
                    />
                    まとめて
                    {presentationTexts.multiParticipationButton(
                      availableChances,
                    )}
                  </label>
                </div>
              )}
              {campaign.requireFormApproval &&
                userParticipationRequest?.status === "approved" && (
                  <p className="text-center text-sm text-green-700 mt-2">
                    申請が承認されました。
                  </p>
                )}
              {campaign.requireFormApproval &&
                userParticipationRequest?.status === "rejected" && (
                  <p className="text-center text-sm text-red-700 mt-2">
                    申請が却下されました。再申請をすることができます。
                  </p>
                )}
              {user &&
                !timeLeftMessage &&
                !isUnlimited &&
                (!campaign.requireFormApproval ||
                  userParticipationRequest?.status === "approved") && (
                  <p className="text-center text-sm text-slate-500 mt-2">
                    {presentationTexts.remainingChances(availableChances)}
                  </p>
                )}
            </div>
          </div>
        )
      ) : (
        <div className="text-center p-4 bg-slate-100 border border-slate-200 rounded-lg">
          <p className="text-slate-600 font-medium whitespace-pre-wrap">
            {campaign.applicationPeriodOutOfRangeMessage ||
              "このキャンペーンは現在応募受付期間外です。"}
          </p>
          {(campaign.applicationStartDate || campaign.applicationEndDate) && (
            <div className="mt-2 text-sm text-slate-500">
              <p>
                応募可能期間:{" "}
                {formatDateTime(campaign.applicationStartDate) || "..."} 〜{" "}
                {formatDateTime(campaign.applicationEndDate) || "..."}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ParticipationArea;
