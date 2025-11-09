import React from 'react';

interface TicketRequiredModalProps {
  showTicketRequiredModal: boolean;
  setShowTicketRequiredModal: (show: boolean) => void;
}

const TicketRequiredModal: React.FC<TicketRequiredModalProps> = ({ showTicketRequiredModal, setShowTicketRequiredModal }) => {
  if (!showTicketRequiredModal) {
    return null;
  }
  
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) setShowTicketRequiredModal(false); }}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full text-center transform transition-all duration-300 scale-95 animate-modal-pop relative">
        <button onClick={() => setShowTicketRequiredModal(false)} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-800 bg-white/60 backdrop-blur-sm rounded-full transition-colors z-20" aria-label="閉じる">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="p-8 pt-12">
          <h2 className="text-xl font-bold text-slate-800 mb-4">参加券が必要です</h2>
          <p className="text-slate-600">このキャンペーンに参加するには、参加券が必要です。指定のQRコードを読み取るなどして、参加券を取得してください。</p>
          <button onClick={() => setShowTicketRequiredModal(false)} style={{ backgroundColor: 'var(--theme-color, #4F46E5)' }} className="mt-6 w-full max-w-xs mx-auto px-6 py-2.5 text-white font-semibold rounded-lg hover:opacity-90 transition-colors">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketRequiredModal;
