import React from 'react';

interface LegalModalProps {
  legalModalContent: { title: string, content: string } | null;
  setLegalModalContent: (content: { title: string, content: string } | null) => void;
}

const LegalModal: React.FC<LegalModalProps> = ({ legalModalContent, setLegalModalContent }) => {
  if (!legalModalContent) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) setLegalModalContent(null); }}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full transform transition-all duration-300 scale-95 animate-modal-pop max-h-[85vh] relative flex flex-col">
        <button onClick={() => setLegalModalContent(null)} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-800 bg-white/60 backdrop-blur-sm rounded-full transition-colors z-20" aria-label="閉じる">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="overflow-y-auto px-6 pb-6 pt-12 sm:px-8 sm:pb-8 sm:pt-12">
            <h2 className="text-xl font-bold text-slate-800 mb-4">{legalModalContent.title}</h2>
            <div className="prose prose-sm max-h-[60vh] overflow-y-auto p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-slate-600 whitespace-pre-wrap">{legalModalContent.content}</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LegalModal;
