import React from 'react';
import type { Campaign } from '../../types';

interface PageContentDisplayProps {
  campaign: Campaign;
  openFaq: string | null;
  setOpenFaq: (id: string | null) => void;
}

const PageContentDisplay: React.FC<PageContentDisplayProps> = ({ campaign, openFaq, setOpenFaq }) => {
  const { pageContent } = campaign;
  const hasContent =
    pageContent?.participationGuideEnabled ||
    (pageContent?.faqEnabled && (pageContent.faqItems || []).length > 0) ||
    pageContent?.organizerInfoEnabled;

  if (!hasContent) {
    return null;
  }

  return (
    <div className="w-full px-8 sm:px-10 py-10 space-y-10 border-t border-slate-200">
      {pageContent?.participationGuideEnabled && (
        <section>
          <h2 className="text-xl font-bold text-slate-800 text-center mb-6">{pageContent.participationGuideTitle}</h2>
          {pageContent.participationGuideType === 'steps' ? (
            <div className="space-y-4">
              {(pageContent.participationGuideSteps || []).map((step, index) => (
                <div key={step.id} className="flex gap-4 items-start">
                  <div style={{ backgroundColor: 'var(--theme-color, #1E293B)' }} className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-white font-bold rounded-full">{index + 1}</div>
                  <div>
                    <h3 className="font-semibold text-slate-700">{step.title}</h3>
                    <p className="text-sm text-slate-500 mt-1 whitespace-pre-wrap">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-wrap">{pageContent.participationGuideCustomText}</div>
          )}
        </section>
      )}
      {pageContent?.faqEnabled && (pageContent.faqItems || []).length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-slate-800 text-center mb-6">{pageContent.faqTitle}</h2>
          <div className="space-y-3">
            {(pageContent.faqItems || []).map(item => (
              <div key={item.id} className="border border-slate-200 rounded-lg overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === item.id ? null : item.id)} className="w-full flex justify-between items-center p-4 text-left font-semibold text-slate-700 hover:bg-slate-50">
                  <span>{item.question}</span>
                  <span className={`transform transition-transform duration-200 ${openFaq === item.id ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {openFaq === item.id && (
                  <div className="p-4 border-t border-slate-200 bg-slate-50/50 text-sm text-slate-600 whitespace-pre-wrap animate-fade-in">{item.answer}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {pageContent?.organizerInfoEnabled && (
        <section>
          <h2 className="text-xl font-bold text-slate-800 text-center mb-6">{pageContent.organizerInfoTitle}</h2>
          <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-wrap text-center">{pageContent.organizerInfoText}</div>
        </section>
      )}
    </div>
  );
};

export default PageContentDisplay;