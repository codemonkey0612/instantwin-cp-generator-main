// types.ts

export interface Client {
  id: string;
  name: string;
  createdAt?: Date;
}

export type CampaignStatus = "draft" | "published" | "archived";

export type ParticipantAuthMethod = "anonymous" | "required" | "optional";

export interface AuthProviders {
  email?: boolean;
  google?: boolean;
  line?: boolean;
  sms?: boolean;
}

export type PrizeType = "e-coupon" | "url" | "mail-delivery";

export interface ShippingField {
  id: string;
  label: string;
  enabled: boolean;
  required: boolean;
}

export interface Prize {
  id: string;
  title: string;
  rank: string;
  rankColor?: string;
  description: string;
  imageUrl: string;
  stock: number;
  unlimitedStock: boolean;
  type: PrizeType;
  winnersCount?: number;
  probability?: number; // 当選者の中での配分率 (%)
  validFrom?: Date;
  validTo?: Date;

  // e-coupon
  couponTerms?: string;
  availableStores?: string[];
  couponUsageLimit?: number;
  preventReusingAtSameStore?: boolean;

  // url
  urlStockList?: string[];

  // physical (obsolete but keeping field for data compatibility)
  deliveryInstructions?: string;

  // mail-delivery
  shippingFields?: ShippingField[];
}

export type QuestionnaireFieldType =
  | "text"
  | "textarea"
  | "radio"
  | "checkbox"
  | "select";

export interface QuestionnaireField {
  id: string;
  question: string;
  type: QuestionnaireFieldType;
  options?: string[]; // For radio, checkbox, select
  required: boolean;
}

export interface ContactField {
  id: string;
  label: string;
  type: "text" | "email" | "textarea";
  enabled: boolean;
  required: boolean;
}

// Page Content Types
export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export type ParticipationGuideType = "steps" | "custom_text";

export interface ParticipationStep {
  id: string;
  title: string;
  description: string;
}

export interface FooterTextLink {
  id: string;
  text: string;
  url: string;
}

export interface FooterBannerLink {
  id: string;
  imageUrl: string;
  url: string;
  altText: string;
}

export interface PageContent {
  // FAQ
  faqEnabled?: boolean;
  faqTitle?: string;
  faqItems?: FaqItem[];

  // How to Participate
  participationGuideEnabled?: boolean;
  participationGuideTitle?: string;
  participationGuideType?: ParticipationGuideType;
  participationGuideSteps?: ParticipationStep[];
  participationGuideCustomText?: string;

  // Organizer Info
  organizerInfoEnabled?: boolean;
  organizerInfoTitle?: string;
  organizerInfoText?: string;

  // Legal
  termsOfServiceEnabled?: boolean;
  termsOfServiceLinkText?: string;
  termsOfServiceContent?: string;

  privacyPolicyEnabled?: boolean;
  privacyPolicyLinkText?: string;
  privacyPolicyContent?: string;

  // Footer
  footerTextLinks?: FooterTextLink[];
  footerBannerLinks?: FooterBannerLink[];
  footerOperatorInfo?: string;
}

export interface DesignSettings {
  mainVisual?: {
    enabled?: boolean;
    imageUrl?: string;
  };
  themeColor?: string;
  background?: {
    type?: "color" | "image";
    color?: string;
    imageUrl?: string;
  };
}

export interface ApprovalFormField {
  id: string;
  label: string;
  type: "text" | "textarea" | "email" | "file";
  required: boolean;
}

export interface ParticipationTicket {
  id: string;
  label: string;
  token: string;
  chancesToGrant?: number;
}

export interface ClaimedTicket {
  id: string;
  claimedAt: Date;
  chancesGranted: number;
  ticketId: string;
}

// --- Presentation Settings ---
export type PresentationType = "simple" | "lottery-box" | "gacha" | "scratch";

export interface SoundSettings {
  enabled?: boolean;
  participationSoundUrl?: string; // 参加ボタンクリック時
  drawingSoundUrl?: string; // 抽選中
  winSoundUrl?: string; // 当たり
  loseSoundUrl?: string; // ハズレ
}

export interface AnimationSettings {
  // 抽選中アニメーション
  drawingAnimationImageUrl?: string;
  drawingAnimationVideoUrl?: string;
  // 当たりアニメーション
  winAnimationImageUrl?: string;
  winAnimationVideoUrl?: string;
  // ハズレアニメーション
  loseAnimationImageUrl?: string;
  loseAnimationVideoUrl?: string;
}

export interface PresentationSettings {
  type?: PresentationType;
  participationButtonText?: string;
  soundSettings?: SoundSettings;
  animationSettings?: AnimationSettings;
}
// --- End Presentation Settings ---

export interface Campaign {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  createdAt?: Date;
  showNameOnPublicPage?: boolean;

  // 期間設定
  publishStartDate?: Date;
  publishEndDate?: Date;
  publishPeriodOutOfRangeMessage?: string;
  applicationStartDate?: Date;
  applicationEndDate?: Date;
  applicationPeriodOutOfRangeMessage?: string;

  // 参加者認証
  participantAuthMethod?: ParticipantAuthMethod;
  authProviders?: AuthProviders;

  // ルール設定
  ruleText?: string;
  overallWinProbability?: number; // 全体の当選確率 (%)
  prizes?: Prize[]; // 特典
  showPrizeCountsOnPublicPage?: boolean; // 特典の在庫数を公開ページに表示するか
  participationLimitPerUser?: number; // 0 or undefined for unlimited
  participationIntervalHours?: number;
  participationIntervalMinutes?: number;
  preventDuplicatePrizes?: boolean; // 同じ特典の重複当選を許可しない
  outOfStockBehavior?: "show_loss" | "prevent_participation";
  consolationPrize?: Prize;
  questionnaireFields?: QuestionnaireField[];

  // 新しい参加条件
  requireTicket?: boolean;
  participationTickets?: ParticipationTicket[];
  requireFormApproval?: boolean;
  approvalFormTitle?: string;
  approvalFormDescription?: string;
  approvalFormSuccessMessage?: string;
  approvalFormFields?: ApprovalFormField[];
  ticketUsage?: {
    [ticketId: string]: {
      label: string;
      count: number;
    };
  };

  // Contact Form Settings
  contactEnabled?: boolean;
  contactFormTitle?: string;
  contactFormDescription?: string;
  contactSuccessMessage?: string;
  contactFields?: ContactField[];
  contactNotificationEmail?: string;

  // Page Content
  pageContent?: PageContent;

  // Design Settings
  designSettings?: DesignSettings;

  // Presentation Settings
  presentationSettings?: PresentationSettings;

  // Event Mode
  eventMode?: {
    enabled?: boolean;
    chancesToGrant?: number;
  };
}

export interface Participant {
  id: string;
  campaignId: string;
  userId: string;
  authInfo: {
    provider: string;
    identifier: string;
  };
  wonAt: Date;
  prizeId: string;
  prizeDetails: Prize;
  assignedUrl?: string;
  couponUsed?: boolean;
  couponUsedCount?: number;
  couponUsageHistory?: { store: string; usedAt: Date }[];
  shippingAddress?: Record<string, string>; // Flexible address object
  isConsolationPrize?: boolean;
  questionnaireAnswers?: Record<string, string | string[]>;
}

export interface Inquiry {
  id: string;
  campaignId: string;
  userId?: string;
  authInfo?: {
    provider: string;
    identifier: string;
  };
  formData: Record<string, string>;
  createdAt: Date;
}

export interface ParticipationRequest {
  id: string;
  campaignId: string;
  userId: string;
  authInfo: {
    provider: string;
    identifier: string;
  };
  formData: Record<string, string>;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string; // admin user email
}
