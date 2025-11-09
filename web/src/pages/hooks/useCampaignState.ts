import { useState, useRef } from "react";
import type { Participant, QuestionnaireFieldType } from "../../types";

export const useCampaignState = () => {
  // Modal and Participation Flow State
  const [modalStep, setModalStep] = useState<
    "closed" | "auth" | "confirm" | "participating" | "result"
  >("closed");
  const [authError, setAuthError] = useState<string | null>(null);
  const [promptToSaveResult, setPromptToSaveResult] = useState(false);
  const pendingAnswersRef = useRef<Record<string, string[] | string> | null>(
    null,
  );
  const [multipleLotteryResults, setMultipleLotteryResults] = useState<
    Participant[]
  >([]);

  // Auth Modal State
  const [authView, setAuthView] = useState<
    "select" | "email_entry" | "email_sent" | "sms_phone" | "sms_code"
  >("select");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [emailForLink, setEmailForLink] = useState("");
  const [smsNumber, setSmsNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const recaptchaVerifierRef = useRef<any>(null);

  // Form States
  const [useMultipleChances, setUseMultipleChances] = useState(false);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<
    Record<string, string | string[]>
  >({});
  const [questionnaireError, setQuestionnaireError] = useState<string | null>(
    null,
  );
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [showApprovalFormModal, setShowApprovalFormModal] = useState(false);
  const [approvalFormData, setApprovalFormData] = useState<
    Record<string, string>
  >({});
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [approvalFormError, setApprovalFormError] = useState<string | null>(
    null,
  );
  const [approvalFormSuccess, setApprovalFormSuccess] = useState(false);
  const [isUploadingApprovalFile, setIsUploadingApprovalFile] = useState<
    Record<string, boolean>
  >({});
  const [approvalFileUploadError, setApprovalFileUploadError] = useState<
    Record<string, string>
  >({});
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactFormData, setContactFormData] = useState<
    Record<string, string>
  >({});
  const [isSubmittingInquiry, setIsSubmittingInquiry] = useState(false);
  const [inquiryError, setInquiryError] = useState<string | null>(null);
  const [inquirySuccess, setInquirySuccess] = useState(false);

  // Interaction States
  const [prizeDetailsInModal, setPrizeDetailsInModal] =
    useState<Participant | null>(null);
  const [shippingAddress, setShippingAddress] = useState<
    Record<string, string>
  >({});
  const [isSubmittingAddress, setIsSubmittingAddress] = useState(false);
  const [shippingAgreements, setShippingAgreements] = useState({
    terms: false,
    privacy: false,
  });
  const [legalModalContent, setLegalModalContent] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [showStoreSelectionModal, setShowStoreSelectionModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [showCouponUsedConfirmation, setShowCouponUsedConfirmation] =
    useState(false);
  const [showTicketRequiredModal, setShowTicketRequiredModal] = useState(false);
  const [isEventParticipationDone, setIsEventParticipationDone] = useState(
    sessionStorage.getItem("eventParticipationDone") === "true",
  );

  const handleAnswerChange = (
    fieldId: string,
    type: QuestionnaireFieldType,
    value: string,
    checked?: boolean,
  ) => {
    setQuestionnaireAnswers((prev) => {
      const newAnswers = { ...prev };
      if (type === "checkbox") {
        const current = (newAnswers[fieldId] as string[]) || [];
        newAnswers[fieldId] = checked
          ? [...current, value]
          : current.filter((v) => v !== value);
      } else {
        newAnswers[fieldId] = value;
      }
      return newAnswers;
    });
  };

  const closeModal = () => {
    setModalStep("closed");
    setAuthError(null);
    setQuestionnaireError(null);
    setTermsAgreed(false);
    setPromptToSaveResult(false);
    setAuthView("select");
    setEmailForLink("");
    setMultipleLotteryResults([]);
    if (recaptchaVerifierRef.current) recaptchaVerifierRef.current.clear();
  };

  const closeApprovalModal = () => {
    setShowApprovalFormModal(false);
    setApprovalFormData({});
    setApprovalFormError(null);
    setApprovalFormSuccess(false);
  };

  const modalState = {
    modalStep,
    setModalStep,
    authError,
    setAuthError,
    promptToSaveResult,
    setPromptToSaveResult,
    multipleLotteryResults,
    setMultipleLotteryResults,
    authView,
    setAuthView,
    isAuthLoading,
    setIsAuthLoading,
    emailForLink,
    setEmailForLink,
    smsNumber,
    setSmsNumber,
    verificationCode,
    setVerificationCode,
    confirmationResult,
    setConfirmationResult,
    recaptchaVerifierRef,
    closeModal,
  };

  const formState = {
    useMultipleChances,
    setUseMultipleChances,
    questionnaireAnswers,
    setQuestionnaireAnswers,
    questionnaireError,
    setQuestionnaireError,
    termsAgreed,
    setTermsAgreed,
    handleAnswerChange,
    pendingAnswersRef,
    showApprovalFormModal,
    setShowApprovalFormModal,
    approvalFormData,
    setApprovalFormData,
    isSubmittingApproval,
    setIsSubmittingApproval,
    approvalFormError,
    setApprovalFormError,
    approvalFormSuccess,
    setApprovalFormSuccess,
    isUploadingApprovalFile,
    setIsUploadingApprovalFile,
    approvalFileUploadError,
    setApprovalFileUploadError,
    closeApprovalModal,
    showContactModal,
    setShowContactModal,
    contactFormData,
    setContactFormData,
    isSubmittingInquiry,
    setIsSubmittingInquiry,
    inquiryError,
    setInquiryError,
    inquirySuccess,
    setInquirySuccess,
  };

  const interactionState = {
    prizeDetailsInModal,
    setPrizeDetailsInModal,
    shippingAddress,
    setShippingAddress,
    isSubmittingAddress,
    setIsSubmittingAddress,
    shippingAgreements,
    setShippingAgreements,
    legalModalContent,
    setLegalModalContent,
    openFaq,
    setOpenFaq,
    showStoreSelectionModal,
    setShowStoreSelectionModal,
    selectedStore,
    setSelectedStore,
    showCouponUsedConfirmation,
    setShowCouponUsedConfirmation,
    showTicketRequiredModal,
    setShowTicketRequiredModal,
    isEventParticipationDone,
    setIsEventParticipationDone,
  };

  return { modalState, formState, interactionState };
};
