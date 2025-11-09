import React from "react";
import PrizeDisplay from "../PrizeDisplay";
import { useCampaignPage } from "../../../pages/useCampaignPage";

type PrizeDetailsModalProps = ReturnType<typeof useCampaignPage>;

const PrizeDetailsModal: React.FC<PrizeDetailsModalProps> = (props) => {
  const {
    prizeDetailsInModal,
    setPrizeDetailsInModal,
    showStoreSelectionModal,
    setShowStoreSelectionModal,
    selectedStore,
    setSelectedStore,
    confirmCouponUsage,
    showCouponUsedConfirmation,
    setShowCouponUsedConfirmation,
    campaign,
    // FIX: Add presentationTexts to props destructuring
    presentationTexts,
  } = props;

  if (!prizeDetailsInModal) {
    return null;
  }

  const allStores = prizeDetailsInModal.prizeDetails.availableStores || [];
  const usedStores = new Set(
    (prizeDetailsInModal.couponUsageHistory || []).map((h) => h.store),
  );
  const preventReuse =
    prizeDetailsInModal.prizeDetails.preventReusingAtSameStore;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in"
        onClick={(e) => {
          if (e.target === e.currentTarget) setPrizeDetailsInModal(null);
        }}
      >
        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full transform transition-all duration-300 scale-95 animate-modal-pop max-h-[85vh] relative flex flex-col">
          <button
            onClick={() => setPrizeDetailsInModal(null)}
            className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-800 bg-white/60 backdrop-blur-sm rounded-full transition-colors z-20"
            aria-label="閉じる"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <div className="overflow-y-auto px-6 pb-6 pt-12 sm:px-8 sm:pb-8 sm:pt-12">
            {campaign && (
              <PrizeDisplay
                participantRecord={prizeDetailsInModal}
                campaign={campaign}
                showInteractionButton={!!prizeDetailsInModal.userId}
                isPrizeDateValid={props.isPrizeDateValid}
                getContrastingTextColor={props.getContrastingTextColor}
                handleUseCoupon={props.handleUseCoupon}
                handleAddressSubmit={props.handleAddressSubmit}
                shippingAddress={props.shippingAddress}
                setShippingAddress={props.setShippingAddress}
                shippingAgreements={props.shippingAgreements}
                setShippingAgreements={props.setShippingAgreements}
                isSubmittingAddress={props.isSubmittingAddress}
                setLegalModalContent={props.setLegalModalContent}
                presentationTexts={presentationTexts}
              />
            )}
          </div>
        </div>
      </div>

      {showStoreSelectionModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowStoreSelectionModal(false);
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full transform transition-all duration-300 scale-95 animate-modal-pop max-h-[85vh] relative flex flex-col">
            <button
              onClick={() => setShowStoreSelectionModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-800 bg-white/60 backdrop-blur-sm rounded-full transition-colors z-20"
              aria-label="閉じる"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <div className="overflow-y-auto px-6 pb-6 pt-12 sm:px-8 sm:pb-8 sm:pt-12">
              <h2 className="text-xl font-bold text-slate-800 mb-4">
                利用店舗の選択
              </h2>
              <p className="text-sm text-slate-600 mb-6">
                どちらの店舗でクーポンを利用しますか？
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {allStores.length > 0 ? (
                  allStores.map((store) => {
                    const isUsed = preventReuse && usedStores.has(store);
                    return (
                      <button
                        key={store}
                        onClick={() => !isUsed && setSelectedStore(store)}
                        disabled={isUsed}
                        className={`w-full text-left p-3 border rounded-lg transition-colors flex justify-between items-center ${
                          isUsed
                            ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                            : selectedStore === store
                              ? "bg-indigo-100 border-indigo-400"
                              : "bg-white border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span className={isUsed ? "line-through" : ""}>
                          {store}
                        </span>
                        {isUsed && (
                          <span className="text-xs font-bold bg-slate-200 text-slate-500 px-2 py-1 rounded-full">
                            使用済み
                          </span>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <p className="text-center text-sm text-slate-500 py-4">
                    利用可能な店舗がありません。
                  </p>
                )}
              </div>
              <div className="flex justify-end pt-6">
                <button
                  type="button"
                  onClick={confirmCouponUsage}
                  disabled={!selectedStore}
                  style={{ backgroundColor: "var(--theme-color, #4F46E5)" }}
                  className="px-4 py-2 text-white font-semibold rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 flex items-center"
                >
                  この店舗で使用する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCouponUsedConfirmation && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCouponUsedConfirmation(false);
              setPrizeDetailsInModal(null);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full text-center transform transition-all duration-300 scale-95 animate-modal-pop relative">
            <button
              onClick={() => {
                setShowCouponUsedConfirmation(false);
                setPrizeDetailsInModal(null);
              }}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-800 bg-white/60 backdrop-blur-sm rounded-full transition-colors z-20"
              aria-label="閉じる"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <div className="p-6 sm:p-8 pt-12 sm:pt-12">
              <h2 className="text-xl font-bold text-slate-800 mb-4">
                クーポンを使用しました
              </h2>
              <p className="text-slate-600 mb-6">
                店舗スタッフにご確認いただけましたら、この画面を閉じてください。
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PrizeDetailsModal;
