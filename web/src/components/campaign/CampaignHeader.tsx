import React from 'react';
import type { Campaign } from '../../types';

interface CampaignHeaderProps {
  campaign: Campaign;
}

const CampaignHeader: React.FC<CampaignHeaderProps> = ({ campaign }) => {
  return (
    <>
      {(campaign.showNameOnPublicPage ?? true) && <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 text-center mb-2">{campaign.name}</h1>}
      <p className="text-slate-500 text-center mb-6 whitespace-pre-wrap">{campaign.description || '奮ってご参加ください！'}</p>
    </>
  );
};

export default CampaignHeader;
