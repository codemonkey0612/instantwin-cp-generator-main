import React from "react";
import type { Participant, Prize, Campaign } from "../../types";
import Spinner from "../Spinner";
import type { PresentationTexts } from "../../pages/useCampaignPage";

interface PrizeDisplayProps {
  participantRecord: Participant;
  campaign: Campaign;
  showInteractionButton?: boolean;
  // State & Handlers for Interaction
  isPrizeDateValid: (prize: Prize) => boolean;
  getContrastingTextColor: (hex: string) => string;
  handleUseCoupon: () => void;
  // FIX: Update signature to match implementation in hook
  handleAddressSubmit: (e: React.FormEvent) => void;
  shippingAddress: Record<string, string>;
  setShippingAddress: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  shippingAgreements: { terms: boolean; privacy: boolean };
  setShippingAgreements: React.Dispatch<
    React.SetStateAction<{ terms: boolean; privacy: boolean }>
  >;
  isSubmittingAddress: boolean;
  setLegalModalContent: (
    content: { title: string; content: string } | null,
  ) => void;
  presentationTexts: PresentationTexts;
}

function PrizeDisplay({
  participantRecord,
  campaign,
  showInteractionButton = true,
  isPrizeDateValid,
  getContrastingTextColor,
  handleUseCoupon,
  handleAddressSubmit,
  shippingAddress,
  setShippingAddress,
  shippingAgreements,
  setShippingAgreements,
  isSubmittingAddress,
  setLegalModalContent,
  presentationTexts,
}: PrizeDisplayProps) {
  const { prizeDetails } = participantRecord;
  const isValid = isPrizeDateValid(prizeDetails);

  const renderPrizeInteraction = (prizeRecord: Participant) => {
    if (!prizeRecord) return null;
    const aggregatedRecord = prizeRecord as Participant & {
      assignedUrls?: string[];
      totalUsageLimit?: number;
      totalWins?: number;
    };
    const { prizeDetails, shippingAddress: savedAddress } = aggregatedRecord;

    const inputClass =
      "block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-[var(--theme-color, #4F46E5)] focus:border-[var(--theme-color, #4F46E5)]";

    switch (prizeDetails.type) {
      case "e-coupon":
        const usageLimit =
          aggregatedRecord.totalUsageLimit ||
          prizeDetails.couponUsageLimit ||
          1;
        const usedCount = aggregatedRecord.couponUsedCount || 0;
        const totalWins = aggregatedRecord.totalWins || 1;
        const isUsedUp = usedCount >= usageLimit;

        return (
          <div className="mt-6 w-full text-center">
            {totalWins > 1 && (
              <p className="text-sm text-slate-600 mb-1 font-semibold">
                {presentationTexts.winCount(totalWins)}！
              </p>
            )}
            {usageLimit > 1 && (
              <p className="text-sm text-slate-600 mb-2">
                使用回数: {usedCount} / {usageLimit} 回
              </p>
            )}
            <button
              onClick={handleUseCoupon}
              disabled={isUsedUp}
              style={{ backgroundColor: "var(--theme-color, #4F46E5)" }}
              className="w-full px-4 py-2.5 font-semibold rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed text-white hover:opacity-90"
            >
              {isUsedUp ? "使用済み" : "使用する"}
            </button>
          </div>
        );
      case "url":
        const urls =
          aggregatedRecord.assignedUrls ||
          (aggregatedRecord.assignedUrl ? [aggregatedRecord.assignedUrl] : []);
        return (
          <div className="mt-4 text-center w-full">
            <p className="font-semibold mb-2">
              下記URLから景品をご確認ください:
            </p>
            {urls.map((url, index) => (
              <a
                key={index}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--theme-color, #4F46E5)" }}
                className="block hover:underline break-all mb-1"
              >
                {url}
              </a>
            ))}
          </div>
        );
      case "mail-delivery":
        const totalWinsMail = aggregatedRecord.totalWins || 1;
        const enabledFields = (prizeDetails.shippingFields || []).filter(
          (f) => f.enabled,
        );
        if (savedAddress && Object.keys(savedAddress).length > 0) {
          return (
            <div className="mt-6 text-left text-sm w-full p-4 bg-slate-50 rounded-lg border">
              {totalWinsMail > 1 && (
                <p className="font-semibold mb-2 text-slate-800">
                  {presentationTexts.winCount(totalWinsMail)}
                  分、まとめて承りました。
                </p>
              )}
              <h4 className="font-semibold mb-2 text-slate-800">
                以下の内容で承りました
              </h4>
              {enabledFields.map(
                (field) =>
                  savedAddress[field.id] && (
                    <p key={field.id}>
                      <span className="font-medium">{field.label}:</span>{" "}
                      {savedAddress[field.id]}
                    </p>
                  ),
              )}
            </div>
          );
        }
        const requiredAgreements =
          (campaign?.pageContent?.termsOfServiceEnabled
            ? !shippingAgreements.terms
            : false) ||
          (campaign?.pageContent?.privacyPolicyEnabled
            ? !shippingAgreements.privacy
            : false);
        return (
          <form
            onSubmit={handleAddressSubmit}
            className="mt-6 space-y-3 text-left text-sm w-full"
          >
            <h4 className="font-semibold text-center text-slate-800 mb-2">
              配送先を入力してください
            </h4>
            {totalWinsMail > 1 && (
              <p className="text-center text-xs text-slate-500 mb-3">
                {presentationTexts.winCount(totalWinsMail)}
                分をまとめて発送します。
              </p>
            )}
            {enabledFields.map((field) => (
              <div key={field.id}>
                <label
                  htmlFor={field.id}
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  {field.label}
                  {field.required && " (必須)"}
                </label>
                <input
                  type="text"
                  id={field.id}
                  name={field.id}
                  value={shippingAddress[field.id] || ""}
                  onChange={(e) =>
                    setShippingAddress((s) => ({
                      ...s,
                      [field.id]: e.target.value,
                    }))
                  }
                  required={field.required}
                  className={inputClass}
                />
              </div>
            ))}
            {(campaign?.pageContent?.termsOfServiceEnabled ||
              campaign?.pageContent?.privacyPolicyEnabled) && (
              <div className="pt-2 space-y-1">
                {campaign?.pageContent?.termsOfServiceEnabled && (
                  <label className="flex items-start gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={shippingAgreements.terms}
                      onChange={(e) =>
                        setShippingAgreements((s) => ({
                          ...s,
                          terms: e.target.checked,
                        }))
                      }
                      className="mt-0.5 h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    />
                    <span>
                      <button
                        type="button"
                        onClick={() =>
                          setLegalModalContent({
                            title:
                              campaign.pageContent?.termsOfServiceLinkText ||
                              "利用規約",
                            content:
                              campaign.pageContent?.termsOfServiceContent || "",
                          })
                        }
                        className="underline hover:no-underline"
                        style={{ color: "var(--theme-color, #4F46E5)" }}
                      >
                        利用規約
                      </button>
                      に同意する
                    </span>
                  </label>
                )}
                {campaign?.pageContent?.privacyPolicyEnabled && (
                  <label className="flex items-start gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={shippingAgreements.privacy}
                      onChange={(e) =>
                        setShippingAgreements((s) => ({
                          ...s,
                          privacy: e.target.checked,
                        }))
                      }
                      className="mt-0.5 h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    />
                    <span>
                      <button
                        type="button"
                        onClick={() =>
                          setLegalModalContent({
                            title:
                              campaign.pageContent?.privacyPolicyLinkText ||
                              "プライバシーポリシー",
                            content:
                              campaign.pageContent?.privacyPolicyContent || "",
                          })
                        }
                        className="underline hover:no-underline"
                        style={{ color: "var(--theme-color, #4F46E5)" }}
                      >
                        プライバシーポリシー
                      </button>
                      に同意する
                    </span>
                  </label>
                )}
              </div>
            )}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmittingAddress || requiredAgreements}
                style={{ backgroundColor: "var(--theme-color, #4F46E5)" }}
                className="w-full px-4 py-2.5 text-white font-semibold rounded-lg hover:opacity-90 disabled:bg-slate-300 disabled:cursor-not-allowed flex justify-center items-center"
              >
                {isSubmittingAddress ? <Spinner size="sm" /> : "登録する"}
              </button>
            </div>
          </form>
        );
      default:
        return null;
    }
  };

  return (
    <div className="text-center flex flex-col items-center w-full">
      {(() => {
        // When viewing a prize you haven't won (from prize list)
        if (!showInteractionButton && participantRecord.userId === "") {
          return (
            <h2 className="text-2xl font-bold text-slate-800">
              {presentationTexts.prizeDetails}
            </h2>
          );
        }
        // Consolation prize result
        if (participantRecord.isConsolationPrize) {
          return (
            <h2 className="text-2xl font-bold text-slate-800">
              残念、ハズレです...
            </h2>
          );
        }
        // Win result
        return (
          <h2 className="text-2xl font-bold text-slate-800 whitespace-pre-line">
            おめでとうございます！{"\n"}
            {presentationTexts.winDetailsTitle}
          </h2>
        );
      })()}

      <div className="w-full mt-3 mb-3 p-3 bg-slate-50 rounded-lg border">
        <img
          src={prizeDetails.imageUrl || "https://via.placeholder.com/200"}
          alt={prizeDetails.title}
          className="w-48 mx-auto aspect-[4/3] object-cover rounded-md bg-slate-100 mb-3"
        />
        <div className="text-center mb-2">
          <span
            className={`inline-block text-sm font-bold px-3 py-1 rounded-full ${getContrastingTextColor(prizeDetails.rankColor || "#6366F1")}`}
            style={{ backgroundColor: prizeDetails.rankColor || "#6366F1" }}
          >
            {prizeDetails.rank}
          </span>
        </div>
        <h3 className="text-xl font-bold text-slate-800 text-center">
          {prizeDetails.title}
        </h3>
        {prizeDetails.description && (
          <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap text-left">
            {prizeDetails.description}
          </p>
        )}

        {prizeDetails.type === "e-coupon" && prizeDetails.couponTerms && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="font-semibold text-slate-700 text-left">利用規約</h4>
            <p className="text-xs text-slate-500 whitespace-pre-wrap mt-1 text-left">
              {prizeDetails.couponTerms}
            </p>
          </div>
        )}
      </div>
      {!isValid && (
        <div className="mt-4 w-full text-center p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm font-medium">
            この特典は有効期間外です
          </p>
        </div>
      )}
      {showInteractionButton &&
        isValid &&
        renderPrizeInteraction(participantRecord)}
    </div>
  );
}

export default PrizeDisplay;
