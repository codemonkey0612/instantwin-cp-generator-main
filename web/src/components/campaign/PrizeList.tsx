import React from 'react';
import type { Prize, Participant, Campaign } from '../../types';
import type { PresentationTexts } from '../../pages/useCampaignPage';

interface PrizeListProps {
  campaign: Campaign;
  allPrizesInCampaign: Prize[];
  allParticipantRecords: Participant[];
  handleShowPrizeDetails: (prize: Prize) => void;
  isPrizeDateValid: (prize: Prize) => boolean;
  getContrastingTextColor: (hex: string) => string;
  formatDate: (date: Date | undefined | null) => string;
  truncate: (str: string, num: number) => string;
  presentationTexts: PresentationTexts;
}

const PrizeList: React.FC<PrizeListProps> = ({
  campaign,
  allPrizesInCampaign,
  allParticipantRecords,
  handleShowPrizeDetails,
  isPrizeDateValid,
  getContrastingTextColor,
  formatDate,
  truncate,
  presentationTexts,
}) => {
  if (allPrizesInCampaign.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-center text-slate-700 mb-4 border-b pb-2">{presentationTexts.prizeListTitle}</h3>
      <div className="grid grid-cols-2 gap-3">
        {allPrizesInCampaign.map(prize => {
          const winsForThisPrize = allParticipantRecords.filter(p => p.prizeId === prize.id);
          const hasWonThisPrize = winsForThisPrize.length > 0;
          const totalWins = winsForThisPrize.length;

          let totalUsed = 0;
          let totalLimit = 0;
          let isUsedUp = false;

          if (hasWonThisPrize && prize.type === 'e-coupon') {
            totalUsed = winsForThisPrize.reduce((sum, p) => sum + (p.couponUsedCount || 0), 0);
            totalLimit = (prize.couponUsageLimit || 1) * totalWins;
            isUsedUp = totalUsed >= totalLimit;
          }

          const textColorClass = getContrastingTextColor(prize.rankColor || '#6366F1');
          
          const isValid = isPrizeDateValid(prize);
          
          let containerClasses = 'relative flex flex-col p-3 rounded-lg transition-all duration-200 cursor-pointer';
          if (!isValid) {
              containerClasses += ' bg-slate-100 border border-slate-200 opacity-70 hover:opacity-80';
          } else if (hasWonThisPrize) {
              containerClasses += ' bg-yellow-100 border border-yellow-300 hover:bg-yellow-200 shadow-lg';
          } else {
              containerClasses += ' bg-white border border-slate-100 shadow-md hover:bg-slate-50';
          }

          return (
            <div key={prize.id} 
              className={containerClasses}
              onClick={() => handleShowPrizeDetails(prize)}
              aria-label="景品詳細を見る"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { handleShowPrizeDetails(prize); } }}
            >
              <img src={prize.imageUrl || 'https://via.placeholder.com/150'} alt={prize.title} className="w-full aspect-[4/3] object-cover rounded-md bg-slate-100 mb-2"/>
              <div className="flex-1 flex flex-col mt-1">
                  <div className="flex items-center justify-between">
                  <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${textColorClass}`}
                      style={{ backgroundColor: prize.rankColor || '#6366F1' }}
                  >{prize.rank}</span>
                  {hasWonThisPrize && (
                      <span className="text-xs font-bold text-yellow-800 bg-yellow-200 px-2 py-1 rounded-full">
                          {totalWins > 1 ? presentationTexts.winCount(totalWins) : presentationTexts.singleWinText}
                      </span>
                  )}
                  </div>
                  <h4 className="font-semibold text-sm text-slate-800 mt-1.5 leading-tight flex-grow" title={prize.title}>{truncate(prize.title, 20)}</h4>
                  
                  {(prize.validFrom || prize.validTo) && (
                      <div className="text-xs text-slate-500 mt-1">
                          <p>有効期間：{formatDate(prize.validFrom) || '...'}〜{formatDate(prize.validTo) || '...'}</p>
                      </div>
                  )}

                  {hasWonThisPrize && prize.type === 'e-coupon' && (
                      <div className="text-xs text-center mt-1.5">
                          {isUsedUp ? (
                          <span className="font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">使用済み</span>
                          ) : (
                          <span className="font-semibold text-indigo-700">残り使用可能数 {totalLimit - totalUsed} 回</span>
                          )}
                      </div>
                  )}
                   {!isValid && (prize.validFrom || prize.validTo) && (
                      <div className="mt-1.5">
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">有効期間外</span>
                      </div>
                  )}
                  {campaign.showPrizeCountsOnPublicPage && (
                  <div className="text-xs text-slate-500 mt-auto pt-1"><p>当選数: {prize.winnersCount || 0}本 / 残り: {prize.unlimitedStock ? '無制限' : `${prize.stock || 0}本`}</p></div>
                  )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 text-center text-xs text-slate-500">
        {allParticipantRecords.length > 0
          ? <p>{presentationTexts.wonPrizeTapInstruction}</p>
          : <p>{presentationTexts.prizeTapInstruction}</p>
        }
      </div>
    </div>
  );
};

export default PrizeList;