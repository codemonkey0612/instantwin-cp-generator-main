import React from "react";
import type { Campaign } from "../../types";

interface CampaignFooterProps {
  campaign: Campaign;
  setShowContactModal: (show: boolean) => void;
  setLegalModalContent: (
    content: { title: string; content: string } | null,
  ) => void;
}

const CampaignFooter: React.FC<CampaignFooterProps> = ({
  campaign,
  setShowContactModal,
  setLegalModalContent,
}) => {
  return (
    <footer
      className="w-full pt-8 pb-8 text-white"
      style={{ backgroundColor: "var(--theme-color, rgb(71 85 105))" }}
    >
      <div className="w-full text-center text-sm">
        <div className="flex justify-center items-center flex-wrap gap-x-6 gap-y-2 mb-6">
          {campaign.contactEnabled && (
            <button
              onClick={() => {
                setShowContactModal(true);
              }}
              className="hover:underline"
            >
              お問い合わせ
            </button>
          )}
          {campaign.pageContent?.termsOfServiceEnabled && (
            <button
              onClick={() =>
                setLegalModalContent({
                  title:
                    campaign.pageContent?.termsOfServiceLinkText || "利用規約",
                  content: campaign.pageContent?.termsOfServiceContent || "",
                })
              }
              className="hover:underline"
            >
              {campaign.pageContent.termsOfServiceLinkText}
            </button>
          )}
          {campaign.pageContent?.privacyPolicyEnabled && (
            <button
              onClick={() =>
                setLegalModalContent({
                  title:
                    campaign.pageContent?.privacyPolicyLinkText ||
                    "プライバシーポリシー",
                  content: campaign.pageContent?.privacyPolicyContent || "",
                })
              }
              className="hover:underline"
            >
              {campaign.pageContent.privacyPolicyLinkText}
            </button>
          )}
          {(campaign.pageContent?.footerTextLinks || []).map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {link.text}
            </a>
          ))}
        </div>
        {(campaign.pageContent?.footerBannerLinks || []).length > 0 && (
          <div className="flex justify-center items-center flex-wrap gap-4 my-6">
            {(campaign.pageContent?.footerBannerLinks || []).map((banner) => (
              <a
                key={banner.id}
                href={banner.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={banner.imageUrl}
                  alt={banner.altText || "banner"}
                  className="h-12 w-auto object-contain"
                />
              </a>
            ))}
          </div>
        )}
        <p className="opacity-80">
          {campaign.pageContent?.footerOperatorInfo ||
            `© ${new Date().getFullYear()} Instant Win Campaign. All rights reserved.`}
        </p>
      </div>
    </footer>
  );
};

export default CampaignFooter;
