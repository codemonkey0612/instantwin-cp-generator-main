import React, { useEffect, useState } from "react";

import Spinner from "../components/Spinner";
import { useCampaignPage } from "./useCampaignPage";

import CampaignHeader from "../components/campaign/CampaignHeader";
import PrizeList from "../components/campaign/PrizeList";
import ParticipationArea from "../components/campaign/ParticipationArea";
import PageContentDisplay from "../components/campaign/PageContentDisplay";
import CampaignFooter from "../components/campaign/CampaignFooter";
import ParticipationModal from "../components/campaign/modals/ParticipationModal";
import ApprovalFormModal from "../components/campaign/modals/ApprovalFormModal";
import TicketRequiredModal from "../components/campaign/modals/TicketRequiredModal";
import PrizeDetailsModal from "../components/campaign/modals/PrizeDetailsModal";
import LegalModal from "../components/campaign/modals/LegalModal";
import ContactModal from "../components/campaign/modals/ContactModal";
import LoginPromptBanner from "../components/campaign/LoginPromptBanner";

const CampaignPublicPage: React.FC = () => {
  const hookProps = useCampaignPage();
  const {
    loading,
    error,
    campaign,
    modalStep,
    allParticipantRecords,
    shouldShowLoginPromptBanner,
    setModalStep,
    userId,
    presentationTexts,
  } = hookProps;

  // Update document title: set an empty title immediately to avoid any text/URL,
  // then switch to the campaign name when loaded. Do not restore previous title on unmount.
  useEffect(() => {
    // Set an empty title immediately on mount so nothing is displayed
    if (!campaign?.name) document.title = "";
  }, []); // run once on mount

  useEffect(() => {
    if (campaign?.name) {
      document.title = campaign.name;
    }
  }, [campaign?.name]);

  // Create a "stable" version of the records to prevent the background from updating while the modal is open.
  const [stableParticipantRecords, setStableParticipantRecords] = useState(
    allParticipantRecords,
  );

  useEffect(() => {
    // When the lottery modal is closed, update the stable records to the latest version.
    // This ensures the prize list updates only after the user has seen the result modal.
    if (modalStep === "closed") {
      setStableParticipantRecords(allParticipantRecords);
    }
  }, [modalStep, allParticipantRecords]);

  if (loading)
    return (
      <div className="min-h-screen bg-slate-100 flex justify-center items-center">
        <Spinner size="lg" />
      </div>
    );
  if (error)
    return (
      <div className="min-h-screen flex flex-col justify-center items-center text-center p-4">
        <div className="bg-white p-8 sm:p-12 rounded-2xl shadow-xl max-w-md w-full">
          <h2 className="text-xl font-bold text-slate-800 mb-4">お知らせ</h2>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  if (!campaign) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 font-sans transition-colors duration-500 pb-20">
      {modalStep !== "closed" && <ParticipationModal {...hookProps} />}
      <ApprovalFormModal {...hookProps} campaign={campaign} />
      <TicketRequiredModal {...hookProps} />
      <PrizeDetailsModal {...hookProps} />
      <LegalModal {...hookProps} />
      <ContactModal {...hookProps} campaign={campaign} />

      <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden my-8">
        {campaign.designSettings?.mainVisual?.enabled &&
          campaign.designSettings.mainVisual.imageUrl && (
            <div className="w-full aspect-[3/4] overflow-hidden">
              <img
                src={campaign.designSettings.mainVisual.imageUrl}
                alt={campaign.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        <div className="p-8 sm:p-10 flex flex-col items-center">
          <CampaignHeader campaign={campaign} />

          <div className="transition-all duration-300 w-full">
            <PrizeList
              {...hookProps}
              campaign={campaign}
              allParticipantRecords={stableParticipantRecords}
            />
            {campaign.eventMode?.enabled ? (
              <div className="text-center p-4 mt-6 bg-indigo-50 border border-indigo-200 rounded-lg">
                <p className="text-indigo-800 font-medium">
                  このキャンペーンはイベント会場で参加できます
                </p>
              </div>
            ) : (
              <ParticipationArea {...hookProps} campaign={campaign} />
            )}
          </div>
        </div>

        <PageContentDisplay {...hookProps} campaign={campaign} />

        {userId && (
          <div className="text-center px-8 sm:px-10 py-4 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              ユーザーID: <span className="font-mono">{userId}</span>
            </p>
          </div>
        )}

        <CampaignFooter {...hookProps} campaign={campaign} />
      </div>

      {shouldShowLoginPromptBanner && (
        <LoginPromptBanner
          onLoginClick={() => setModalStep("auth")}
          saveResultPrompt={presentationTexts.saveResultPrompt}
        />
      )}
    </div>
  );
};
export default CampaignPublicPage;
