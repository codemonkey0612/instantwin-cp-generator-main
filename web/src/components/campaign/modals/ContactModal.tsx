import React from 'react';
import type { Campaign, ContactField } from '../../../types';
import Spinner from '../../Spinner';

interface ContactModalProps {
  showContactModal: boolean;
  setShowContactModal: (show: boolean) => void;
  campaign: Campaign;
  inquirySuccess: boolean;
  // FIX: Update signature to match implementation in hook
  handleInquirySubmit: (e: React.FormEvent) => void;
  contactFieldsToRender: ContactField[];
  contactFormData: Record<string, string>;
  setContactFormData: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  inquiryError: string | null;
  isSubmittingInquiry: boolean;
}

const ContactModal: React.FC<ContactModalProps> = ({
  showContactModal,
  setShowContactModal,
  campaign,
  inquirySuccess,
  handleInquirySubmit,
  contactFieldsToRender,
  contactFormData,
  setContactFormData,
  inquiryError,
  isSubmittingInquiry,
}) => {
  if (!showContactModal) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) setShowContactModal(false); }}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full transform transition-all duration-300 scale-95 animate-modal-pop max-h-[85vh] relative flex flex-col">
          <button onClick={() => setShowContactModal(false)} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-800 bg-white/60 backdrop-blur-sm rounded-full transition-colors z-20" aria-label="閉じる">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="overflow-y-auto px-6 pb-6 pt-12 sm:px-8 sm:pb-8 sm:pt-12">
              <h2 className="text-xl font-bold text-slate-800 mb-2">{campaign.contactFormTitle || 'お問い合わせ'}</h2>
              <p className="text-sm text-slate-600 mb-6">{campaign.contactFormDescription || 'キャンペーンに関するご質問はこちらから'}</p>
              
              {inquirySuccess ? (
                  <div className="text-center py-8">
                      <p className="text-green-700 font-semibold">{campaign.contactSuccessMessage || 'お問い合わせありがとうございます。'}</p>
                      <button onClick={() => setShowContactModal(false)} style={{ backgroundColor: 'var(--theme-color, #4F46E5)' }} className="mt-6 px-6 py-2 text-white font-semibold rounded-lg hover:opacity-90 transition-colors">閉じる</button>
                  </div>
              ) : (
                  <form onSubmit={handleInquirySubmit} className="space-y-4">
                      {contactFieldsToRender.map(field => (
                        <div key={field.id}>
                          <label htmlFor={`contact-${field.id}`} className="block text-sm font-medium text-slate-700 mb-1">
                              {field.label}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          {field.type === 'textarea' ? (
                              <textarea
                                  id={`contact-${field.id}`}
                                  value={contactFormData[field.id] || ''}
                                  onChange={e => setContactFormData(prev => ({...prev, [field.id]: e.target.value}))}
                                  rows={5}
                                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-[var(--theme-color, #4F46E5)] focus:border-[var(--theme-color, #4F46E5)]"
                                  required={field.required}
                              />
                          ) : (
                              <input
                                  type={field.type}
                                  id={`contact-${field.id}`}
                                  value={contactFormData[field.id] || ''}
                                  onChange={e => setContactFormData(prev => ({...prev, [field.id]: e.target.value}))}
                                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-[var(--theme-color, #4F46E5)] focus:border-[var(--theme-color, #4F46E5)]"
                                  required={field.required}
                              />
                          )}
                        </div>
                      ))}
                      {inquiryError && <p className="text-sm text-red-600 text-center">{inquiryError}</p>}
                      <div className="flex justify-end gap-3 pt-2">
                          <button type="button" onClick={() => setShowContactModal(false)} className="px-4 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-colors">キャンセル</button>
                          <button type="submit" disabled={isSubmittingInquiry} style={{ backgroundColor: 'var(--theme-color, #4F46E5)' }} className="px-4 py-2 text-white font-semibold rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 flex items-center">
                              {isSubmittingInquiry && <Spinner size="sm" className="mr-2" />}
                              送信
                          </button>
                      </div>
                  </form>
              )}
          </div>
      </div>
    </div>
  );
};

export default ContactModal;