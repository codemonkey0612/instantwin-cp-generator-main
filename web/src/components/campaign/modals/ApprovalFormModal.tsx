import React from 'react';
import type { Campaign } from '../../../types';
import Spinner from '../../Spinner';

// FIX: Removed redundant props 'approvalFormTitle', 'approvalFormDescription', and 'approvalFormFields'.
// These values are already available within the 'campaign' prop.
interface ApprovalFormModalProps {
  showApprovalFormModal: boolean;
  closeApprovalModal: () => void;
  campaign: Campaign;
  approvalFormSuccess: boolean;
  handleApprovalFormSubmit: (e: React.FormEvent) => void;
  approvalFormData: Record<string, string>;
  setApprovalFormData: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  // FIX: Added missing prop
  handleApprovalFileUpload: (file: File, fieldId: string) => void;
  isUploadingApprovalFile: Record<string, boolean>;
  approvalFileUploadError: Record<string, string>;
  approvalFormError: string | null;
  isSubmittingApproval: boolean;
}

const ApprovalFormModal: React.FC<ApprovalFormModalProps> = ({
  showApprovalFormModal,
  closeApprovalModal,
  campaign,
  approvalFormSuccess,
  handleApprovalFormSubmit,
  approvalFormData,
  setApprovalFormData,
  handleApprovalFileUpload,
  isUploadingApprovalFile,
  approvalFileUploadError,
  approvalFormError,
  isSubmittingApproval,
}) => {
  if (!showApprovalFormModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={e => {if(e.target === e.currentTarget) closeApprovalModal()}}>
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full transform transition-all duration-300 scale-95 animate-modal-pop max-h-[85vh] relative flex flex-col">
        <button onClick={closeApprovalModal} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-800 bg-white/60 backdrop-blur-sm rounded-full transition-colors z-20" aria-label="閉じる">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="overflow-y-auto px-6 pb-6 pt-12 sm:px-8 sm:pb-8 sm:pt-12">
          {approvalFormSuccess ? (
            <div className="text-center py-8">
              <h2 className="text-xl font-bold text-green-700 mb-4">申請完了</h2>
              <p className="text-slate-600 mb-6">参加申請をありがとうございました。現在審査中です。結果は改めてこのページに表示されます。</p>
              <button onClick={closeApprovalModal} style={{ backgroundColor: 'var(--theme-color, #4F46E5)' }} className="px-6 py-2 text-white font-semibold rounded-lg hover:opacity-90">閉じる</button>
            </div>
          ) : (
            <form onSubmit={handleApprovalFormSubmit} className="space-y-4">
              <h2 className="text-xl font-bold text-slate-800">{campaign.approvalFormTitle}</h2>
              <p className="text-sm text-slate-600">{campaign.approvalFormDescription}</p>
              {(campaign.approvalFormFields || []).map(field => (
                <div key={field.id}>
                  <label htmlFor={`approval-${field.id}`} className="block text-sm font-medium text-slate-700 mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea id={`approval-${field.id}`} value={approvalFormData[field.id] || ''} onChange={e => setApprovalFormData(prev => ({...prev, [field.id]: e.target.value}))} required={field.required} rows={4} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm"/>
                  ) : field.type === 'file' ? (
                    <div>
                      <input
                        type="file"
                        id={`approval-${field.id}`}
                        accept="image/*"
                        onChange={e => e.target.files && e.target.files[0] && handleApprovalFileUpload(e.target.files[0], field.id)}
                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
                        required={field.required && !approvalFormData[field.id]}
                        disabled={isUploadingApprovalFile[field.id]}
                      />
                      {isUploadingApprovalFile[field.id] && <div className="mt-2 flex items-center gap-2 text-sm text-slate-500"><Spinner size="sm" /><span>アップロード中...</span></div>}
                      {approvalFileUploadError[field.id] && <p className="text-xs text-red-500 mt-1">{approvalFileUploadError[field.id]}</p>}
                      {approvalFormData[field.id] && !isUploadingApprovalFile[field.id] && (
                        <div className="mt-2">
                            <img src={approvalFormData[field.id]} alt="プレビュー" className="h-20 w-auto object-cover rounded-md border" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <input type={field.type} id={`approval-${field.id}`} value={approvalFormData[field.id] || ''} onChange={e => setApprovalFormData(prev => ({...prev, [field.id]: e.target.value}))} required={field.required} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm"/>
                  )}
                </div>
              ))}
              {approvalFormError && <p className="text-sm text-red-600 text-center">{approvalFormError}</p>}
              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={isSubmittingApproval} style={{ backgroundColor: 'var(--theme-color, #4F46E5)' }} className="px-6 py-2.5 text-white font-semibold rounded-lg hover:opacity-90 disabled:bg-slate-300 flex items-center">
                  {isSubmittingApproval ? <Spinner size="sm" className="mr-2"/> : '申請する'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApprovalFormModal;