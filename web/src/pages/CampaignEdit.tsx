import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useParams, Link } from "react-router-dom";
import { db, Timestamp, storage, FieldValue } from "../firebase";
import type {
  Client,
  Campaign,
  Participant,
  Inquiry,
  ParticipantAuthMethod,
  AuthProviders,
  Prize,
  PrizeType,
  ShippingField,
  QuestionnaireField,
  QuestionnaireFieldType,
  ContactField,
  PageContent,
  DesignSettings,
  ApprovalFormField,
  ParticipationRequest,
  ParticipationTicket,
  PresentationSettings,
  PresentationType,
  SoundSettings,
  AnimationSettings,
} from "../types";
import ChevronRightIcon from "../components/icons/ChevronRightIcon";
import Spinner from "../components/Spinner";
import { useToast } from "../components/ToastProvider";
import { statusBadge } from "./ClientDetails";
import CopyIcon from "../components/icons/CopyIcon";
import TrashIcon from "../components/icons/TrashIcon";
import PlusIcon from "../components/icons/PlusIcon";
import SurveyResultsDashboard from "../components/SurveyResultsDashboard";
import ImageCropper from "../components/ImageCropper";
import PencilIcon from "../components/icons/PencilIcon";

const MENU_ITEMS = [
  "ダッシュボード",
  "申請管理",
  "参加者管理",
  "基本設定",
  "ページコンテンツ",
  "デザイン",
  "演出",
  "期間設定",
  "参加者認証",
  "ルール設定",
  "景品",
  "アンケート",
  "お問い合わせ",
];

const RANK_COLORS = ["#6366F1", "#38BDF8", "#34D399", "#FBBF24", "#F43F5E"]; // indigo, sky, emerald, amber, rose

const DEFAULT_SOUNDS: Record<
  PresentationType,
  Omit<SoundSettings, "enabled">
> = {
  simple: {
    participationSoundUrl:
      "https://www.mihatsu.com/assets/instantwin/tyusen-zikko.mp3",
    drawingSoundUrl:
      "https://www.mihatsu.com/assets/instantwin/tyusen-zikkotyu.mp3",
    winSoundUrl: "https://www.mihatsu.com/assets/instantwin/tyusen-tousen.mp3",
    loseSoundUrl: "https://www.mihatsu.com/assets/instantwin/tyusen-zannen.mp3",
  },
  "lottery-box": {
    participationSoundUrl:
      "https://www.mihatsu.com/assets/instantwin/kuji-zikko.mp3",
    drawingSoundUrl:
      "https://www.mihatsu.com/assets/instantwin/kuji-zikkotyu.mp3",
    winSoundUrl: "https://www.mihatsu.com/assets/instantwin/kujii-tousen.mp3",
    loseSoundUrl: "https://www.mihatsu.com/assets/instantwin/kuji-zannen.mp3",
  },
  gacha: {
    participationSoundUrl:
      "https://www.mihatsu.com/assets/instantwin/gatya-zikko.mp3",
    drawingSoundUrl:
      "https://www.mihatsu.com/assets/instantwin/gatya-zikkotyu.mp3",
    winSoundUrl: "https://www.mihatsu.com/assets/instantwin/gatya-tousen.mp3",
    loseSoundUrl: "https://www.mihatsu.com/assets/instantwin/gatya-zannen.mp3",
  },
  scratch: {
    participationSoundUrl:
      "https://www.mihatsu.com/assets/instantwin/sukuratti-zikko.mp3",
    drawingSoundUrl:
      "https://www.mihatsu.com/assets/instantwin/sukuratti-zikkotyu.mp3",
    winSoundUrl:
      "https://www.mihatsu.com/assets/instantwin/sukuratti-tousen.mp3",
    loseSoundUrl:
      "https://www.mihatsu.com/assets/instantwin/sukuratti-zannen.mp3",
  },
};

const DEFAULT_ANIMATIONS: AnimationSettings = {
  drawingAnimationImageUrl:
    "https://www.mihatsu.com/assets/instantwin/loading.gif",
  winAnimationImageUrl: "https://www.mihatsu.com/assets/instantwin/tousen.gif",
  loseAnimationImageUrl: "https://www.mihatsu.com/assets/instantwin/zannen.gif",
  drawingAnimationVideoUrl: "",
  winAnimationVideoUrl: "",
  loseAnimationVideoUrl: "",
};

const toDateTimeLocalString = (date: Date | undefined | null): string => {
  if (!date) return "";
  const d = new Date(date);
  const tzOffset = d.getTimezoneOffset() * 60000;
  const localISOTime = new Date(d.getTime() - tzOffset)
    .toISOString()
    .slice(0, 16);
  return localISOTime;
};

const toDateInputString = (date: Date | undefined | null): string => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const localDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return localDate.toISOString().split("T")[0];
};

const getDefaultShippingFields = (): ShippingField[] => [
  { id: "name", label: "氏名", enabled: true, required: true },
  { id: "zipCode", label: "郵便番号", enabled: true, required: true },
  { id: "prefecture", label: "都道府県", enabled: true, required: true },
  { id: "city", label: "市区町村", enabled: true, required: true },
  { id: "address1", label: "番地・建物名", enabled: true, required: true },
  {
    id: "address2",
    label: "部屋番号など (任意)",
    enabled: true,
    required: false,
  },
  { id: "phone", label: "電話番号", enabled: true, required: true },
];

const getDefaultContactFields = (): ContactField[] => [
  { id: "name", label: "お名前", type: "text", enabled: true, required: true },
  {
    id: "email",
    label: "メールアドレス",
    type: "email",
    enabled: true,
    required: true,
  },
  {
    id: "message",
    label: "お問い合わせ内容",
    type: "textarea",
    enabled: true,
    required: true,
  },
];

const getDefaultApprovalFormFields = (): ApprovalFormField[] => [
  { id: "name", label: "お名前", type: "text", required: true },
  { id: "email", label: "メールアドレス", type: "email", required: true },
  { id: "reason", label: "申請理由", type: "textarea", required: false },
];

const getDefaultPageContent = (): PageContent => ({
  faqEnabled: false,
  faqTitle: "よくある質問",
  faqItems: [],
  participationGuideEnabled: false,
  participationGuideTitle: "参加方法",
  participationGuideType: "steps",
  participationGuideSteps: [],
  participationGuideCustomText: "",
  organizerInfoEnabled: false,
  organizerInfoTitle: "主催者情報",
  organizerInfoText: "",
  termsOfServiceEnabled: false,
  termsOfServiceLinkText: "利用規約",
  termsOfServiceContent: "",
  privacyPolicyEnabled: false,
  privacyPolicyLinkText: "プライバシーポリシー",
  privacyPolicyContent: "",
  footerTextLinks: [],
  footerBannerLinks: [],
  footerOperatorInfo: `© ${new Date().getFullYear()} Your Company Name`,
});

const getDefaultDesignSettings = (): DesignSettings => ({
  mainVisual: {
    enabled: false,
    imageUrl: "",
  },
  themeColor: "#1E293B", // slate-800
  background: {
    type: "color",
    color: "#F1F5F9", // slate-100
    imageUrl: "",
  },
});

const getDefaultPresentationSettings = (): PresentationSettings => ({
  type: "simple",
  participationButtonText: "抽選に参加する",
  soundSettings: {
    enabled: false,
    participationSoundUrl: "",
    drawingSoundUrl: "",
    winSoundUrl: "",
    loseSoundUrl: "",
  },
  animationSettings: {
    drawingAnimationImageUrl: "",
    drawingAnimationVideoUrl: "",
    winAnimationImageUrl: "",
    winAnimationVideoUrl: "",
    loseAnimationImageUrl: "",
    loseAnimationVideoUrl: "",
  },
});

const getDefaultPrize = (id: string): Prize => ({
  id,
  title: "",
  rank: "",
  rankColor: "#6366F1",
  description: "",
  imageUrl: "",
  stock: 1,
  unlimitedStock: false,
  type: "e-coupon",
  winnersCount: 0,
  probability: 0,
  validFrom: undefined,
  validTo: undefined,
  couponTerms: "",
  availableStores: [],
  couponUsageLimit: 1,
  preventReusingAtSameStore: false,
  urlStockList: [],
  deliveryInstructions: "",
  shippingFields: getDefaultShippingFields(),
});

const requestStatusBadge = (status: ParticipationRequest["status"]) => {
  switch (status) {
    case "pending":
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
          審査中
        </span>
      );
    case "approved":
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
          承認済
        </span>
      );
    case "rejected":
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
          却下済
        </span>
      );
  }
};

const CampaignEdit: React.FC = () => {
  const { clientId, campaignId } = useParams<{
    clientId: string;
    campaignId: string;
  }>();
  const { showToast } = useToast();

  const [client, setClient] = useState<Client | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const campaignUrl =
    new URL(window.location.href).origin + `/campaign/${campaignId}`;
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState<{
    [id: string]: boolean;
  }>({});

  const [activeMenu, setActiveMenu] = useState(MENU_ITEMS[0]);

  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [participationRequests, setParticipationRequests] = useState<
    ParticipationRequest[]
  >([]);
  const [participantOverrides, setParticipantOverrides] = useState<
    Map<string, number>
  >(new Map());
  const [isParticipantsLoading, setIsParticipantsLoading] = useState(false);
  
  // Pagination state
  const PARTICIPANTS_PER_PAGE = 50;
  const [participantsLastDoc, setParticipantsLastDoc] = useState<any>(null);
  const [hasMoreParticipants, setHasMoreParticipants] = useState(false);
  const [isLoadingMoreParticipants, setIsLoadingMoreParticipants] = useState(false);
  
  // Graph date range state
  const [graphStartDate, setGraphStartDate] = useState<Date | null>(null);
  const [graphEndDate, setGraphEndDate] = useState<Date | null>(null);
  const [graphParticipants, setGraphParticipants] = useState<Participant[]>([]);
  const [allGraphParticipants, setAllGraphParticipants] = useState<Participant[]>([]);
  const [isLoadingGraphData, setIsLoadingGraphData] = useState(false);
  
  // Temporary date inputs (before confirmation)
  const [tempStartDate, setTempStartDate] = useState<string>('');
  const [tempEndDate, setTempEndDate] = useState<string>('');
  const [isActionLoading, setIsActionLoading] = useState<{
    id: string;
    action: "grant" | "delete" | "approved" | "rejected";
  } | null>(null);

  const [viewingRequest, setViewingRequest] =
    useState<ParticipationRequest | null>(null);

  const [campaignName, setCampaignName] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");
  const [showNameOnPublicPage, setShowNameOnPublicPage] = useState(true);
  const [eventModeEnabled, setEventModeEnabled] = useState(false);
  const [eventModeChancesToGrant, setEventModeChancesToGrant] = useState<
    number | string
  >(1);

  const [pageContent, setPageContent] = useState<PageContent>(
    getDefaultPageContent(),
  );
  const [designSettings, setDesignSettings] = useState<DesignSettings>(
    getDefaultDesignSettings(),
  );
  const [croppingConfig, setCroppingConfig] = useState<{
    src: string;
    onComplete: (dataUrl: string) => void;
  } | null>(null);
  const [presentationSettings, setPresentationSettings] =
    useState<PresentationSettings>(getDefaultPresentationSettings());

  const [publishStartDate, setPublishStartDate] = useState("");
  const [publishEndDate, setPublishEndDate] = useState("");
  const [publishOutOfRangeMsg, setPublishOutOfRangeMsg] = useState("");
  const [appStartDate, setAppStartDate] = useState("");
  const [appEndDate, setAppEndDate] = useState("");
  const [appOutOfRangeMsg, setAppOutOfRangeMsg] = useState("");

  const [participantAuthMethod, setParticipantAuthMethod] =
    useState<ParticipantAuthMethod>("anonymous");
  const [authProviders, setAuthProviders] = useState<AuthProviders>({
    email: false,
    google: false,
    line: false,
    sms: false,
  });

  const [overallWinProbability, setOverallWinProbability] = useState<
    number | string
  >(100);
  const [participationLimitPerUser, setParticipationLimitPerUser] = useState<
    number | string
  >(1);
  const [participationIntervalHours, setParticipationIntervalHours] = useState<
    number | string
  >(0);
  const [participationIntervalMinutes, setParticipationIntervalMinutes] =
    useState<number | string>(0);
  const [preventDuplicatePrizes, setPreventDuplicatePrizes] = useState(false);
  const [outOfStockBehavior, setOutOfStockBehavior] = useState<
    "show_loss" | "prevent_participation"
  >("show_loss");
  const [requireTicket, setRequireTicket] = useState(false);
  const [participationTickets, setParticipationTickets] = useState<
    ParticipationTicket[]
  >([]);
  const [requireFormApproval, setRequireFormApproval] = useState(false);
  const [approvalFormTitle, setApprovalFormTitle] =
    useState("参加申請フォーム");
  const [approvalFormDescription, setApprovalFormDescription] = useState(
    "参加をご希望の方は、以下のフォームを送信してください。",
  );
  const [approvalFormSuccessMessage, setApprovalFormSuccessMessage] = useState(
    "申請を受け付けました。承認までしばらくお待ちください。",
  );
  const [approvalFormFields, setApprovalFormFields] = useState<
    ApprovalFormField[]
  >(getDefaultApprovalFormFields());

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [consolationPrize, setConsolationPrize] = useState<Prize | null>(null);
  const [showPrizeCountsOnPublicPage, setShowPrizeCountsOnPublicPage] =
    useState(false);

  const [questionnaireFields, setQuestionnaireFields] = useState<
    QuestionnaireField[]
  >([]);

  const [contactEnabled, setContactEnabled] = useState(false);
  const [contactFormTitle, setContactFormTitle] = useState("");
  const [contactFormDescription, setContactFormDescription] = useState("");
  const [contactSuccessMessage, setContactSuccessMessage] = useState("");
  const [contactFields, setContactFields] = useState<ContactField[]>([]);
  const [contactNotificationEmail, setContactNotificationEmail] = useState("");
  const [showFunctionCode, setShowFunctionCode] = useState(false);

  const [tableScroll, setTableScroll] = useState({ left: false, right: false });
  const participantTableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (campaignName) {
      document.title = `インスタントウィン管理画面｜${campaignName}`;
    } else {
      document.title = "インスタントウィン管理画面｜プロジェクト";
    }
  }, [campaignName]);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const handleParticipantTableScroll = useCallback(() => {
    const el = participantTableRef.current;
    if (el) {
      // 1px以上の余裕を持たせることで、計算誤差によるちらつきを防ぐ
      const right = el.scrollWidth - el.scrollLeft - el.clientWidth > 1;
      const left = el.scrollLeft > 1;
      setTableScroll({ left, right });
    }
  }, []);

  useEffect(() => {
    if (activeMenu === "参加者管理" && !isParticipantsLoading) {
      // データがレンダリングされた後にスクロール状態をチェック
      const timer = setTimeout(() => {
        handleParticipantTableScroll();
      }, 100);

      const container = participantTableRef.current;
      if (container) {
        window.addEventListener("resize", handleParticipantTableScroll);
      }

      return () => {
        clearTimeout(timer);
        if (container) {
          window.removeEventListener("resize", handleParticipantTableScroll);
        }
      };
    }
  }, [
    activeMenu,
    isParticipantsLoading,
    allParticipants,
    handleParticipantTableScroll,
  ]);

  const handlePresentationTypeChange = (newType: PresentationType) => {
    setPresentationSettings((prev) => {
      let buttonText = "抽選に参加する";
      switch (newType) {
        case "lottery-box":
          buttonText = "くじを引く";
          break;
        case "gacha":
          buttonText = "ガチャを回す";
          break;
        case "scratch":
          buttonText = "スクラッチを削る";
          break;
      }

      const newSettings = {
        ...prev,
        type: newType,
      };

      const defaultTexts = [
        "抽選に参加する",
        "くじを引く",
        "ガチャを回す",
        "スクラッチを削る",
        "",
      ];
      if (defaultTexts.includes(prev.participationButtonText || "")) {
        newSettings.participationButtonText = buttonText;
      }

      const defaultSounds = DEFAULT_SOUNDS[newType];
      newSettings.soundSettings = {
        ...(prev.soundSettings || { enabled: false }),
        ...defaultSounds,
      };

      newSettings.animationSettings = {
        ...(prev.animationSettings || {}),
        ...DEFAULT_ANIMATIONS,
      };

      return newSettings;
    });
  };

  useEffect(() => {
    const fetchCampaignData = async () => {
      if (!clientId || !campaignId) return;
      setLoading(true);
      try {
        const clientDocRef = db.collection("clients").doc(clientId);
        const clientDocSnap = await clientDocRef.get();
        if (clientDocSnap.exists) {
          const data = clientDocSnap.data();

          if (!data) throw new Error("Client data is undefined");

          setClient({
            id: clientDocSnap.id,
            name: data.name,
            createdAt: (
              data.createdAt as InstanceType<typeof Timestamp>
            )?.toDate(),
          } as Client);
        }

        const campaignDocRef = db.collection("campaigns").doc(campaignId);
        const campaignDocSnap = await campaignDocRef.get();
        if (campaignDocSnap.exists) {
          const data = campaignDocSnap.data();

          if (!data) throw new Error("Campaign data is undefined");

          const prizesData = (data.prizes || []).map((p: any) => ({
            id: p.id || `compat_${Date.now()}`,
            title: p.title || p.name || "",
            rank: p.rank || "",
            rankColor: p.rankColor || "#6366F1",
            description: p.description || "",
            imageUrl: p.imageUrl || "",
            stock: p.stock ?? 0,
            unlimitedStock: p.unlimitedStock ?? false,
            type: p.type || "e-coupon",
            winnersCount: p.winnersCount || 0,
            probability: p.probability ?? 0,
            validFrom: (
              p.validFrom as InstanceType<typeof Timestamp>
            )?.toDate(),
            validTo: (p.validTo as InstanceType<typeof Timestamp>)?.toDate(),
            couponTerms: p.couponTerms || "",
            availableStores: p.availableStores || [],
            couponUsageLimit: p.couponUsageLimit || 1,
            preventReusingAtSameStore: p.preventReusingAtSameStore || false,
            urlStockList: p.urlStockList || [],
            deliveryInstructions: p.deliveryInstructions || "",
            shippingFields:
              p.shippingFields ||
              (p.type === "mail-delivery" ? getDefaultShippingFields() : []),
          }));

          const consolationPrizeData = data.consolationPrize
            ? {
                ...data.consolationPrize,
                validFrom: (
                  data.consolationPrize.validFrom as InstanceType<
                    typeof Timestamp
                  >
                )?.toDate(),
                validTo: (
                  data.consolationPrize.validTo as InstanceType<
                    typeof Timestamp
                  >
                )?.toDate(),
              }
            : null;

          const campaignData = {
            id: campaignDocSnap.id,
            clientId: data.clientId,
            name: data.name,
            description: data.description,
            status: data.status,
            showNameOnPublicPage: data.showNameOnPublicPage,
            publishStartDate: (
              data.publishStartDate as InstanceType<typeof Timestamp>
            )?.toDate(),
            publishEndDate: (
              data.publishEndDate as InstanceType<typeof Timestamp>
            )?.toDate(),
            publishPeriodOutOfRangeMessage: data.publishPeriodOutOfRangeMessage,
            applicationStartDate: (
              data.applicationStartDate as InstanceType<typeof Timestamp>
            )?.toDate(),
            applicationEndDate: (
              data.applicationEndDate as InstanceType<typeof Timestamp>
            )?.toDate(),
            applicationPeriodOutOfRangeMessage:
              data.applicationPeriodOutOfRangeMessage,
            participantAuthMethod: data.participantAuthMethod,
            authProviders: data.authProviders,
            ruleText: data.ruleText,
            overallWinProbability: data.overallWinProbability,
            prizes: prizesData,
            showPrizeCountsOnPublicPage: data.showPrizeCountsOnPublicPage,
            participationLimitPerUser: data.participationLimitPerUser,
            participationIntervalHours: data.participationIntervalHours,
            participationIntervalMinutes: data.participationIntervalMinutes,
            preventDuplicatePrizes: data.preventDuplicatePrizes,
            outOfStockBehavior: data.outOfStockBehavior,
            consolationPrize: consolationPrizeData,
            questionnaireFields: data.questionnaireFields || [],
            requireTicket: data.requireTicket,
            participationTickets: data.participationTickets,
            ticketUsage: data.ticketUsage,
            requireFormApproval: data.requireFormApproval,
            approvalFormTitle: data.approvalFormTitle,
            approvalFormDescription: data.approvalFormDescription,
            approvalFormSuccessMessage: data.approvalFormSuccessMessage,
            approvalFormFields: data.approvalFormFields,
            contactEnabled: data.contactEnabled,
            contactFormTitle: data.contactFormTitle,
            contactFormDescription: data.contactFormDescription,
            contactSuccessMessage: data.contactSuccessMessage,
            contactFields: data.contactFields,
            contactNotificationEmail: data.contactNotificationEmail,
            pageContent: data.pageContent,
            designSettings: data.designSettings,
            presentationSettings: data.presentationSettings,
            createdAt: (
              data.createdAt as InstanceType<typeof Timestamp>
            )?.toDate(),
            eventMode: data.eventMode,
          } as Campaign;
          setCampaign(campaignData);
          setCampaignName(campaignData.name);
          setCampaignDescription(campaignData.description || "");
          setShowNameOnPublicPage(campaignData.showNameOnPublicPage ?? true);
          setEventModeEnabled(campaignData.eventMode?.enabled || false);

          const defaultPageContent = getDefaultPageContent();
          const initializedPageContent = data.pageContent
            ? { ...defaultPageContent, ...data.pageContent }
            : defaultPageContent;

          if (
            !initializedPageContent.participationGuideCustomText &&
            !initializedPageContent.participationGuideSteps?.length &&
            data.ruleText
          ) {
            initializedPageContent.participationGuideEnabled = true;
            initializedPageContent.participationGuideType = "custom_text";
            initializedPageContent.participationGuideCustomText = data.ruleText;
          }
          setPageContent(initializedPageContent);

          const defaultDesignSettings = getDefaultDesignSettings();
          setDesignSettings(
            data.designSettings
              ? {
                  ...defaultDesignSettings,
                  ...data.designSettings,
                  mainVisual: {
                    ...defaultDesignSettings.mainVisual,
                    ...data.designSettings.mainVisual,
                  },
                  background: {
                    ...defaultDesignSettings.background,
                    ...data.designSettings.background,
                  },
                }
              : defaultDesignSettings,
          );

          const defaultPresentationSettings = getDefaultPresentationSettings();
          const savedPresentationSettings =
            data.presentationSettings as PresentationSettings;

          const initialPresentationSettings = {
            ...defaultPresentationSettings,
            ...savedPresentationSettings,
            soundSettings: {
              ...defaultPresentationSettings.soundSettings,
              ...savedPresentationSettings?.soundSettings,
            },
            animationSettings: {
              ...defaultPresentationSettings.animationSettings,
              ...savedPresentationSettings?.animationSettings,
            },
          };

          const currentType = initialPresentationSettings.type || "simple";
          if (
            !savedPresentationSettings?.soundSettings ||
            Object.values(savedPresentationSettings.soundSettings).every(
              (url) => !url,
            )
          ) {
            initialPresentationSettings.soundSettings = {
              ...initialPresentationSettings.soundSettings,
              ...DEFAULT_SOUNDS[currentType],
            };
          }

          if (
            !savedPresentationSettings?.animationSettings ||
            Object.values(savedPresentationSettings.animationSettings).every(
              (url) => !url,
            )
          ) {
            initialPresentationSettings.animationSettings = {
              ...initialPresentationSettings.animationSettings,
              ...DEFAULT_ANIMATIONS,
            };
          }
          setPresentationSettings(initialPresentationSettings);

          setPublishStartDate(
            toDateTimeLocalString(campaignData.publishStartDate),
          );
          setPublishEndDate(toDateTimeLocalString(campaignData.publishEndDate));
          setPublishOutOfRangeMsg(
            campaignData.publishPeriodOutOfRangeMessage ||
              "このキャンペーンは現在公開期間外です。",
          );
          setAppStartDate(
            toDateTimeLocalString(campaignData.applicationStartDate),
          );
          setAppEndDate(toDateTimeLocalString(campaignData.applicationEndDate));
          setAppOutOfRangeMsg(
            campaignData.applicationPeriodOutOfRangeMessage ||
              "このキャンペーンは現在応募受付期間外です。",
          );
          setParticipantAuthMethod(
            campaignData.participantAuthMethod || "anonymous",
          );
          setAuthProviders(
            campaignData.authProviders || {
              email: false,
              google: false,
              line: false,
              sms: false,
            },
          );
          setOverallWinProbability(campaignData.overallWinProbability ?? 100);
          setParticipationLimitPerUser(
            campaignData.participationLimitPerUser ?? 1,
          );
          setParticipationIntervalHours(
            campaignData.participationIntervalHours ?? 0,
          );
          setParticipationIntervalMinutes(
            campaignData.participationIntervalMinutes ?? 0,
          );
          setEventModeChancesToGrant(
            campaignData.eventMode?.chancesToGrant ||
              campaignData.participationLimitPerUser ||
              1,
          );
          setPreventDuplicatePrizes(
            campaignData.preventDuplicatePrizes ?? false,
          );
          setOutOfStockBehavior(campaignData.outOfStockBehavior || "show_loss");
          setRequireTicket(campaignData.requireTicket || false);

          if (data.participationTickets) {
            setParticipationTickets(data.participationTickets);
          } else if (data.ticketToken) {
            setParticipationTickets([
              {
                id: "default-migrated",
                label: "デフォルト参加券",
                token: data.ticketToken,
              },
            ]);
          } else {
            setParticipationTickets([]);
          }

          setRequireFormApproval(campaignData.requireFormApproval || false);
          setApprovalFormTitle(
            campaignData.approvalFormTitle || "参加申請フォーム",
          );
          setApprovalFormDescription(
            campaignData.approvalFormDescription ||
              "参加をご希望の方は、以下のフォームを送信してください。",
          );
          setApprovalFormSuccessMessage(
            campaignData.approvalFormSuccessMessage ||
              "申請を受け付けました。承認までしばらくお待ちください。",
          );
          setApprovalFormFields(
            campaignData.approvalFormFields || getDefaultApprovalFormFields(),
          );
          setPrizes(campaignData.prizes || []);
          setShowPrizeCountsOnPublicPage(
            campaignData.showPrizeCountsOnPublicPage || false,
          );
          setQuestionnaireFields(campaignData.questionnaireFields || []);
          if (consolationPrizeData && consolationPrizeData.title) {
            setConsolationPrize({
              ...getDefaultPrize("consolation"),
              ...consolationPrizeData,
            });
          } else {
            setConsolationPrize(null);
          }
          setContactEnabled(campaignData.contactEnabled || false);
          setContactFormTitle(campaignData.contactFormTitle || "お問い合わせ");
          setContactFormDescription(
            campaignData.contactFormDescription ||
              "キャンペーンに関するご質問は、以下のフォームよりお送りください。",
          );
          setContactSuccessMessage(
            campaignData.contactSuccessMessage ||
              "お問い合わせいただきありがとうございます。内容を確認の上、担当者よりご連絡いたします。",
          );
          setContactFields(
            campaignData.contactFields || getDefaultContactFields(),
          );
          setContactNotificationEmail(
            campaignData.contactNotificationEmail || "",
          );
        }
      } catch (error) {
        console.error("Error fetching data: ", error);
        showToast("データの読み込みに失敗しました", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchCampaignData();
  }, [clientId, campaignId, showToast]);

  const fetchDashboardData = useCallback(async () => {
    if (!campaignId) return;
    setIsParticipantsLoading(true);
    // Reset pagination state
    setParticipantsLastDoc(null);
    setHasMoreParticipants(false);
    try {
      // Load only initial batch of participants to reduce Firebase reads
      const participantsQuery = db
        .collection("participants")
        .where("campaignId", "==", campaignId)
        .orderBy("wonAt", "desc")
        .limit(PARTICIPANTS_PER_PAGE + 1); // Load one extra to check if there are more
      
      const snapshot = await participantsQuery.get();
      const hasMore = snapshot.docs.length > PARTICIPANTS_PER_PAGE;
      setHasMoreParticipants(hasMore);
      
      // Get only the first PARTICIPANTS_PER_PAGE documents
      const docsToProcess = hasMore 
        ? snapshot.docs.slice(0, PARTICIPANTS_PER_PAGE)
        : snapshot.docs;
      
      // Store last document for pagination
      if (hasMore && docsToProcess.length > 0) {
        setParticipantsLastDoc(docsToProcess[docsToProcess.length - 1]);
      } else {
        setParticipantsLastDoc(null);
      }
      
      const participantsData = docsToProcess.map((doc: any) => {
        const data = doc.data();
        const history = (data.couponUsageHistory || []).map((h: any) => ({
          store: h.store,
          usedAt: h.usedAt?.toDate ? h.usedAt.toDate() : h.usedAt,
        }));
        
        // Convert wonAt to Date object, handling all possible formats
        const rawWonAt = data.wonAt;
        let wonAtDate: Date;
        if (!rawWonAt) {
          wonAtDate = new Date();
        } else if (rawWonAt instanceof Date) {
          wonAtDate = rawWonAt;
        } else if (rawWonAt instanceof Timestamp) {
          wonAtDate = rawWonAt.toDate();
        } else if (rawWonAt.toDate && typeof rawWonAt.toDate === 'function') {
          wonAtDate = rawWonAt.toDate();
        } else if (rawWonAt.seconds !== undefined && rawWonAt.nanoseconds !== undefined) {
          const timestamp = new Timestamp(rawWonAt.seconds, rawWonAt.nanoseconds);
          wonAtDate = timestamp.toDate();
        } else if (rawWonAt.seconds !== undefined) {
          wonAtDate = new Date(rawWonAt.seconds * 1000);
        } else if (typeof rawWonAt === 'string' || typeof rawWonAt === 'number') {
          wonAtDate = new Date(rawWonAt);
        } else {
          wonAtDate = new Date();
        }
        
        // Validate the converted date
        if (!(wonAtDate instanceof Date) || isNaN(wonAtDate.getTime())) {
          console.warn("Invalid wonAt date for participant:", doc.id, rawWonAt, wonAtDate);
          wonAtDate = new Date();
        }
        
        // Build participant object
        return {
          id: doc.id,
          campaignId: data.campaignId,
          userId: data.userId,
          authInfo: data.authInfo,
          wonAt: wonAtDate,
          prizeId: data.prizeId,
          prizeDetails: data.prizeDetails,
          assignedUrl: data.assignedUrl,
          couponUsed: data.couponUsed,
          couponUsedCount: data.couponUsedCount,
          couponUsageHistory: history,
          shippingAddress: data.shippingAddress,
          isConsolationPrize: data.isConsolationPrize,
          questionnaireAnswers: data.questionnaireAnswers,
        } as Participant;
      }) as Participant[];

      // Data is already sorted by Firestore query (orderBy wonAt desc)
      // No need to sort again
      setAllParticipants(participantsData);

      const overridesSnapshot = await db
        .collection("campaigns")
        .doc(campaignId)
        .collection("overrides")
        .get();
      const overridesData = new Map<string, number>();
      overridesSnapshot.forEach((doc: any) => {
        overridesData.set(doc.id, doc.data().extraChances || 0);
      });
      setParticipantOverrides(overridesData);

      // Load inquiries with limit (50 most recent)
      const inquiriesSnapshot = await db
        .collection("inquiries")
        .where("campaignId", "==", campaignId)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();
      const inquiriesData = inquiriesSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: (
          doc.data().createdAt as InstanceType<typeof Timestamp>
        )?.toDate(),
      })) as Inquiry[];
      setInquiries(inquiriesData);

      // Load participation requests with limit (50 most recent)
      const requestsSnapshot = await db
        .collection("participationRequests")
        .where("campaignId", "==", campaignId)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();
      const requestsData = requestsSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: (
          doc.data().createdAt as InstanceType<typeof Timestamp>
        )?.toDate(),
      })) as ParticipationRequest[];
      setParticipationRequests(requestsData);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      showToast("ダッシュボードデータの読み込みに失敗しました", "error");
    } finally {
      setIsParticipantsLoading(false);
    }
  }, [campaignId, showToast, PARTICIPANTS_PER_PAGE]);

  const loadMoreParticipants = useCallback(async () => {
    if (!campaignId || !participantsLastDoc || isLoadingMoreParticipants) return;
    
    setIsLoadingMoreParticipants(true);
    try {
      const participantsQuery = db
        .collection("participants")
        .where("campaignId", "==", campaignId)
        .orderBy("wonAt", "desc")
        .startAfter(participantsLastDoc)
        .limit(PARTICIPANTS_PER_PAGE + 1); // Load one extra to check if there are more
      
      const snapshot = await participantsQuery.get();
      const hasMore = snapshot.docs.length > PARTICIPANTS_PER_PAGE;
      setHasMoreParticipants(hasMore);
      
      // Get only the first PARTICIPANTS_PER_PAGE documents
      const docsToProcess = hasMore 
        ? snapshot.docs.slice(0, PARTICIPANTS_PER_PAGE)
        : snapshot.docs;
      
      // Store last document for pagination
      if (hasMore && docsToProcess.length > 0) {
        setParticipantsLastDoc(docsToProcess[docsToProcess.length - 1]);
      } else {
        setParticipantsLastDoc(null);
      }
      
      const newParticipantsData = docsToProcess.map((doc: any) => {
        const data = doc.data();
        const history = (data.couponUsageHistory || []).map((h: any) => ({
          store: h.store,
          usedAt: h.usedAt?.toDate ? h.usedAt.toDate() : h.usedAt,
        }));
        
        // Convert wonAt to Date object, handling all possible formats
        const rawWonAt = data.wonAt;
        let wonAtDate: Date;
        if (!rawWonAt) {
          wonAtDate = new Date();
        } else if (rawWonAt instanceof Date) {
          wonAtDate = rawWonAt;
        } else if (rawWonAt instanceof Timestamp) {
          wonAtDate = rawWonAt.toDate();
        } else if (rawWonAt.toDate && typeof rawWonAt.toDate === 'function') {
          wonAtDate = rawWonAt.toDate();
        } else if (rawWonAt.seconds !== undefined && rawWonAt.nanoseconds !== undefined) {
          const timestamp = new Timestamp(rawWonAt.seconds, rawWonAt.nanoseconds);
          wonAtDate = timestamp.toDate();
        } else if (rawWonAt.seconds !== undefined) {
          wonAtDate = new Date(rawWonAt.seconds * 1000);
        } else if (typeof rawWonAt === 'string' || typeof rawWonAt === 'number') {
          wonAtDate = new Date(rawWonAt);
        } else {
          wonAtDate = new Date();
        }
        
        // Validate the converted date
        if (!(wonAtDate instanceof Date) || isNaN(wonAtDate.getTime())) {
          console.warn("Invalid wonAt date for participant:", doc.id, rawWonAt, wonAtDate);
          wonAtDate = new Date();
        }
        
        // Build participant object
        return {
          id: doc.id,
          campaignId: data.campaignId,
          userId: data.userId,
          authInfo: data.authInfo,
          wonAt: wonAtDate,
          prizeId: data.prizeId,
          prizeDetails: data.prizeDetails,
          assignedUrl: data.assignedUrl,
          couponUsed: data.couponUsed,
          couponUsedCount: data.couponUsedCount,
          couponUsageHistory: history,
          shippingAddress: data.shippingAddress,
          isConsolationPrize: data.isConsolationPrize,
          questionnaireAnswers: data.questionnaireAnswers,
        } as Participant;
      }) as Participant[];
      
      // Append new participants to existing ones
      setAllParticipants((prev) => [...prev, ...newParticipantsData]);
    } catch (err) {
      console.error("Failed to load more participants:", err);
      showToast("追加の参加者データの読み込みに失敗しました", "error");
    } finally {
      setIsLoadingMoreParticipants(false);
    }
  }, [campaignId, participantsLastDoc, isLoadingMoreParticipants, PARTICIPANTS_PER_PAGE, showToast]);

  // Fetch graph participants based on date range
  const fetchGraphParticipants = useCallback(async (startDate: Date | null, endDate: Date | null) => {
    if (!campaignId) return;
    
    setIsLoadingGraphData(true);
    try {
      // Query all participants for the campaign (we'll filter by date in memory)
      // This avoids needing composite indexes for date range queries
      const query = db
        .collection("participants")
        .where("campaignId", "==", campaignId)
        .orderBy("wonAt", "desc");
      
      const snapshot = await query.get();
      
      const participantsData = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        const history = (data.couponUsageHistory || []).map((h: any) => ({
          store: h.store,
          usedAt: h.usedAt?.toDate ? h.usedAt.toDate() : h.usedAt,
        }));
        
        const rawWonAt = data.wonAt;
        let wonAtDate: Date;
        if (!rawWonAt) {
          wonAtDate = new Date();
        } else if (rawWonAt instanceof Date) {
          wonAtDate = rawWonAt;
        } else if (rawWonAt instanceof Timestamp) {
          wonAtDate = rawWonAt.toDate();
        } else if (rawWonAt.toDate && typeof rawWonAt.toDate === 'function') {
          wonAtDate = rawWonAt.toDate();
        } else if (rawWonAt.seconds !== undefined && rawWonAt.nanoseconds !== undefined) {
          const timestamp = new Timestamp(rawWonAt.seconds, rawWonAt.nanoseconds);
          wonAtDate = timestamp.toDate();
        } else if (rawWonAt.seconds !== undefined) {
          wonAtDate = new Date(rawWonAt.seconds * 1000);
        } else if (typeof rawWonAt === 'string' || typeof rawWonAt === 'number') {
          wonAtDate = new Date(rawWonAt);
        } else {
          wonAtDate = new Date();
        }
        
        if (!(wonAtDate instanceof Date) || isNaN(wonAtDate.getTime())) {
          wonAtDate = new Date();
        }
        
        return {
          id: doc.id,
          campaignId: data.campaignId,
          userId: data.userId,
          authInfo: data.authInfo,
          wonAt: wonAtDate,
          prizeId: data.prizeId,
          prizeDetails: data.prizeDetails,
          assignedUrl: data.assignedUrl,
          couponUsed: data.couponUsed,
          couponUsedCount: data.couponUsedCount,
          couponUsageHistory: history,
          shippingAddress: data.shippingAddress,
          isConsolationPrize: data.isConsolationPrize,
          questionnaireAnswers: data.questionnaireAnswers,
        } as Participant;
      }) as Participant[];
      
      setAllGraphParticipants(participantsData);
      
      let graphParticipantsData = participantsData;
      
      // Filter by date range in memory
      if (startDate || endDate) {
        const normalizeDate = (date: Date) => {
          const normalized = new Date(date);
          normalized.setHours(0, 0, 0, 0);
          return normalized.getTime();
        };
        
        const matchesRange = (date: Date | null | undefined) => {
          if (!date) return false;
          const timestamp = normalizeDate(date);
          if (startDate && timestamp < normalizeDate(startDate)) {
            return false;
          }
          if (endDate && timestamp > normalizeDate(endDate)) {
            return false;
          }
          return true;
        };
        
        graphParticipantsData = graphParticipantsData.filter((p) => {
          const wonAtMatches = matchesRange(p.wonAt);
          
          const usageMatches = (p.couponUsageHistory || []).some((usage) => {
            let usedAt: Date | null = null;
            const rawUsedAt: any = usage.usedAt;
            if (!rawUsedAt) {
              usedAt = null;
            } else if (rawUsedAt instanceof Date) {
              usedAt = rawUsedAt;
            } else if (typeof rawUsedAt.toDate === "function") {
              usedAt = rawUsedAt.toDate();
            } else if (
              typeof rawUsedAt === "object" &&
              rawUsedAt.seconds !== undefined &&
              rawUsedAt.nanoseconds !== undefined
            ) {
              usedAt = new Timestamp(rawUsedAt.seconds, rawUsedAt.nanoseconds).toDate();
            } else if (typeof rawUsedAt === "number" || typeof rawUsedAt === "string") {
              usedAt = new Date(rawUsedAt);
            }
            return usedAt ? matchesRange(usedAt) : false;
          });
          
          return wonAtMatches || usageMatches;
        });
      }
      
      setGraphParticipants(graphParticipantsData);
    } catch (err: any) {
      console.error("Failed to load graph data:", err);
      showToast("グラフデータの読み込みに失敗しました", "error");
    } finally {
      setIsLoadingGraphData(false);
    }
  }, [campaignId, showToast]);

  // Initialize graph data when campaign loads
  const graphInitialized = useRef(false);
  useEffect(() => {
    if (campaign && campaignId && !graphInitialized.current) {
      // Load all data initially (no filter)
      fetchGraphParticipants(null, null);
      graphInitialized.current = true;
    }
  }, [campaign, campaignId, fetchGraphParticipants]);

  // Apply date range filter (called when user clicks confirm button)
  const applyDateRangeFilter = useCallback(async () => {
    if (!campaignId) return;
    
    if (!tempStartDate || !tempEndDate) {
      showToast("開始日と終了日の両方を選択してください", "error");
      return;
    }
    
    const [startYear, startMonth, startDay] = tempStartDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = tempEndDate.split('-').map(Number);
    
    const startDate = new Date(startYear, startMonth - 1, startDay);
    const endDate = new Date(endYear, endMonth - 1, endDay);
    
    // Validate date range
    if (startDate > endDate) {
      showToast("開始日は終了日より前の日付を選択してください", "error");
      return;
    }
    
    // Apply filter
    setGraphStartDate(startDate);
    setGraphEndDate(endDate);
    
    // Clear temp dates after applying
    setTempStartDate('');
    setTempEndDate('');
    
    await fetchGraphParticipants(startDate, endDate);
  }, [campaignId, tempStartDate, tempEndDate, fetchGraphParticipants, showToast]);
  
  // Clear date range filter
  const clearDateRangeFilter = useCallback(async () => {
    setTempStartDate('');
    setTempEndDate('');
    setGraphStartDate(null);
    setGraphEndDate(null);
    if (campaignId) {
      await fetchGraphParticipants(null, null);
    }
  }, [campaignId, fetchGraphParticipants]);
  
  // Helper function for date formatting (used in multiple places)
  const formatDateForInput = useCallback((date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);
  
  // Sync temp dates when graph dates are set (for editing existing filter)
  useEffect(() => {
    if (graphStartDate && !tempStartDate) {
      setTempStartDate(formatDateForInput(graphStartDate));
    }
    if (graphEndDate && !tempEndDate) {
      setTempEndDate(formatDateForInput(graphEndDate));
    }
  }, [graphStartDate, graphEndDate, tempStartDate, tempEndDate, formatDateForInput]);

  useEffect(() => {
    if (
      activeMenu === "ダッシュボード" ||
      activeMenu === "申請管理" ||
      activeMenu === "参加者管理"
    ) {
      fetchDashboardData();
    }
  }, [activeMenu, fetchDashboardData]);

  const dashboardData = useMemo(() => {
    if (!campaign) return null;
    
    // Prefer the exhaustive participant list fetched for graphs.
    const baseParticipants =
      allGraphParticipants && allGraphParticipants.length > 0
        ? allGraphParticipants
        : allParticipants;
    
    // Use graphParticipants when BOTH dates are set (complete range), otherwise use the full dataset
    // This applies the date filter to ALL dashboard statistics, not just the graph
    const hasCompleteDateRange = graphStartDate !== null && graphEndDate !== null;
    const filteredParticipants = hasCompleteDateRange
      ? graphParticipants
      : baseParticipants;
    
    if (!baseParticipants) return null;

    // Count unique users to prevent duplicate counting when user has multiple lottery chances
    const uniqueUserIds = new Set(filteredParticipants.map(p => p.userId).filter(Boolean));
    const totalParticipants = uniqueUserIds.size;

    const prizeCounts = filteredParticipants.reduce(
      (acc, p) => {
        const prizeTitle =
          p.prizeDetails?.title ||
          (p.isConsolationPrize ? campaign.consolationPrize?.title : "不明");
        if (prizeTitle) {
          acc[prizeTitle] = (acc[prizeTitle] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    const dailyData = filteredParticipants.reduce(
      (acc, p) => {
        if (p.wonAt && p.userId) {
          // Create a copy of the date before modifying it to avoid mutating the original
          const dateCopy = new Date(p.wonAt.getTime());
          dateCopy.setHours(0, 0, 0, 0);
          const year = dateCopy.getFullYear();
          const month = String(dateCopy.getMonth() + 1).padStart(2, "0");
          const day = String(dateCopy.getDate()).padStart(2, "0");
          const date = `${year}-${month}-${day}`;
          if (!acc[date]) {
            acc[date] = { participantCount: 0, winCount: 0, uniqueUsers: new Set<string>() };
          }
          // Only count unique users per day to prevent duplicate counting
          if (!acc[date].uniqueUsers.has(p.userId)) {
            acc[date].uniqueUsers.add(p.userId);
            acc[date].participantCount += 1;
          }
          if (!p.isConsolationPrize) {
            acc[date].winCount += 1;
          }
        }
        return acc;
      },
      {} as Record<string, { participantCount: number; winCount: number; uniqueUsers: Set<string> }>,
    );
    // Clean up the uniqueUsers Set from the result (it was only used for deduplication)
    Object.keys(dailyData).forEach(date => {
      delete (dailyData[date] as any).uniqueUsers;
    });

    const questionnaireResults = (campaign.questionnaireFields || []).map(
      (field) => {
        const answerCounts: Record<string, number> = {};
        const textAnswers: string[] = [];
        let totalAnswersForQuestion = 0;
        // Track which users have already been counted for all question types
        // to prevent duplicate counting when user has multiple lottery chances
        const countedUsers = new Set<string>();

        filteredParticipants.forEach((p) => {
          const answer = p.questionnaireAnswers?.[field.id];
          if (answer !== undefined && answer !== null) {
            const isAnswered = Array.isArray(answer)
              ? answer.length > 0
              : typeof answer === "string" && answer.trim() !== "";
            if (isAnswered && p.userId) {
              // For all question types, only count once per user
              // to prevent duplicate counting when user has multiple lottery chances
              if (countedUsers.has(p.userId)) {
                // Skip this participant - already counted for this user
                return;
              }
              countedUsers.add(p.userId);

              totalAnswersForQuestion++;
              if (Array.isArray(answer)) {
                // Checkbox
                answer.forEach((opt) => {
                  answerCounts[opt] = (answerCounts[opt] || 0) + 1;
                });
              } else {
                // radio, select, text, textarea
                if (["radio", "select"].includes(field.type)) {
                  answerCounts[answer as string] =
                    (answerCounts[answer as string] || 0) + 1;
                } else {
                  textAnswers.push(answer as string);
                }
              }
            }
          }
        });

        return {
          question: field.question,
          type: field.type,
          totalAnswers: totalAnswersForQuestion,
          answerCounts,
          textAnswers,
        };
      },
    );

    const allPrizesInCampaign = [
      ...(campaign.prizes || []),
      campaign.consolationPrize,
    ].filter(Boolean) as Prize[];
    const prizeStatusSource = hasCompleteDateRange
      ? filteredParticipants
      : baseParticipants;
    const prizeStatusData = allPrizesInCampaign
      .map((prize) => {
        const winners = prizeStatusSource.filter((p) => p.prizeId === prize.id);
        const totalWinners = winners.length;
        let totalUsed = 0;
        const storeUsage = new Map<string, number>();
        const shippingData: {
          wonAt: Date;
          address: Record<string, string>;
          userId: string;
        }[] = [];

        winners.forEach((winner) => {
          if (prize.type === "e-coupon") {
            const usageHistory = (winner.couponUsageHistory || []).filter(
              (history) => history,
            );
            const recordedUsage = usageHistory.length;
            const reportedUsage = winner.couponUsedCount || 0;
            const usageCount = Math.max(recordedUsage, reportedUsage);

            totalUsed += usageCount;

            usageHistory.forEach((history) => {
              const storeName = history.store || "店舗未設定";
              storeUsage.set(
                storeName,
                (storeUsage.get(storeName) || 0) + 1,
              );
            });

            const untrackedUsage = usageCount - recordedUsage;
            if (untrackedUsage > 0) {
              storeUsage.set(
                "店舗未設定",
                (storeUsage.get("店舗未設定") || 0) + untrackedUsage,
              );
            }
          } else if (prize.type === "mail-delivery") {
            if (
              winner.shippingAddress &&
              Object.keys(winner.shippingAddress).length > 0
            ) {
              totalUsed++;
              shippingData.push({
                wonAt: winner.wonAt,
                address: winner.shippingAddress,
                userId: winner.userId,
              });
            }
          } else if (prize.type === "url") {
            totalUsed = totalWinners;
          }
        });

        const usageRate =
          totalWinners > 0
            ? ((totalUsed / totalWinners) * 100).toFixed(1) + "%"
            : "0.0%";

        return {
          prizeTitle: prize.title,
          prizeType: prize.type,
          shippingFields: prize.shippingFields || [],
          totalWinners,
          totalUsed,
          usageRate,
          storeUsage: Array.from(storeUsage.entries()).sort(
            (a, b) => b[1] - a[1],
          ),
          shippingData: shippingData.sort(
            (a, b) => b.wonAt.getTime() - a.wonAt.getTime(),
          ),
        };
      })
      .filter((p) => p.totalWinners > 0);

    return {
      totalParticipants,
      prizeCounts,
      dailyData,
      questionnaireResults,
      prizeStatusData,
      inquiries,
    };
  }, [allParticipants, allGraphParticipants, campaign, inquiries, graphParticipants, graphStartDate, graphEndDate]);

  const totalPrizeAllocation = useMemo(() => {
    return prizes.reduce(
      (sum, prize) => sum + (Number(prize.probability) || 0),
      0,
    );
  }, [prizes]);

  const hasZeroProbabilityPrize = useMemo(() => {
    if (prizes.length === 0) return false;
    return prizes.some(
      (prize) => !prize.probability || Number(prize.probability) <= 0,
    );
  }, [prizes]);

  const handleToggleStatus = async () => {
    if (!campaignId || !campaign || isTogglingStatus) return;
    setIsTogglingStatus(true);

    const currentStatus = campaign.status;
    const newStatus = currentStatus === "published" ? "draft" : "published";
    const updateData: { status: Campaign["status"]; url?: string } = {
      status: newStatus,
    };

    try {
      const campaignDocRef = db.collection("campaigns").doc(campaignId);
      await campaignDocRef.update(updateData);
      setCampaign((prev) => (prev ? { ...prev, ...updateData } : null));
      showToast(
        newStatus === "published"
          ? "キャンペーンを公開しました"
          : "キャンペーンを一時非公開にしました",
        "success",
      );
    } catch (error) {
      console.error("Error updating status: ", error);
      showToast("ステータスの更新に失敗しました", "error");
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleAuthProviderChange = (provider: keyof AuthProviders) => {
    setAuthProviders((prev) => ({
      ...prev,
      [provider]: !prev[provider],
    }));
  };

  const cleanPrizeForSaving = (prize: Prize | null): Prize | null => {
    if (!prize || !prize.title.trim()) return null;

    const prizeToSave: any = { ...prize };

    if (prizeToSave.validFrom && typeof prizeToSave.validFrom === "string") {
      const [year, month, day] = prizeToSave.validFrom.split("-").map(Number);
      prizeToSave.validFrom = new Date(year, month - 1, day, 0, 0, 0, 0);
    } else if (!prizeToSave.validFrom) {
      delete prizeToSave.validFrom;
    }

    if (prizeToSave.validTo && typeof prizeToSave.validTo === "string") {
      const [year, month, day] = prizeToSave.validTo.split("-").map(Number);
      prizeToSave.validTo = new Date(year, month - 1, day, 23, 59, 59, 999);
    } else if (!prizeToSave.validTo) {
      delete prizeToSave.validTo;
    }

    if (
      prizeToSave.type === "e-coupon" &&
      Array.isArray(prizeToSave.availableStores)
    ) {
      const cleanedList = (prizeToSave.availableStores as string[])
        .map((s) => s.trim())
        .filter(Boolean);
      prizeToSave.availableStores = cleanedList;
    }
    if (prizeToSave.type === "url" && Array.isArray(prizeToSave.urlStockList)) {
      const cleanedList = (prizeToSave.urlStockList as string[])
        .map((s) => s.trim())
        .filter(Boolean);
      prizeToSave.urlStockList = cleanedList;
      prizeToSave.stock = cleanedList.length;
    }
    return prizeToSave;
  };

  const handleSave = async () => {
    if (!campaignId || isSaving) return;
    setIsSaving(true);
    try {
      if (parseFloat(totalPrizeAllocation.toFixed(1)) > 100) {
        showToast(
          "当選者への景品配分の合計が100%を超えています。修正してください。",
          "error",
        );
        setActiveMenu("ルール設定");
        return;
      }

      const campaignDocRef = db.collection("campaigns").doc(campaignId);

      const cleanedPrizes = prizes
        .map((p) => {
          const prizeToSave: any = { ...p };
          prizeToSave.probability = Number(prizeToSave.probability) || 0;

          if (
            prizeToSave.validFrom &&
            typeof prizeToSave.validFrom === "string"
          ) {
            const [year, month, day] = prizeToSave.validFrom
              .split("-")
              .map(Number);
            prizeToSave.validFrom = new Date(year, month - 1, day, 0, 0, 0, 0);
          } else if (!prizeToSave.validFrom) {
            delete prizeToSave.validFrom;
          }

          if (prizeToSave.validTo && typeof prizeToSave.validTo === "string") {
            const [year, month, day] = prizeToSave.validTo
              .split("-")
              .map(Number);
            prizeToSave.validTo = new Date(
              year,
              month - 1,
              day,
              23,
              59,
              59,
              999,
            );
          } else if (!prizeToSave.validTo) {
            delete prizeToSave.validTo;
          }

          if (prizeToSave.type === "e-coupon") {
            prizeToSave.couponUsageLimit =
              Number(prizeToSave.couponUsageLimit) || 1;
            if (Array.isArray(prizeToSave.availableStores)) {
              const cleanedList = (prizeToSave.availableStores as string[])
                .map((s) => s.trim())
                .filter(Boolean);
              prizeToSave.availableStores = cleanedList;
            }
          }
          if (
            prizeToSave.type === "url" &&
            Array.isArray(prizeToSave.urlStockList)
          ) {
            const cleanedList = (prizeToSave.urlStockList as string[])
              .map((s) => s.trim())
              .filter(Boolean);
            prizeToSave.urlStockList = cleanedList;
            prizeToSave.stock = cleanedList.length;
          }
          return prizeToSave;
        })
        .filter((p) => p.title.trim() !== "");

      const cleanedConsolationPrize = cleanPrizeForSaving(consolationPrize);
      const cleanedQuestionnaireFields = questionnaireFields
        .map((field) => ({
          ...field,
          options: (field.options || [])
            .map((opt) => opt.trim())
            .filter(Boolean),
        }))
        .filter((field) => field.question.trim() !== "");

      const cleanedPageContent = {
        ...pageContent,
        faqItems: pageContent.faqItems?.filter(
          (item) => item.question.trim() && item.answer.trim(),
        ),
        participationGuideSteps: pageContent.participationGuideSteps?.filter(
          (step) => step.title.trim() && step.description.trim(),
        ),
        footerTextLinks: pageContent.footerTextLinks?.filter(
          (link) => link.text.trim() && link.url.trim(),
        ),
        footerBannerLinks: pageContent.footerBannerLinks?.filter(
          (link) => link.imageUrl.trim() && link.url.trim(),
        ),
      };

      const updateData: { [key: string]: any } = {
        name: campaignName,
        description: campaignDescription,
        showNameOnPublicPage: showNameOnPublicPage,
        eventMode: {
          enabled: eventModeEnabled,
          chancesToGrant: Number(eventModeChancesToGrant) || 1,
        },
        publishStartDate: publishStartDate
          ? new Date(publishStartDate)
          : FieldValue.delete(),
        publishEndDate: publishEndDate
          ? new Date(publishEndDate)
          : FieldValue.delete(),
        publishPeriodOutOfRangeMessage: publishOutOfRangeMsg,
        applicationStartDate: appStartDate
          ? new Date(appStartDate)
          : FieldValue.delete(),
        applicationEndDate: appEndDate
          ? new Date(appEndDate)
          : FieldValue.delete(),
        applicationPeriodOutOfRangeMessage: appOutOfRangeMsg,
        participantAuthMethod: participantAuthMethod,
        authProviders: authProviders,
        overallWinProbability: Number(overallWinProbability) || 0,
        prizes: cleanedPrizes,
        showPrizeCountsOnPublicPage: showPrizeCountsOnPublicPage,
        participationLimitPerUser: Number(participationLimitPerUser) || 0,
        participationIntervalHours: Number(participationIntervalHours) || 0,
        participationIntervalMinutes: Number(participationIntervalMinutes) || 0,
        preventDuplicatePrizes: preventDuplicatePrizes,
        outOfStockBehavior: outOfStockBehavior,
        consolationPrize: cleanedConsolationPrize || FieldValue.delete(),
        questionnaireFields: cleanedQuestionnaireFields,
        requireTicket,
        participationTickets,
        requireFormApproval,
        approvalFormTitle,
        approvalFormDescription,
        approvalFormSuccessMessage,
        approvalFormFields,
        contactEnabled,
        contactFormTitle,
        contactFormDescription,
        contactSuccessMessage,
        contactFields,
        contactNotificationEmail,
        pageContent: cleanedPageContent,
        ticketToken: FieldValue.delete(),
        designSettings: designSettings,
        presentationSettings: presentationSettings,
        ruleText: FieldValue.delete(),
      };
      await campaignDocRef.update(updateData);

      setPrizes(cleanedPrizes as Prize[]);
      setQuestionnaireFields(cleanedQuestionnaireFields);
      setPageContent(cleanedPageContent);
      setCampaign((prev) => (prev ? { ...prev, ...updateData } : null));

      showToast("キャンペーン情報を保存しました", "success");
    } catch (error) {
      console.error("Error saving campaign: ", error);
      showToast("保存に失敗しました", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    if (url) {
      navigator.clipboard
        .writeText(url)
        .then(() => showToast("URLをコピーしました", "success"))
        .catch(() => showToast("URLのコピーに失敗しました", "error"));
    }
  };

  const handleAddPrize = () => {
    setPrizes((prev) => {
      const newPrize = getDefaultPrize(`new_${Date.now()}`);
      const nextColorIndex = prev.length % RANK_COLORS.length;
      newPrize.rankColor = RANK_COLORS[nextColorIndex];
      return [...prev, newPrize];
    });
  };

  const handleAddConsolationPrize = () => {
    setConsolationPrize(getDefaultPrize("consolation"));
  };

  const handlePrizeChange = (
    index: number,
    field: keyof Prize | `shippingFields.${number}.${"enabled" | "required"}`,
    value: any,
  ) => {
    const newPrizes = [...prizes];
    const prizeToUpdate = { ...newPrizes[index] };
    updatePrizeField(prizeToUpdate, field, value);
    newPrizes[index] = prizeToUpdate;
    setPrizes(newPrizes);
  };

  const handleConsolationPrizeChange = (
    field: keyof Prize | `shippingFields.${number}.${"enabled" | "required"}`,
    value: any,
  ) => {
    if (!consolationPrize) return;
    const newPrize = { ...consolationPrize };
    updatePrizeField(newPrize, field, value);
    setConsolationPrize(newPrize);
  };

  const updatePrizeField = (
    prize: Prize,
    field: keyof Prize | `shippingFields.${number}.${"enabled" | "required"}`,
    value: any,
  ) => {
    if (typeof field === "string" && field.startsWith("shippingFields")) {
      const [, fieldIndex, prop] = field.split(".");
      const shippingFields = [...(prize.shippingFields || [])];
      shippingFields[parseInt(fieldIndex)] = {
        ...shippingFields[parseInt(fieldIndex)],
        [prop]: value,
      };
      prize.shippingFields = shippingFields;
    } else if (field === "stock" || field === "couponUsageLimit") {
      const numValue = parseInt(value, 10);
      (prize as any)[field] = isNaN(numValue) || numValue < 0 ? 0 : numValue;
    } else if (field === "unlimitedStock") {
      prize.unlimitedStock = value;
      if (value) prize.stock = 0;
    } else if (field === "availableStores" && typeof value === "string") {
      prize.availableStores = value.split("\n");
    } else if (field === "urlStockList" && typeof value === "string") {
      prize.urlStockList = value.split("\n");
    } else {
      (prize as any)[field] = value;
    }

    if (prize.type === "url") {
      prize.stock =
        prize.urlStockList?.map((s) => s.trim()).filter(Boolean).length || 0;
    }

    if (
      field === "type" &&
      value === "mail-delivery" &&
      !prize.shippingFields?.length
    ) {
      prize.shippingFields = getDefaultShippingFields();
    }
  };

  const handleRemovePrize = (index: number) => {
    setPrizes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveConsolationPrize = () => {
    setConsolationPrize(null);
  };

  const handleFileUpload = async (
    file: File,
    id: string,
    onUploadComplete: (url: string) => void,
    subfolder: string,
  ) => {
    if (!campaignId) return;

    setIsUploadingFile((prev) => ({ ...prev, [id]: true }));
    try {
      const filePath = `campaigns/${campaignId}/${subfolder}/${id}/${file.name}`;
      const fileRef = storage.ref(filePath);
      await fileRef.put(file);
      const url = await fileRef.getDownloadURL();
      onUploadComplete(url);
      showToast("ファイルをアップロードしました", "success");
    } catch (error) {
      console.error("File upload failed:", error);
      showToast("ファイルのアップロードに失敗しました", "error");
    } finally {
      setIsUploadingFile((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleMainVisualFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCroppingConfig({
        src: reader.result as string,
        onComplete: (dataUrl) => handleUploadCroppedMainVisual(dataUrl),
      });
    };
    reader.readAsDataURL(file);
  };

  const handleUploadCroppedMainVisual = async (dataUrl: string) => {
    if (!campaignId) return;
    const id = "mainVisual";
    const subfolder = "design";

    setIsUploadingFile((prev) => ({ ...prev, [id]: true }));
    setCroppingConfig(null);

    try {
      const fileName = `${Date.now()}.jpg`;
      const filePath = `campaigns/${campaignId}/${subfolder}/${id}/${fileName}`;
      const fileRef = storage.ref(filePath);
      await fileRef.putString(dataUrl, "data_url", {
        contentType: "image/jpeg",
      });
      const url = await fileRef.getDownloadURL();

      handleDesignChange("mainVisual", "imageUrl", url);

      showToast("画像をアップロードしました", "success");
    } catch (error) {
      console.error("Cropped image upload failed:", error);
      showToast("画像のアップロードに失敗しました", "error");
    } finally {
      setIsUploadingFile((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleAddQuestionnaireField = () => {
    setQuestionnaireFields((prev) => [
      ...prev,
      {
        id: `q_${Date.now()}`,
        question: "",
        type: "text",
        required: false,
        options: [],
      },
    ]);
  };

  const handleRemoveQuestionnaireField = (index: number) => {
    setQuestionnaireFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuestionnaireFieldChange = (
    index: number,
    field: keyof QuestionnaireField | "optionsString",
    value: any,
  ) => {
    const newFields = [...questionnaireFields];
    const fieldToUpdate = { ...newFields[index] };

    if (field === "optionsString") {
      fieldToUpdate.options = (value as string).split("\n");
    } else {
      (fieldToUpdate as any)[field] = value;
    }

    newFields[index] = fieldToUpdate;
    setQuestionnaireFields(newFields);
  };

  const handleContactFieldChange = (
    index: number,
    field: keyof ContactField,
    value: any,
  ) => {
    const newFields = [...contactFields];
    const fieldToUpdate = { ...newFields[index], [field]: value };
    newFields[index] = fieldToUpdate;
    setContactFields(newFields);
  };

  const handlePageContentChange = (field: keyof PageContent, value: any) => {
    setPageContent((prev) => ({ ...prev, [field]: value }));
  };

  const handleDesignChange = (
    section: keyof DesignSettings,
    field: string,
    value: any,
  ) => {
    setDesignSettings((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] as object),
        [field]: value,
      },
    }));
  };

  const handlePresentationChange = (
    section: keyof PresentationSettings,
    field: string,
    value: any,
  ) => {
    setPresentationSettings((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] as object),
        [field]: value,
      },
    }));
  };

  const handleArrayItemChange = (
    arrayName: keyof PageContent,
    index: number,
    field: string,
    value: any,
  ) => {
    setPageContent((prev) => {
      const newArray = [...((prev[arrayName] as any[]) || [])];
      newArray[index] = { ...newArray[index], [field]: value };
      return { ...prev, [arrayName]: newArray };
    });
  };

  const addArrayItem = (arrayName: keyof PageContent, newItem: any) => {
    setPageContent((prev) => ({
      ...prev,
      [arrayName]: [
        ...((prev[arrayName] as any[]) || []),
        { id: `item_${Date.now()}`, ...newItem },
      ],
    }));
  };

  const removeArrayItem = (arrayName: keyof PageContent, index: number) => {
    setPageContent((prev) => ({
      ...prev,
      [arrayName]: ((prev[arrayName] as any[]) || []).filter(
        (_, i) => i !== index,
      ),
    }));
  };

  const handleGrantChance = async (userData: {
    userId: string;
    participations: Participant[];
  }) => {
    if (!campaignId) return;

    const chancesStr = window.prompt(
      `ユーザーID「${userData.userId.substring(0, 8)}...」に付与する参加回数を入力してください。`,
      "1",
    );
    if (chancesStr === null) return;

    const chancesToGrant = parseInt(chancesStr, 10);
    if (isNaN(chancesToGrant) || chancesToGrant <= 0) {
      showToast("有効な数値を入力してください。", "error");
      return;
    }

    if (
      window.confirm(
        `ユーザーID「${userData.userId.substring(0, 8)}...」に参加権利を ${chancesToGrant} 回付与します。よろしいですか？`,
      )
    ) {
      setIsActionLoading({ id: userData.userId, action: "grant" });
      try {
        const overrideRef = db
          .collection("campaigns")
          .doc(campaignId)
          .collection("overrides")
          .doc(userData.userId);

        await overrideRef.set(
          { extraChances: FieldValue.increment(chancesToGrant) },
          { merge: true },
        );

        showToast(
          `${chancesToGrant} 回分の参加回数を付与しました。`,
          "success",
        );

        setParticipantOverrides((prev) => {
          const newOverrides = new Map(prev);
          const currentChances = newOverrides.get(userData.userId) || 0;
          newOverrides.set(userData.userId, currentChances + chancesToGrant);
          return newOverrides;
        });
      } catch (error) {
        console.error("Error granting chance:", error);
        showToast(
          "参加回数の付与に失敗しました。Firebaseのルール設定を確認してください。",
          "error",
        );
      } finally {
        setIsActionLoading(null);
      }
    }
  };

  const handleDeleteUser = async (userData: {
    userId: string;
    participations: Participant[];
  }) => {
    if (!campaignId) return;
    if (
      window.confirm(
        `本当にユーザーID「${userData.userId.substring(0, 8)}...」のすべての参加データを削除しますか？\nこの操作は元に戻せません。付与された追加の参加回数もリセットされます。`,
      )
    ) {
      setIsActionLoading({ id: userData.userId, action: "delete" });
      try {
        const batch = db.batch();

        const requestsQuery = db
          .collection("participationRequests")
          .where("campaignId", "==", campaignId)
          .where("userId", "==", userData.userId);
        const requestsSnapshot = await requestsQuery.get();
        requestsSnapshot.forEach((doc) => batch.delete(doc.ref));

        userData.participations.forEach((p) => {
          const docRef = db.collection("participants").doc(p.id);
          batch.delete(docRef);
        });

        const overrideRef = db
          .collection("campaigns")
          .doc(campaignId)
          .collection("overrides")
          .doc(userData.userId);
        batch.delete(overrideRef);

        await batch.commit();

        showToast(
          "ユーザーデータを削除し、付与回数をリセットしました。",
          "success",
        );

        setAllParticipants((prev) =>
          prev ? prev.filter((p) => p.userId !== userData.userId) : [],
        );
        setParticipationRequests((prev) =>
          prev.filter((req) => req.userId !== userData.userId),
        );
        setParticipantOverrides((prev) => {
          const newOverrides = new Map(prev);
          newOverrides.delete(userData.userId);
          return newOverrides;
        });
      } catch (error) {
        console.error("Error deleting user data:", error);
        showToast(
          "ユーザーデータの削除に失敗しました。Firebaseのルール設定を確認してください。",
          "error",
        );
      } finally {
        setIsActionLoading(null);
      }
    }
  };

  const handleDownloadCsv = () => {
    if (!allParticipants || !campaign) {
      showToast("ダウンロードするデータがありません", "info");
      return;
    }

    const allShippingFields = new Set<string>();
    campaign.prizes?.forEach((p) =>
      p.shippingFields?.forEach(
        (f) => f.enabled && allShippingFields.add(f.label),
      ),
    );
    campaign.consolationPrize?.shippingFields?.forEach(
      (f) => f.enabled && allShippingFields.add(f.label),
    );
    const shippingFieldLabels = Array.from(allShippingFields);

    const headers = [
      "当選日時",
      "ユーザーID",
      "景品名",
      "景品タイプ",
      "参加賞フラグ",
      "利用状況",
      "最終利用日時",
      "利用店舗",
      ...shippingFieldLabels,
    ];

    const escapeCsvCell = (cell: any): string => {
      if (cell === null || cell === undefined) return "";
      const str = String(cell);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = allParticipants
      .map((p) => {
        if (!p || !p.prizeDetails) {
          return null;
        }
        const prizeDetails = p.prizeDetails;
        let usageStatus = "";
        let lastUsedAt = "";
        let usedStore = "";

        if (prizeDetails.type === "e-coupon") {
          const history = p.couponUsageHistory || [];
          const validHistory = history.filter(
            (h) =>
              h &&
              h.usedAt &&
              (h.usedAt instanceof Date ||
                typeof (h.usedAt as any).toDate === "function"),
          );

          if (validHistory.length > 0) {
            const latestUsage = [...validHistory].sort((a, b) => {
              const timeA =
                a.usedAt instanceof Date
                  ? a.usedAt.getTime()
                  : (a.usedAt as any).toDate().getTime();
              const timeB =
                b.usedAt instanceof Date
                  ? b.usedAt.getTime()
                  : (b.usedAt as any).toDate().getTime();
              return timeB - timeA;
            })[0];
            usageStatus = `使用済み (${p.couponUsedCount || 0}回)`;
            const usedAtDate =
              latestUsage.usedAt instanceof Date
                ? latestUsage.usedAt
                : (latestUsage.usedAt as any).toDate();
            lastUsedAt = usedAtDate.toLocaleString("ja-JP");
            usedStore = validHistory.map((h) => h.store).join(", ");
          } else {
            usageStatus = "未使用";
          }
        } else if (prizeDetails.type === "mail-delivery") {
          usageStatus =
            p.shippingAddress && Object.keys(p.shippingAddress).length > 0
              ? "発送情報入力済み"
              : "未入力";
        } else if (prizeDetails.type === "url") {
          usageStatus = "URL配布済み";
        }

        const shippingData = shippingFieldLabels.map((label) => {
          const field = (prizeDetails.shippingFields || []).find(
            (f) => f.label === label,
          );
          return p.shippingAddress && field
            ? p.shippingAddress[field.id] || ""
            : "";
        });

        const wonAtDate =
          p.wonAt &&
          (p.wonAt instanceof Date ? p.wonAt : (p.wonAt as any).toDate());
        return [
          wonAtDate && !isNaN(wonAtDate.getTime())
            ? wonAtDate.toLocaleString("ja-JP")
            : "",
          p.userId || "",
          prizeDetails.title || "",
          prizeDetails.type || "",
          p.isConsolationPrize ? "はい" : "いいえ",
          usageStatus,
          lastUsedAt,
          usedStore,
          ...shippingData,
        ]
          .map(escapeCsvCell)
          .join(",");
      })
      .filter((row): row is string => row !== null);

    if (rows.length === 0) {
      showToast("CSVに出力できる有効なデータがありません。", "info");
      return;
    }

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${campaign.name}_prize_data.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDownloadSurveyCsv = () => {
    if (
      !allParticipants ||
      !campaign?.questionnaireFields ||
      campaign.questionnaireFields.length === 0
    ) {
      showToast("ダウンロードするアンケートデータがありません", "info");
      return;
    }

    const escapeCsvCell = (cell: any): string => {
      if (cell === null || cell === undefined) return "";

      let strCell: string;
      if (Array.isArray(cell)) {
        strCell = cell.join("; ");
      } else {
        strCell = String(cell);
      }

      if (
        strCell.includes(",") ||
        strCell.includes('"') ||
        strCell.includes("\n")
      ) {
        return `"${strCell.replace(/"/g, '""')}"`;
      }
      return strCell;
    };

    const headers = [
      "参加日時",
      "ユーザーID",
      ...campaign.questionnaireFields.map((f) => f.question),
    ];

    const rows = allParticipants
      .map((p) => {
        const wonAtDate =
          p.wonAt &&
          (p.wonAt instanceof Date ? p.wonAt : (p.wonAt as any).toDate());
        if (!wonAtDate || isNaN(wonAtDate.getTime())) {
          return null;
        }

        const rowData = [wonAtDate.toLocaleString("ja-JP"), p.userId || ""];

        campaign.questionnaireFields?.forEach((field) => {
          const answer = p.questionnaireAnswers?.[field.id];
          rowData.push(answer ?? "");
        });

        return rowData.map(escapeCsvCell).join(",");
      })
      .filter((row): row is string => row !== null);

    if (rows.length === 0) {
      showToast("CSVに出力できる有効なアンケート回答がありません。", "info");
      return;
    }

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${campaign.name}_survey_results.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddTicket = () => {
    setParticipationTickets((prev) => [
      ...prev,
      {
        id: `ticket_${Date.now()}`,
        label: "新しい参加券",
        token: crypto.randomUUID(),
        chancesToGrant:
          Number(participationLimitPerUser) > 0
            ? Number(participationLimitPerUser)
            : 1,
      },
    ]);
    showToast(
      "新しい参加券を追加しました。保存して変更を確定してください。",
      "info",
    );
  };

  const handleTicketChange = (
    index: number,
    field: "label" | "chancesToGrant",
    value: string,
  ) => {
    setParticipationTickets((prev) => {
      const newTickets = [...prev];
      const ticketToUpdate = { ...newTickets[index] };

      if (field === "chancesToGrant") {
        const numValue = parseInt(value, 10);
        ticketToUpdate[field] = isNaN(numValue) || numValue < 0 ? 0 : numValue;
      } else {
        ticketToUpdate[field] = value;
      }

      newTickets[index] = ticketToUpdate;
      return newTickets;
    });
  };

  const handleRemoveTicket = (index: number) => {
    if (window.confirm("この参加券を削除しますか？")) {
      setParticipationTickets((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleApprovalFormFieldChange = (
    index: number,
    field: keyof ApprovalFormField,
    value: any,
  ) => {
    const newFields = [...approvalFormFields];
    const fieldToUpdate = { ...newFields[index], [field]: value };
    newFields[index] = fieldToUpdate;
    setApprovalFormFields(newFields);
  };

  const handleAddApprovalFormField = () => {
    setApprovalFormFields((prev) => [
      ...prev,
      {
        id: `form_${Date.now()}`,
        label: "",
        type: "text",
        required: false,
      },
    ]);
  };

  const handleRemoveApprovalFormField = (index: number) => {
    setApprovalFormFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateRequestStatus = async (
    request: ParticipationRequest,
    newStatus: "approved" | "rejected",
  ) => {
    if (!campaignId || !campaign) return;

    let chancesToGrant = 0;

    if (newStatus === "approved") {
      const defaultChances =
        Number(campaign.participationLimitPerUser) > 0
          ? String(campaign.participationLimitPerUser)
          : "1";
      const chancesStr = window.prompt(
        "承認して付与する参加回数を入力してください。",
        defaultChances,
      );

      if (chancesStr === null) {
        return;
      }

      const parsedChances = parseInt(chancesStr, 10);
      if (isNaN(parsedChances) || parsedChances < 0) {
        showToast("有効な数値を入力してください。", "error");
        return;
      }
      chancesToGrant = parsedChances;
    } else {
      if (!window.confirm(`この申請を却下しますか？`)) {
        return;
      }
    }

    setIsActionLoading({ id: request.id, action: newStatus });

    try {
      const requestRef = db.collection("participationRequests").doc(request.id);
      const updateData: Partial<ParticipationRequest> = {
        status: newStatus,
        reviewedAt: new Date(),
      };

      if (newStatus === "approved") {
        const overrideRef = db
          .collection("campaigns")
          .doc(campaignId)
          .collection("overrides")
          .doc(request.userId);
        await db.runTransaction(async (transaction: any) => {
          const overrideDoc = await transaction.get(overrideRef);
          const currentChances = overrideDoc.exists
            ? overrideDoc.data().extraChances || 0
            : 0;
          transaction.set(
            overrideRef,
            { extraChances: currentChances + chancesToGrant },
            { merge: true },
          );
          transaction.update(requestRef, updateData);
        });
        showToast(
          `申請を承認し、${chancesToGrant}回分の参加回数を付与しました。`,
          "success",
        );
      } else {
        await requestRef.update(updateData);
        showToast(`申請を却下しました。`, "success");
      }

      setParticipationRequests((prev) =>
        prev.map((r) => (r.id === request.id ? { ...r, ...updateData } : r)),
      );

      if (newStatus === "approved") {
        setParticipantOverrides((prev) => {
          const newOverrides = new Map(prev);
          const currentChances = newOverrides.get(request.userId) || 0;
          newOverrides.set(request.userId, currentChances + chancesToGrant);
          return newOverrides;
        });
      }
    } catch (error) {
      const actionText = newStatus === "approved" ? "承認" : "却下";
      console.error(`Error ${actionText}ing request:`, error);
      showToast(`申請の${actionText}に失敗しました。`, "error");
    } finally {
      setIsActionLoading(null);
    }
  };

  const renderPrizeStatusDashboard = (
    prizeStatusData: NonNullable<typeof dashboardData>["prizeStatusData"],
  ) => {
    if (!prizeStatusData || prizeStatusData.length === 0) return null;

    return (
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">景品取得・利用状況</h3>
          <button
            onClick={handleDownloadCsv}
            className="px-4 py-2 text-sm font-medium bg-slate-600 text-white rounded-md hover:bg-slate-700 transition-colors shadow-sm"
          >
            CSVダウンロード
          </button>
        </div>
        <div className="space-y-6">
          {prizeStatusData.map((data) => (
            <div
              key={data.prizeTitle}
              className="bg-white p-6 rounded-lg shadow-md border border-slate-200"
            >
              <h4 className="text-lg font-semibold text-slate-800 mb-4">
                {data.prizeTitle}
              </h4>
              <div className="grid grid-cols-3 gap-4 text-center mb-6">
                <div>
                  <p className="text-sm text-slate-500">当選数</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {data.totalWinners}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">利用数</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {data.totalUsed}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">利用率</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {data.usageRate}
                  </p>
                </div>
              </div>

              {data.prizeType === "e-coupon" && data.storeUsage.length > 0 && (
                <div>
                  <h5 className="font-semibold text-slate-700 mb-2">
                    引換券の利用場所
                  </h5>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                            店舗名
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">
                            利用回数
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {data.storeUsage.map(([store, count]) => (
                          <tr key={store}>
                            <td className="px-4 py-2 text-sm text-slate-800">
                              {store}
                            </td>
                            <td className="px-4 py-2 text-sm text-slate-600 text-right">
                              {count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {data.prizeType === "mail-delivery" &&
                data.shippingData.length > 0 && (
                  <div>
                    <h5 className="font-semibold text-slate-700 mb-2">
                      郵送先情報
                    </h5>
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                              当選日時
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                              ユーザーID
                            </th>
                            {data.shippingFields.map(
                              (field) =>
                                field.enabled && (
                                  <th
                                    key={field.id}
                                    className="px-4 py-2 text-left text-xs font-medium text-slate-500"
                                  >
                                    {field.label}
                                  </th>
                                ),
                            )}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {data.shippingData.map((shippingInfo, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm text-slate-600 whitespace-nowrap">
                                {shippingInfo.wonAt.toLocaleDateString("ja-JP")}
                              </td>
                              <td
                                className="px-4 py-2 text-sm text-slate-800 font-mono text-xs"
                                title={shippingInfo?.userId}
                              >
                                {shippingInfo.userId}
                              </td>
                              {data.shippingFields.map(
                                (field) =>
                                  field.enabled && (
                                    <td
                                      key={field.id}
                                      className="px-4 py-2 text-sm text-slate-800"
                                    >
                                      {shippingInfo.address[field.id] || "-"}
                                    </td>
                                  ),
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Helper function for date display formatting
  const formatDateForDisplay = (date: Date): string => {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const renderDashboard = () => {
    if (isParticipantsLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <Spinner />
        </div>
      );
    }

    const {
      totalParticipants,
      prizeCounts,
      dailyData,
      questionnaireResults,
      prizeStatusData,
      inquiries,
    } = dashboardData || {
      totalParticipants: 0,
      prizeCounts: {},
      dailyData: {},
      questionnaireResults: [],
      prizeStatusData: [],
      inquiries: [],
    };
    const sortedDailyData = Object.entries(dailyData).sort(
      ([dateA], [dateB]) =>
        new Date(dateA).getTime() - new Date(dateB).getTime(),
    );
    const maxDailyCount = Math.ceil(
      Math.max(...sortedDailyData.map(([, data]) => data.participantCount), 1),
    );

    const yAxisLabels = [
      { value: maxDailyCount, label: maxDailyCount },
      { value: maxDailyCount * 0.75, label: Math.round(maxDailyCount * 0.75) },
      { value: maxDailyCount * 0.5, label: Math.round(maxDailyCount * 0.5) },
      { value: maxDailyCount * 0.25, label: Math.round(maxDailyCount * 0.25) },
      { value: 0, label: 0 },
    ].filter((v, i, a) => !a.slice(i + 1).some((o) => o.label === v.label));

    return (
      <div className="space-y-8">
        {/* Date Range Selector - Applies to entire dashboard */}
        <div className="bg-white p-4 rounded-lg shadow-md border border-slate-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-base font-semibold text-slate-800">
                期間フィルター
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                選択した期間のデータのみをダッシュボード全体に表示します
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600 whitespace-nowrap">開始日:</label>
                <input
                  type="date"
                  value={tempStartDate || (graphStartDate ? formatDateForInput(graphStartDate) : '')}
                  onChange={(e) => {
                    setTempStartDate(e.target.value);
                  }}
                  className="px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600 whitespace-nowrap">終了日:</label>
                <input
                  type="date"
                  value={tempEndDate || (graphEndDate ? formatDateForInput(graphEndDate) : '')}
                  onChange={(e) => {
                    setTempEndDate(e.target.value);
                  }}
                  className="px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <button
                onClick={applyDateRangeFilter}
                disabled={!tempStartDate || !tempEndDate}
                className="px-4 py-1 text-xs bg-slate-800 text-white rounded-md hover:bg-slate-900 transition-colors whitespace-nowrap disabled:bg-slate-400 disabled:cursor-not-allowed"
              >
                適用
              </button>
              {(graphStartDate || graphEndDate) && (
                <button
                  onClick={clearDateRangeFilter}
                  className="px-3 py-1 text-xs bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap"
                >
                  すべて表示
                </button>
              )}
            </div>
          </div>
          {graphStartDate && graphEndDate && (
            <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700">
              表示中: {formatDateForDisplay(graphStartDate)} ～ {formatDateForDisplay(graphEndDate)}
            </div>
          )}
          {(!tempStartDate || !tempEndDate) && (tempStartDate !== '' || tempEndDate !== '') && (
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
              開始日と終了日の両方を選択して「適用」をクリックしてください
            </div>
          )}
          {isLoadingGraphData && (
            <div className="flex justify-center items-center py-2 mt-2">
              <Spinner size="sm" />
              <span className="ml-2 text-sm text-slate-600">データを読み込み中...</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
            <h4 className="text-sm font-medium text-slate-500">総参加者数</h4>
            <p className="text-4xl font-bold text-slate-800 mt-2">
              {totalParticipants}{" "}
              <span className="text-lg font-medium">人</span>
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
            <h4 className="text-sm font-medium text-slate-500 mb-3">
              景品別当選数
            </h4>
            <div className="space-y-2 text-sm">
              {Object.keys(prizeCounts).length > 0 ? (
                Object.entries(prizeCounts).map(([title, count]) => (
                  <div
                    key={title}
                    className="flex justify-between items-center"
                  >
                    <span className="text-slate-600 truncate" title={title}>
                      {title}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {count} 回
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-slate-400">まだ当選者はいません。</p>
              )}
            </div>
          </div>
          {campaign && campaign.requireTicket && campaign.ticketUsage && (
            <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200 md:col-span-2">
              <h4 className="text-sm font-medium text-slate-500 mb-3">
                参加券利用状況
              </h4>
              <div className="space-y-2 text-sm">
                {Object.values(campaign.ticketUsage).length > 0 ? (
                  Object.values(campaign.ticketUsage)
                    .sort((a, b) => b.count - a.count)
                    .map((usageData) => (
                      <div
                        key={usageData.label}
                        className="flex justify-between items-center"
                      >
                        <span
                          className="text-slate-600 truncate"
                          title={usageData.label}
                        >
                          {usageData.label}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {usageData.count} 回
                        </span>
                      </div>
                    ))
                ) : (
                  <p className="text-slate-400">
                    まだ利用された参加券はありません。
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {sortedDailyData.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
            <h4 className="text-lg font-semibold text-slate-800 mb-1">
              期間軸のグラフ (参加・当選数)
            </h4>
            <div className="flex justify-end items-center gap-4 text-xs mb-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-slate-400"></div>
                <span className="text-slate-600">参加者数 (全体)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-emerald-400"></div>
                <span className="text-slate-600">当選数 (参加賞除く)</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="flex min-h-[280px] min-w-fit">
                <div className="flex flex-col justify-between text-right pr-2 text-xs text-slate-500 py-2 flex-shrink-0">
                  {yAxisLabels.map((item) => (
                    <span key={item.label}>{item.label}</span>
                  ))}
                </div>
                <div className="flex-1 flex items-end gap-2 border-l border-b border-slate-200 p-2 pb-8 min-w-0">
                  {sortedDailyData.map(([date, data]) => (
                    <div
                      key={date}
                      className="flex-1 flex flex-col items-center justify-end min-w-0 group relative"
                      style={{ height: "240px" }}
                      onMouseEnter={() => setHoveredDate(date)}
                      onMouseLeave={() => setHoveredDate(null)}
                    >
                      {hoveredDate === date && (
                        <div className="absolute bottom-full mb-2 w-max p-2 bg-slate-800 text-white text-xs rounded-md shadow-lg z-10 pointer-events-none transform -translate-x-1/2 left-1/2 whitespace-nowrap animate-fade-in">
                          <p className="font-bold">
                            {new Date(date).toLocaleDateString("ja-JP", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </p>
                          <div className="mt-1 border-t border-slate-600"></div>
                          <div className="mt-1 space-y-0.5">
                            <p>参加者: {data.participantCount}人</p>
                            <p>当選者: {data.winCount}人</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-end justify-center w-full gap-px flex-1 min-h-0">
                        <div
                          className="w-1/2 bg-slate-400 group-hover:bg-slate-500 rounded-t-sm transition-colors"
                          style={{
                            height: `${(data.participantCount / maxDailyCount) * 100}%`,
                          }}
                        ></div>
                        <div
                          className="w-1/2 bg-emerald-400 group-hover:bg-emerald-500 rounded-t-sm transition-colors"
                          style={{
                            height: `${(data.winCount / maxDailyCount) * 100}%`,
                          }}
                        ></div>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 whitespace-nowrap">
                        {new Date(date).toLocaleDateString("ja-JP", {
                          month: "2-digit",
                          day: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {campaign &&
          campaign.questionnaireFields &&
          campaign.questionnaireFields.length > 0 && (
            <SurveyResultsDashboard
              results={questionnaireResults}
              fields={campaign.questionnaireFields}
              onDownloadCsv={handleDownloadSurveyCsv}
            />
          )}
        {prizeStatusData && renderPrizeStatusDashboard(prizeStatusData)}

        {inquiries && inquiries.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-bold mb-4">お問い合わせ記録</h3>
            <div className="overflow-x-auto bg-white p-6 rounded-lg shadow-md border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      受付日時
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      ユーザー情報
                    </th>
                    {campaign?.contactFields
                      ?.filter((f) => f.enabled)
                      .map((field) => (
                        <th
                          key={field.id}
                          className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                        >
                          {field.label}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {inquiries.map((inquiry) => (
                    <tr key={inquiry.id}>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                        {inquiry.createdAt.toLocaleString("ja-JP")}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-700">
                        {inquiry.authInfo?.identifier ||
                          (inquiry.userId &&
                            `${inquiry.userId.substring(0, 8)}...`) ||
                          "匿名"}
                      </td>
                      {campaign?.contactFields
                        ?.filter((f) => f.enabled)
                        .map((field) => (
                          <td
                            key={field.id}
                            className="px-4 py-4 text-sm text-slate-800 break-words max-w-xs"
                          >
                            {inquiry.formData[field.id] || "-"}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const formatAuthInfo = (authInfo: Participant["authInfo"]) => {
    if (!authInfo) return "不明";
    switch (authInfo.provider) {
      case "google.com":
      case "password":
        return authInfo.identifier;
      case "phone":
        return authInfo.identifier;
      case "anonymous":
        return "匿名";
      default:
        return authInfo.identifier || authInfo.provider;
    }
  };

  const renderApplicationManagement = () => {
    if (isParticipantsLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <Spinner />
        </div>
      );
    }
    if (participationRequests.length === 0) {
      return (
        <div className="text-center py-12 px-6 bg-slate-50 rounded-lg border-2 border-dashed">
          <h3 className="text-lg font-medium text-slate-700">
            申請はありません
          </h3>
          <p className="text-slate-500 mt-2">
            このキャンペーンにはまだ参加申請がありません。
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
              >
                申請日時
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
              >
                ユーザー情報
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
              >
                ステータス
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider"
              >
                アクション
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {participationRequests.map((request) => (
              <tr
                key={request.id}
                className="hover:bg-slate-50 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                  {request.createdAt.toLocaleString("ja-JP")}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm max-w-xs">
                  <div
                    className="text-slate-700 truncate"
                    title={formatAuthInfo(request.authInfo)}
                  >
                    {formatAuthInfo(request.authInfo)}
                  </div>
                  <div
                    className="font-mono text-xs text-slate-500 cursor-pointer hover:text-slate-800 truncate"
                    title={`クリックしてコピー: ${request.userId}`}
                    onClick={() =>
                      navigator.clipboard
                        .writeText(request.userId)
                        .then(() =>
                          showToast("ユーザーIDをコピーしました", "success"),
                        )
                    }
                  >
                    ID: {request.userId}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {requestStatusBadge(request.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => setViewingRequest(request)}
                    className="px-3 py-1 text-sm bg-slate-200 text-slate-800 rounded hover:bg-slate-300"
                  >
                    詳細を表示
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderParticipantManagement = () => {
    if (isParticipantsLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <Spinner />
        </div>
      );
    }

    const allUsers = new Map<
      string,
      {
        userId: string;
        authInfo: Participant["authInfo"];
        participations: Participant[];
        userCreationDate: Date;
      }
    >();

    allParticipants.forEach((p) => {
      let user = allUsers.get(p.userId);
      
      // Convert p.wonAt to Date object (should already be Date from fetchDashboardData)
      // Create a new Date object to avoid any reference issues
      let pWonAtDate: Date | null = null;
      if (p.wonAt) {
        if (p.wonAt instanceof Date) {
          // Create a new Date object from the existing one to preserve time
          pWonAtDate = new Date(p.wonAt.getTime());
        } else if (p.wonAt && typeof (p.wonAt as any).toDate === 'function') {
          pWonAtDate = (p.wonAt as any).toDate();
        } else if ((p.wonAt as any).seconds !== undefined) {
          // Firestore Timestamp object with seconds property
          if ((p.wonAt as any).nanoseconds !== undefined) {
            const timestamp = new Timestamp((p.wonAt as any).seconds, (p.wonAt as any).nanoseconds);
            pWonAtDate = timestamp.toDate();
          } else {
            pWonAtDate = new Date((p.wonAt as any).seconds * 1000);
          }
        } else if (typeof p.wonAt === 'string' || typeof p.wonAt === 'number') {
          pWonAtDate = new Date(p.wonAt);
        }
      }
      
      // Validate the converted date
      if (pWonAtDate && (!(pWonAtDate instanceof Date) || isNaN(pWonAtDate.getTime()))) {
        pWonAtDate = null;
      }
      
      if (!user) {
        // Use pWonAtDate if available, otherwise fallback to current date
        const initialDate = pWonAtDate ? new Date(pWonAtDate.getTime()) : new Date();
        user = {
          userId: p.userId,
          authInfo: p.authInfo,
          participations: [],
          userCreationDate: initialDate,
        };
        allUsers.set(p.userId, user);
      }
      user.participations.push(p);
      
      // Update userCreationDate if this participation is earlier
      if (pWonAtDate) {
        // Create a new Date object to avoid reference issues
        const pWonAtDateCopy = new Date(pWonAtDate.getTime());
        if (pWonAtDateCopy < user.userCreationDate) {
          user.userCreationDate = pWonAtDateCopy;
        }
      }
    });

    if (allUsers.size === 0) {
      return (
        <div className="text-center py-12 px-6 bg-slate-50 rounded-lg border-2 border-dashed">
          <h3 className="text-lg font-medium text-slate-700">
            参加者がいません
          </h3>
          <p className="text-slate-500 mt-2">
            このキャンペーンにはまだ参加者がいません。
          </p>
        </div>
      );
    }

    const sortedUserData = Array.from(allUsers.values()).sort(
      (a, b) => b.userCreationDate.getTime() - a.userCreationDate.getTime(),
    );

    return (
      <div className="relative">
        <div
          ref={participantTableRef}
          onScroll={handleParticipantTableScroll}
          className="overflow-x-auto border border-slate-200 rounded-lg"
        >
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  ユーザーID
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  初回参加日時
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  認証情報
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  獲得特典
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  参加残回数
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  アクション
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {sortedUserData.map((userData) => {
                const { authInfo, participations, userCreationDate } = userData;

                const prizes = participations.reduce((acc, p) => {
                  const prizeTitle =
                    p.prizeDetails?.title ||
                    (p.isConsolationPrize
                      ? campaign?.consolationPrize?.title
                      : "不明");
                  if (
                    prizeTitle &&
                    prizeTitle !== "不明" &&
                    p.prizeId !== "loss"
                  ) {
                    const prizeData = acc.get(prizeTitle) || {
                      count: 0,
                      isConsolation: !!p.isConsolationPrize,
                    };
                    prizeData.count += 1;
                    acc.set(prizeTitle, prizeData);
                  }
                  return acc;
                }, new Map<string, { count: number; isConsolation: boolean }>());

                const hasOnlyLosses =
                  participations.length > 0 && prizes.size === 0;
                const participationLimit =
                  campaign?.participationLimitPerUser || 0;
                const extraChances =
                  participantOverrides.get(userData.userId) || 0;
                let remainingText;
                const isSpecialParticipation =
                  campaign?.requireTicket || campaign?.requireFormApproval;

                if (!isSpecialParticipation && participationLimit === 0) {
                  remainingText = "無制限";
                } else {
                  const baseLimit = isSpecialParticipation
                    ? 0
                    : participationLimit;
                  const effectiveLimit = baseLimit + extraChances;
                  const remainingCount = effectiveLimit - participations.length;
                  remainingText = `${Math.max(0, remainingCount)}`;

                  if (extraChances > 0) {
                    remainingText += ` (付与: ${extraChances})`;
                  }
                }

                return (
                  <tr
                    key={userData.userId}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      <span
                        className="font-mono text-xs cursor-pointer hover:bg-slate-200 p-1 rounded transition-colors"
                        title={`クリックしてコピー: ${userData.userId}`}
                        onClick={() =>
                          navigator.clipboard
                            .writeText(userData.userId)
                            .then(() =>
                              showToast(
                                "ユーザーIDをコピーしました",
                                "success",
                              ),
                            )
                        }
                      >
                        {userData.userId}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {(() => {
                        // Ensure userCreationDate is a valid Date object
                        let dateToDisplay: Date | null = null;
                        if (userCreationDate instanceof Date && !isNaN(userCreationDate.getTime())) {
                          dateToDisplay = userCreationDate;
                        } else if (userCreationDate) {
                          // Try to convert if it's not a Date
                          if (typeof (userCreationDate as any).toDate === 'function') {
                            dateToDisplay = (userCreationDate as any).toDate();
                          } else {
                            const converted = new Date(userCreationDate as any);
                            if (!isNaN(converted.getTime())) {
                              dateToDisplay = converted;
                            }
                          }
                        }
                        
                        return dateToDisplay && !isNaN(dateToDisplay.getTime())
                          ? dateToDisplay.toLocaleString("ja-JP", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                              hour12: false,
                          })
                          : "-";
                      })()}
                    </td>
                    <td
                      className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 truncate max-w-xs"
                      title={formatAuthInfo(authInfo)}
                    >
                      {formatAuthInfo(authInfo)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      <div className="flex flex-col items-start gap-1">
                        {prizes.size > 0 &&
                          Array.from(prizes.entries()).map(([title, data]) => (
                            <div
                              key={title}
                              className="flex items-center gap-2"
                            >
                              {data.isConsolation && (
                                <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full whitespace-nowrap">
                                  参加賞
                                </span>
                              )}
                              <span>
                                {title} {data.count > 1 && `x ${data.count}`}
                              </span>
                            </div>
                          ))}
                        {hasOnlyLosses && (
                          <span className="text-slate-500">ハズレ</span>
                        )}
                        {prizes.size === 0 && !hasOnlyLosses && <span>-</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 text-center">
                      {remainingText}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-4">
                        <button
                          onClick={() => handleGrantChance(userData)}
                          disabled={!!isActionLoading}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-800 hover:text-slate-900 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                          title="このユーザーに追加の参加権利を付与します。"
                        >
                          {isActionLoading?.id === userData.userId &&
                          isActionLoading?.action === "grant" ? (
                            <Spinner size="sm" />
                          ) : (
                            <PlusIcon className="w-4 h-4" />
                          )}
                          <span>回数付与</span>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(userData)}
                          disabled={!!isActionLoading}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-800 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                          title="このユーザーの参加データをすべて削除します。"
                        >
                          {isActionLoading?.id === userData.userId &&
                          isActionLoading?.action === "delete" ? (
                            <Spinner size="sm" />
                          ) : (
                            <TrashIcon className="w-4 h-4" />
                          )}
                          <span>削除</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {tableScroll.left && (
          <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white via-white/90 to-transparent pointer-events-none transition-opacity"></div>
        )}
        {tableScroll.right && (
          <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white via-white/90 to-transparent pointer-events-none transition-opacity"></div>
        )}
        {hasMoreParticipants && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={loadMoreParticipants}
              disabled={isLoadingMoreParticipants}
              className="px-6 py-3 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-900 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isLoadingMoreParticipants ? (
                <>
                  <Spinner size="sm" />
                  <span>読み込み中...</span>
                </>
              ) : (
                <span>さらに読み込む ({allParticipants.length}件表示中)</span>
              )}
            </button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    );
  }

  if (!client || !campaign) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-red-600">
          データが見つかりません
        </h2>
        <Link
          to="/admin"
          className="mt-4 inline-block text-slate-800 hover:underline"
        >
          ダッシュボードに戻る
        </Link>
      </div>
    );
  }

  const inputClass =
    "block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 disabled:bg-slate-100 disabled:cursor-not-allowed";
  const textareaClass = `${inputClass} min-h-[80px]`;

  const renderPrizeForm = (
    prize: Prize,
    onChangeHandler: (
      field: keyof Prize | `shippingFields.${number}.${"enabled" | "required"}`,
      value: any,
    ) => void,
    onRemoveHandler: () => void,
  ) => (
    <div className="relative p-4 border border-slate-200 rounded-lg space-y-4">
      <button
        onClick={onRemoveHandler}
        className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
        aria-label="景品を削除"
      >
        <TrashIcon className="w-5 h-5" />
      </button>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor={`prize-title-${prize.id}`}
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            タイトル
          </label>
          <input
            type="text"
            id={`prize-title-${prize.id}`}
            value={prize.title}
            onChange={(e) => onChangeHandler("title", e.target.value)}
            placeholder="例: A賞 Amazonギフト券"
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor={`prize-rank-${prize.id}`}
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            賞のランク
          </label>
          <input
            type="text"
            id={`prize-rank-${prize.id}`}
            value={prize.rank}
            onChange={(e) => onChangeHandler("rank", e.target.value)}
            placeholder="例: A賞"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          ランクの色
        </label>
        <div className="flex items-center gap-3 flex-wrap">
          {RANK_COLORS.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => onChangeHandler("rankColor", hex)}
              className={`w-8 h-8 rounded-full transition-all border-2 ${prize.rankColor === hex ? "ring-2 ring-offset-2 ring-slate-500 border-white" : "border-transparent"}`}
              style={{ backgroundColor: hex }}
              aria-label={`色 ${hex} を選択`}
            />
          ))}
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3 ml-1">
            <input
              type="color"
              value={prize.rankColor || "#ffffff"}
              onChange={(e) => onChangeHandler("rankColor", e.target.value)}
              className="w-10 h-10 p-0 border-none rounded-md cursor-pointer bg-white"
              title="カスタムカラーを選択"
            />
            <input
              type="text"
              value={prize.rankColor || ""}
              onChange={(e) => onChangeHandler("rankColor", e.target.value)}
              className={`${inputClass} w-24`}
              placeholder="#6366F1"
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t mt-4">
        <div>
          <label
            htmlFor={`prize-valid-from-${prize.id}`}
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            有効期間 (開始日)
          </label>
          <input
            type="date"
            id={`prize-valid-from-${prize.id}`}
            value={toDateInputString(prize.validFrom)}
            onChange={(e) => onChangeHandler("validFrom", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor={`prize-valid-to-${prize.id}`}
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            有効期間 (終了日)
          </label>
          <input
            type="date"
            id={`prize-valid-to-${prize.id}`}
            value={toDateInputString(prize.validTo)}
            onChange={(e) => onChangeHandler("validTo", e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          景品画像
        </label>
        <div className="flex items-center gap-4">
          {prize.imageUrl && (
            <img
              src={prize.imageUrl}
              alt={prize.title}
              className="w-20 h-20 object-cover rounded-md bg-slate-100"
            />
          )}
          <div className="flex-1">
            {isUploadingFile[prize.id] ? (
              <div className="flex items-center justify-center w-full h-10">
                <Spinner size="sm" />
              </div>
            ) : (
              <label className="cursor-pointer px-4 py-2 bg-white text-slate-700 rounded-md border border-slate-300 hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium">
                <span>画像を選択</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) =>
                    e.target.files &&
                    handleFileUpload(
                      e.target.files[0],
                      prize.id,
                      (url) => onChangeHandler("imageUrl", url),
                      "prizes",
                    )
                  }
                />
              </label>
            )}
          </div>
        </div>
      </div>
      <div>
        <label
          htmlFor={`prize-desc-${prize.id}`}
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          説明文
        </label>
        <textarea
          id={`prize-desc-${prize.id}`}
          value={prize.description}
          onChange={(e) => onChangeHandler("description", e.target.value)}
          rows={3}
          placeholder="景品の詳細な説明"
          className={textareaClass}
        ></textarea>
      </div>
      <div className="border-t border-slate-200 pt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            景品タイプ
          </label>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {(["e-coupon", "url", "mail-delivery"] as PrizeType[]).map(
              (type) => (
                <label key={type} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`prize-type-${prize.id}`}
                    value={type}
                    checked={prize.type === type}
                    onChange={() => onChangeHandler("type", type)}
                    className="h-4 w-4 text-slate-800 border-slate-300 focus:ring-slate-500"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    {
                      {
                        "e-coupon": "引換券",
                        "url": "URL商品",
                        "mail-delivery": "郵送型",
                      }[type]
                    }
                  </span>
                </label>
              ),
            )}
          </div>
        </div>

        {prize.type === "e-coupon" && (
          <div className="space-y-4">
            <div>
              <label
                htmlFor={`prize-coupon-terms-${prize.id}`}
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                利用規約
              </label>
              <textarea
                id={`prize-coupon-terms-${prize.id}`}
                value={prize.couponTerms}
                onChange={(e) => onChangeHandler("couponTerms", e.target.value)}
                rows={5}
                placeholder="利用条件や注意点を入力してください"
                className={textareaClass}
              />
            </div>
            <div>
              <label
                htmlFor={`prize-stores-${prize.id}`}
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                利用可能店舗 (1行に1店舗)
              </label>
              <textarea
                id={`prize-stores-${prize.id}`}
                value={(prize.availableStores || []).join("\n")}
                onChange={(e) =>
                  onChangeHandler("availableStores", e.target.value)
                }
                rows={3}
                placeholder="店舗A&#10;店舗B"
                className={textareaClass}
              ></textarea>
            </div>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor={`prize-coupon-usage-limit-${prize.id}`}
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  使用可能回数
                </label>
                <input
                  type="number"
                  id={`prize-coupon-usage-limit-${prize.id}`}
                  value={prize.couponUsageLimit || 1}
                  onChange={(e) =>
                    onChangeHandler(
                      "couponUsageLimit",
                      parseInt(e.target.value) || 1,
                    )
                  }
                  min="1"
                  step="1"
                  className={`${inputClass} max-w-xs`}
                />
                <p className="text-xs text-slate-500 mt-1">
                  このクーポンを何回まで使用できるか設定します。
                </p>
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prize.preventReusingAtSameStore}
                    onChange={(e) =>
                      onChangeHandler(
                        "preventReusingAtSameStore",
                        e.target.checked,
                      )
                    }
                    className="h-4 w-4 text-slate-800 border-slate-300 rounded focus:ring-slate-500"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    同じ店舗での再利用を禁止する
                  </span>
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  複数回利用可能なクーポンの場合、同じユーザーが同じ店舗で複数回利用できないようにします。
                </p>
              </div>
            </div>
          </div>
        )}
        {prize.type === "url" && (
          <div>
            <label
              htmlFor={`prize-url-stock-${prize.id}`}
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              在庫URLリスト (1行に1URL)
            </label>
            <textarea
              id={`prize-url-stock-${prize.id}`}
              value={(prize.urlStockList || []).join("\n")}
              onChange={(e) => onChangeHandler("urlStockList", e.target.value)}
              rows={5}
              placeholder="https://example.com/item/1&#10;https://example.com/item/2"
              className={`${textareaClass} font-mono text-sm`}
            ></textarea>
          </div>
        )}
        {prize.type === "mail-delivery" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              配送先入力フォーム設定
            </label>
            <div className="space-y-2 rounded-md border border-slate-200 p-3">
              {(prize.shippingFields || []).map((field, fieldIndex) => (
                <div
                  key={field.id}
                  className="flex items-center justify-between"
                >
                  <label
                    htmlFor={`field-enabled-${prize.id}-${fieldIndex}`}
                    className="text-sm text-slate-600"
                  >
                    {field.label}
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        id={`field-required-${prize.id}-${fieldIndex}`}
                        checked={field.required}
                        onChange={(e) =>
                          onChangeHandler(
                            `shippingFields.${fieldIndex}.required`,
                            e.target.checked,
                          )
                        }
                        disabled={!field.enabled}
                        className="h-4 w-4 text-slate-800 border-slate-300 rounded focus:ring-slate-500 disabled:opacity-50"
                      />
                      必須
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        id={`field-enabled-${prize.id}-${fieldIndex}`}
                        checked={field.enabled}
                        onChange={(e) =>
                          onChangeHandler(
                            `shippingFields.${fieldIndex}.enabled`,
                            e.target.checked,
                          )
                        }
                        className="h-4 w-4 text-slate-800 border-slate-300 rounded focus:ring-slate-500"
                      />
                      有効
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div>
          <label
            htmlFor={`prize-stock-${prize.id}`}
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            当選本数 (在庫)
          </label>
          <div className="flex items-center gap-4">
            <input
              type="number"
              id={`prize-stock-${prize.id}`}
              value={prize.stock}
              onChange={(e) => onChangeHandler("stock", e.target.value)}
              min="0"
              step="1"
              className={`${inputClass} flex-1`}
              disabled={prize.unlimitedStock || prize.type === "url"}
            />
            <div className="pt-1">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prize.unlimitedStock}
                  onChange={(e) =>
                    onChangeHandler("unlimitedStock", e.target.checked)
                  }
                  className="h-4 w-4 text-slate-800 border-slate-300 rounded focus:ring-slate-500"
                  disabled={prize.type === "url"}
                />
                <span className="text-sm font-medium text-slate-700">
                  無制限
                </span>
              </label>
            </div>
          </div>
          <div className="flex justify-between items-center mt-1">
            {prize.type === "url" ? (
              <p className="text-xs text-slate-500">
                URLリストの行数から自動計算されます。
              </p>
            ) : (
              <div />
            )}
            <p className="text-xs text-slate-500 font-medium">
              当選済: {prize.winnersCount || 0} 本 / 残り:{" "}
              {prize.unlimitedStock ? "無制限" : prize.stock || 0} 本
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      {croppingConfig && (
        <ImageCropper
          src={croppingConfig.src}
          onCropComplete={croppingConfig.onComplete}
          onCancel={() => setCroppingConfig(null)}
        />
      )}
      {viewingRequest && campaign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b pb-4">
              <h2 className="text-lg font-bold">申請内容詳細</h2>
              <button
                onClick={() => setViewingRequest(null)}
                className="p-1.5 rounded-full hover:bg-slate-200 transition-colors"
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
                    d="M6 18 18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto space-y-4 flex-1 pr-2">
              {campaign.approvalFormFields?.map((field) => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-slate-600">
                    {field.label}
                  </label>
                  {field.type === "file" ? (
                    viewingRequest.formData[field.id] ? (
                      <a
                        href={viewingRequest.formData[field.id]}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          src={viewingRequest.formData[field.id]}
                          alt="添付ファイル"
                          className="max-w-xs max-h-48 mt-1 rounded-md border object-contain"
                        />
                      </a>
                    ) : (
                      <p className="text-sm text-slate-500 mt-1">
                        (ファイルなし)
                      </p>
                    )
                  ) : (
                    <p className="mt-1 text-sm text-slate-800 p-2 bg-slate-50 border rounded-md whitespace-pre-wrap">
                      {viewingRequest.formData[field.id] || "(未入力)"}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {viewingRequest.status === "pending" && (
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <button
                  onClick={() => {
                    handleUpdateRequestStatus(viewingRequest, "rejected");
                    setViewingRequest(null);
                  }}
                  disabled={!!isActionLoading}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-300 flex items-center"
                >
                  {isActionLoading?.id === viewingRequest.id &&
                    isActionLoading.action === "rejected" && (
                      <Spinner size="sm" className="mr-1.5" />
                    )}
                  却下
                </button>
                <button
                  onClick={() => {
                    handleUpdateRequestStatus(viewingRequest, "approved");
                    setViewingRequest(null);
                  }}
                  disabled={!!isActionLoading}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300 flex items-center"
                >
                  {isActionLoading?.id === viewingRequest.id &&
                    isActionLoading.action === "approved" && (
                      <Spinner size="sm" className="mr-1.5" />
                    )}
                  承認
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="mb-6">
        <Link to="/admin" className="text-sm text-slate-800 hover:underline">
          ダッシュボード
        </Link>
        <span className="mx-2 text-sm text-slate-400">/</span>
        <Link
          to={`/admin/clients/${client.id}`}
          className="text-sm text-slate-800 hover:underline"
        >
          {client.name}
        </Link>
        <span className="mx-2 text-sm text-slate-400">/</span>
        <span className="text-sm text-slate-600">{campaignName}</span>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">
              {campaignName}
            </h1>
            <div className="mt-2">{statusBadge(campaign.status)}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {campaign.status !== "archived" && (
              <button
                onClick={handleToggleStatus}
                className={`px-4 py-2 text-white rounded-md transition-colors text-sm disabled:opacity-50 flex items-center ${campaign.status === "published" ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-500 hover:bg-emerald-600"}`}
                disabled={isTogglingStatus}
              >
                {isTogglingStatus && <Spinner size="sm" className="mr-2" />}
                {campaign.status === "published"
                  ? "一時非公開にする"
                  : "キャンペーンを公開"}
              </button>
            )}
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-900 transition-colors disabled:bg-slate-400 flex items-center text-sm"
              disabled={isSaving}
            >
              {isSaving && <Spinner size="sm" className="mr-2" />}
              保存
            </button>
          </div>
        </div>
        {campaign.status === "published" && (
          <div className="border-t border-slate-200 pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              キャンペーンページURL
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                readOnly
                value={campaignUrl}
                className="w-full flex-grow px-3 py-2 bg-slate-100 border border-slate-300 rounded-md focus:outline-none text-sm"
              />
              <button
                onClick={() => handleCopyUrl(campaignUrl)}
                className="p-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 transition-colors"
                aria-label="URLをコピー"
              >
                <CopyIcon />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-1/4">
          <nav className="space-y-1 bg-white p-4 rounded-lg shadow-sm">
            {MENU_ITEMS.map((item) => (
              <a
                key={item}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveMenu(item);
                }}
                className={`flex justify-between items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeMenu === item ? "bg-slate-100 text-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {item}
                {activeMenu === item && (
                  <ChevronRightIcon className="w-5 h-5 text-slate-800" />
                )}
              </a>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="bg-white p-8 rounded-lg shadow-inner h-full">
            <h3 className="text-xl font-bold mb-6">{activeMenu}</h3>
            {activeMenu === "ダッシュボード" && renderDashboard()}
            {activeMenu === "申請管理" && renderApplicationManagement()}
            {activeMenu === "参加者管理" && renderParticipantManagement()}
            {activeMenu === "基本設定" && (
              <div className="space-y-6">
                <div>
                  <label
                    htmlFor="campaignName"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    キャンペーン名
                  </label>
                  <input
                    type="text"
                    id="campaignName"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showNameOnPublicPage"
                    checked={showNameOnPublicPage}
                    onChange={(e) => setShowNameOnPublicPage(e.target.checked)}
                    className="h-4 w-4 text-slate-800 border-slate-300 rounded focus:ring-slate-500"
                  />
                  <label
                    htmlFor="showNameOnPublicPage"
                    className="text-sm font-medium text-slate-700"
                  >
                    キャンペーン名をキャンペーンページに表示する
                  </label>
                </div>
                <div>
                  <label
                    htmlFor="campaignDescription"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    キャンペーン概要
                  </label>
                  <textarea
                    id="campaignDescription"
                    value={campaignDescription}
                    onChange={(e) => setCampaignDescription(e.target.value)}
                    rows={5}
                    className={textareaClass}
                    placeholder="キャンペーンの目的や詳細を記入してください。"
                  />
                </div>
                <div className="border-t pt-6 mt-6 space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eventModeEnabled}
                      onChange={(e) => setEventModeEnabled(e.target.checked)}
                      className="h-5 w-5 text-slate-800 border-slate-300 rounded focus:ring-slate-500"
                    />
                    <span className="text-md font-semibold text-slate-700">
                      イベントモードを有効にする
                    </span>
                  </label>
                  <p className="text-sm text-slate-500 pl-8">
                    現地での抽選会を盛り上げるためのモニター画面機能です。有効にすると、参加用のQRコードを大画面に表示し、抽選の様子をリアルタイムで映し出せます。
                  </p>
                  {eventModeEnabled && (
                    <div className="pl-8 space-y-4">
                      <div>
                        <label
                          htmlFor="eventModeChances"
                          className="block text-sm font-medium text-slate-700 mb-1"
                        >
                          付与する抽選回数
                        </label>
                        <input
                          type="number"
                          id="eventModeChances"
                          value={eventModeChancesToGrant}
                          onChange={(e) =>
                            setEventModeChancesToGrant(
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value),
                            )
                          }
                          min="1"
                          step="1"
                          className={`${inputClass} max-w-xs`}
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          イベント参加時にQRコードをスキャンしたユーザーに付与する抽選回数です。
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!campaignId) return;
                          const monitorUrl = `${window.location.origin}/monitor/${campaignId}`;
                          window.open(monitorUrl, "_blank");
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-900 transition-colors"
                      >
                        モニターを起動
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeMenu === "ページコンテンツ" && (
              <div className="space-y-8">
                <div className="space-y-4 p-4 border border-slate-200 rounded-lg">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pageContent.participationGuideEnabled}
                      onChange={(e) =>
                        handlePageContentChange(
                          "participationGuideEnabled",
                          e.target.checked,
                        )
                      }
                      className="h-5 w-5 text-slate-800 border-slate-300 rounded focus:ring-slate-500"
                    />
                    <span className="text-lg font-semibold text-slate-800">
                      参加方法
                    </span>
                  </label>
                  {pageContent.participationGuideEnabled && (
                    <div className="space-y-4 pl-8 pt-4 border-t border-slate-200 animate-fade-in">
                      <div>
                        <label
                          htmlFor="participationGuideTitle"
                          className="block text-sm font-medium text-slate-700 mb-1"
                        >
                          セクションタイトル
                        </label>
                        <input
                          type="text"
                          id="participationGuideTitle"
                          value={pageContent.participationGuideTitle}
                          onChange={(e) =>
                            handlePageContentChange(
                              "participationGuideTitle",
                              e.target.value,
                            )
                          }
                          className={inputClass}
                        />
                      </div>
                      <div className="flex gap-2 rounded-md bg-slate-100 p-1 w-fit">
                        <button
                          onClick={() =>
                            handlePageContentChange(
                              "participationGuideType",
                              "steps",
                            )
                          }
                          className={`px-3 py-1 text-sm rounded ${pageContent.participationGuideType === "steps" ? "bg-white shadow-sm text-slate-800" : "text-slate-600"}`}
                        >
                          ステップ式
                        </button>
                        <button
                          onClick={() =>
                            handlePageContentChange(
                              "participationGuideType",
                              "custom_text",
                            )
                          }
                          className={`px-3 py-1 text-sm rounded ${pageContent.participationGuideType === "custom_text" ? "bg-white shadow-sm text-slate-800" : "text-slate-600"}`}
                        >
                          カスタムテキスト
                        </button>
                      </div>
                      {pageContent.participationGuideType === "steps" ? (
                        <div className="space-y-2">
                          {(pageContent.participationGuideSteps || []).map(
                            (step, index) => (
                              <div
                                key={step.id}
                                className="relative p-3 border rounded-md bg-slate-50 space-y-2"
                              >
                                <button
                                  onClick={() =>
                                    removeArrayItem(
                                      "participationGuideSteps",
                                      index,
                                    )
                                  }
                                  className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                                <input
                                  type="text"
                                  value={step.title}
                                  onChange={(e) =>
                                    handleArrayItemChange(
                                      "participationGuideSteps",
                                      index,
                                      "title",
                                      e.target.value,
                                    )
                                  }
                                  placeholder={`ステップ ${index + 1} タイトル`}
                                  className={`${inputClass} text-sm`}
                                />
                                <textarea
                                  value={step.description}
                                  onChange={(e) =>
                                    handleArrayItemChange(
                                      "participationGuideSteps",
                                      index,
                                      "description",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="説明文"
                                  rows={2}
                                  className={`${textareaClass} text-sm`}
                                ></textarea>
                              </div>
                            ),
                          )}
                          <button
                            onClick={() =>
                              addArrayItem("participationGuideSteps", {
                                title: "",
                                description: "",
                              })
                            }
                            className="text-sm inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md"
                          >
                            <PlusIcon className="w-4 h-4" /> ステップを追加
                          </button>
                        </div>
                      ) : (
                        <textarea
                          value={pageContent.participationGuideCustomText}
                          onChange={(e) =>
                            handlePageContentChange(
                              "participationGuideCustomText",
                              e.target.value,
                            )
                          }
                          rows={10}
                          className={textareaClass}
                          placeholder="参加方法やルール・規約を自由に入力してください。"
                        ></textarea>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4 p-4 border border-slate-200 rounded-lg">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pageContent.faqEnabled}
                      onChange={(e) =>
                        handlePageContentChange("faqEnabled", e.target.checked)
                      }
                      className="h-5 w-5 text-slate-800 border-slate-300 rounded focus:ring-slate-500"
                    />
                    <span className="text-lg font-semibold text-slate-800">
                      よくある質問 (FAQ)
                    </span>
                  </label>
                  {pageContent.faqEnabled && (
                    <div className="space-y-4 pl-8 pt-4 border-t border-slate-200 animate-fade-in">
                      <div>
                        <label
                          htmlFor="faqTitle"
                          className="block text-sm font-medium text-slate-700 mb-1"
                        >
                          セクションタイトル
                        </label>
                        <input
                          type="text"
                          id="faqTitle"
                          value={pageContent.faqTitle}
                          onChange={(e) =>
                            handlePageContentChange("faqTitle", e.target.value)
                          }
                          className={inputClass}
                        />
                      </div>
                      {(pageContent.faqItems || []).map((item, index) => (
                        <div
                          key={item.id}
                          className="relative p-3 border rounded-md bg-slate-50 space-y-2"
                        >
                          <button
                            onClick={() => removeArrayItem("faqItems", index)}
                            className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                          <input
                            type="text"
                            value={item.question}
                            onChange={(e) =>
                              handleArrayItemChange(
                                "faqItems",
                                index,
                                "question",
                                e.target.value,
                              )
                            }
                            placeholder="質問"
                            className={`${inputClass} text-sm`}
                          />
                          <textarea
                            value={item.answer}
                            onChange={(e) =>
                              handleArrayItemChange(
                                "faqItems",
                                index,
                                "answer",
                                e.target.value,
                              )
                            }
                            placeholder="回答"
                            rows={3}
                            className={`${textareaClass} text-sm`}
                          ></textarea>
                        </div>
                      ))}
                      <button
                        onClick={() =>
                          addArrayItem("faqItems", { question: "", answer: "" })
                        }
                        className="text-sm inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md"
                      >
                        <PlusIcon className="w-4 h-4" /> Q&Aを追加
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-4 p-4 border border-slate-200 rounded-lg">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pageContent.organizerInfoEnabled}
                      onChange={(e) =>
                        handlePageContentChange(
                          "organizerInfoEnabled",
                          e.target.checked,
                        )
                      }
                      className="h-5 w-5 text-slate-800 border-slate-300 rounded focus:ring-slate-500"
                    />
                    <span className="text-lg font-semibold text-slate-800">
                      主催者情報
                    </span>
                  </label>
                  {pageContent.organizerInfoEnabled && (
                    <div className="space-y-4 pl-8 pt-4 border-t border-slate-200 animate-fade-in">
                      <div>
                        <label
                          htmlFor="organizerInfoTitle"
                          className="block text-sm font-medium text-slate-700 mb-1"
                        >
                          セクションタイトル
                        </label>
                        <input
                          type="text"
                          id="organizerInfoTitle"
                          value={pageContent.organizerInfoTitle}
                          onChange={(e) =>
                            handlePageContentChange(
                              "organizerInfoTitle",
                              e.target.value,
                            )
                          }
                          className={inputClass}
                        />
                      </div>
                      <textarea
                        value={pageContent.organizerInfoText}
                        onChange={(e) =>
                          handlePageContentChange(
                            "organizerInfoText",
                            e.target.value,
                          )
                        }
                        rows={5}
                        className={textareaClass}
                        placeholder="主催者名、連絡先などを入力します。"
                      ></textarea>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4 p-4 border border-slate-200 rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pageContent.termsOfServiceEnabled}
                        onChange={(e) =>
                          handlePageContentChange(
                            "termsOfServiceEnabled",
                            e.target.checked,
                          )
                        }
                        className="h-5 w-5 text-slate-800 border-slate-300 rounded focus:ring-slate-500"
                      />
                      <span className="text-md font-semibold text-slate-800">
                        利用規約
                      </span>
                    </label>
                    {pageContent.termsOfServiceEnabled && (
                      <div className="space-y-4 pt-4 border-t animate-fade-in">
                        <input
                          type="text"
                          value={pageContent.termsOfServiceLinkText}
                          onChange={(e) =>
                            handlePageContentChange(
                              "termsOfServiceLinkText",
                              e.target.value,
                            )
                          }
                          placeholder="リンクテキスト"
                          className={inputClass}
                        />
                        <textarea
                          value={pageContent.termsOfServiceContent}
                          onChange={(e) =>
                            handlePageContentChange(
                              "termsOfServiceContent",
                              e.target.value,
                            )
                          }
                          rows={10}
                          className={textareaClass}
                          placeholder="ポップアップで表示する内容"
                        ></textarea>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4 p-4 border border-slate-200 rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pageContent.privacyPolicyEnabled}
                        onChange={(e) =>
                          handlePageContentChange(
                            "privacyPolicyEnabled",
                            e.target.checked,
                          )
                        }
                        className="h-5 w-5 text-slate-800 border-slate-300 rounded focus:ring-slate-500"
                      />
                      <span className="text-md font-semibold text-slate-800">
                        プライバシーポリシー
                      </span>
                    </label>
                    {pageContent.privacyPolicyEnabled && (
                      <div className="space-y-4 pt-4 border-t animate-fade-in">
                        <input
                          type="text"
                          value={pageContent.privacyPolicyLinkText}
                          onChange={(e) =>
                            handlePageContentChange(
                              "privacyPolicyLinkText",
                              e.target.value,
                            )
                          }
                          placeholder="リンクテキスト"
                          className={inputClass}
                        />
                        <textarea
                          value={pageContent.privacyPolicyContent}
                          onChange={(e) =>
                            handlePageContentChange(
                              "privacyPolicyContent",
                              e.target.value,
                            )
                          }
                          rows={10}
                          className={textareaClass}
                          placeholder="ポップアップで表示する内容"
                        ></textarea>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 p-4 border border-slate-200 rounded-lg">
                  <h4 className="text-lg font-semibold text-slate-800">
                    フッター情報
                  </h4>
                  <div className="space-y-4 pt-4 border-t">
                    <div>
                      <h5 className="text-md font-semibold text-slate-700 mb-2">
                        テキストリンク
                      </h5>
                      {(pageContent.footerTextLinks || []).map(
                        (link, index) => (
                          <div
                            key={link.id}
                            className="relative flex gap-2 items-center p-2 border-b"
                          >
                            <input
                              type="text"
                              value={link.text}
                              onChange={(e) =>
                                handleArrayItemChange(
                                  "footerTextLinks",
                                  index,
                                  "text",
                                  e.target.value,
                                )
                              }
                              placeholder="表示テキスト"
                              className={`${inputClass} text-sm flex-1`}
                            />
                            <input
                              type="url"
                              value={link.url}
                              onChange={(e) =>
                                handleArrayItemChange(
                                  "footerTextLinks",
                                  index,
                                  "url",
                                  e.target.value,
                                )
                              }
                              placeholder="URL"
                              className={`${inputClass} text-sm flex-1`}
                            />
                            <button
                              onClick={() =>
                                removeArrayItem("footerTextLinks", index)
                              }
                              className="p-1 text-slate-400 hover:text-red-500"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ),
                      )}
                      <button
                        onClick={() =>
                          addArrayItem("footerTextLinks", { text: "", url: "" })
                        }
                        className="mt-2 text-sm inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md"
                      >
                        <PlusIcon className="w-4 h-4" /> テキストリンクを追加
                      </button>
                    </div>
                    <div>
                      <h5 className="text-md font-semibold text-slate-700 mb-2">
                        バナーリンク
                      </h5>
                      {(pageContent.footerBannerLinks || []).map(
                        (banner, index) => (
                          <div
                            key={banner.id}
                            className="relative p-3 border rounded-md bg-slate-50 space-y-2"
                          >
                            <button
                              onClick={() =>
                                removeArrayItem("footerBannerLinks", index)
                              }
                              className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                            <div className="flex gap-4 items-center">
                              {banner.imageUrl && (
                                <img
                                  src={banner.imageUrl}
                                  alt="banner preview"
                                  className="w-24 h-auto object-contain rounded bg-white border"
                                />
                              )}
                              <div className="flex-1 space-y-2">
                                {isUploadingFile[banner.id] ? (
                                  <div className="h-10 flex justify-center items-center">
                                    <Spinner size="sm" />
                                  </div>
                                ) : (
                                  <label className="text-sm cursor-pointer px-3 py-1.5 bg-white border rounded-md">
                                    画像を選択
                                    <input
                                      type="file"
                                      className="hidden"
                                      accept="image/*"
                                      onChange={(e) =>
                                        e.target.files &&
                                        handleFileUpload(
                                          e.target.files[0],
                                          banner.id,
                                          (url) =>
                                            handleArrayItemChange(
                                              "footerBannerLinks",
                                              index,
                                              "imageUrl",
                                              url,
                                            ),
                                          "banners",
                                        )
                                      }
                                    />
                                  </label>
                                )}
                                <input
                                  type="url"
                                  value={banner.url}
                                  onChange={(e) =>
                                    handleArrayItemChange(
                                      "footerBannerLinks",
                                      index,
                                      "url",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="リンク先URL"
                                  className={`${inputClass} text-sm`}
                                />
                                <input
                                  type="text"
                                  value={banner.altText}
                                  onChange={(e) =>
                                    handleArrayItemChange(
                                      "footerBannerLinks",
                                      index,
                                      "altText",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="代替テキスト (任意)"
                                  className={`${inputClass} text-sm`}
                                />
                              </div>
                            </div>
                          </div>
                        ),
                      )}
                      <button
                        onClick={() =>
                          addArrayItem("footerBannerLinks", {
                            imageUrl: "",
                            url: "",
                            altText: "",
                          })
                        }
                        className="mt-2 text-sm inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md"
                      >
                        <PlusIcon className="w-4 h-4" /> バナーを追加
                      </button>
                    </div>
                    <div>
                      <label
                        htmlFor="footerOperatorInfo"
                        className="text-md font-semibold text-slate-700 mb-2 block"
                      >
                        運営者情報 (Copyrightなど)
                      </label>
                      <input
                        type="text"
                        id="footerOperatorInfo"
                        value={pageContent.footerOperatorInfo}
                        onChange={(e) =>
                          handlePageContentChange(
                            "footerOperatorInfo",
                            e.target.value,
                          )
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeMenu === "デザイン" && (
              <div className="space-y-8">
                <div className="space-y-4 p-4 border border-slate-200 rounded-lg">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={designSettings.mainVisual?.enabled}
                      onChange={(e) =>
                        handleDesignChange(
                          "mainVisual",
                          "enabled",
                          e.target.checked,
                        )
                      }
                      className="h-5 w-5 text-slate-800 border-slate-300 rounded focus:ring-slate-500"
                    />
                    <span className="text-lg font-semibold text-slate-800">
                      メインビジュアル
                    </span>
                  </label>
                  {designSettings.mainVisual?.enabled && (
                    <div className="space-y-4 pl-8 pt-4 border-t border-slate-200 animate-fade-in">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          画像アップロード
                        </label>
                        <div className="flex items-center gap-4">
                          {designSettings.mainVisual.imageUrl && (
                            <img
                              src={designSettings.mainVisual.imageUrl}
                              alt="Main visual preview"
                              className="w-48 h-auto object-cover rounded-md bg-slate-100 border"
                            />
                          )}
                          {isUploadingFile["mainVisual"] ? (
                            <div className="h-10 flex justify-center items-center">
                              <Spinner />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <label className="cursor-pointer px-4 py-2 bg-white text-slate-700 rounded-md border border-slate-300 hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium">
                                <span>
                                  {designSettings.mainVisual.imageUrl
                                    ? "画像を再選択"
                                    : "画像を選択"}
                                </span>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*"
                                  onChange={(e) =>
                                    e.target.files &&
                                    e.target.files.length > 0 &&
                                    handleMainVisualFileSelect(
                                      e.target.files[0],
                                    )
                                  }
                                />
                              </label>
                              {designSettings.mainVisual.imageUrl && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCroppingConfig({
                                      src: designSettings.mainVisual!.imageUrl!,
                                      onComplete: (dataUrl) =>
                                        handleUploadCroppedMainVisual(dataUrl),
                                    });
                                  }}
                                  className="p-2 bg-white text-slate-700 rounded-md border border-slate-300 hover:bg-slate-50 transition-colors shadow-sm"
                                  aria-label="画像を切り抜く"
                                >
                                  <PencilIcon className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4 p-4 border border-slate-200 rounded-lg">
                  <h4 className="text-lg font-semibold text-slate-800">
                    テーマカラー
                  </h4>
                  <p className="text-sm text-slate-500">
                    ボタンやリンクなどのアクセントカラーになります。
                  </p>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={designSettings.themeColor || "#1E293B"}
                      onChange={(e) =>
                        setDesignSettings((prev) => ({
                          ...prev,
                          themeColor: e.target.value,
                        }))
                      }
                      className="w-12 h-12 p-1 border border-slate-300 rounded-md cursor-pointer"
                    />
                    <input
                      type="text"
                      value={designSettings.themeColor || "#1E293B"}
                      onChange={(e) =>
                        setDesignSettings((prev) => ({
                          ...prev,
                          themeColor: e.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="space-y-4 p-4 border border-slate-200 rounded-lg">
                  <h4 className="text-lg font-semibold text-slate-800">背景</h4>
                  <div className="flex gap-2 rounded-md bg-slate-100 p-1 w-fit">
                    <button
                      onClick={() =>
                        handleDesignChange("background", "type", "color")
                      }
                      className={`px-3 py-1 text-sm rounded ${designSettings.background?.type === "color" ? "bg-white shadow-sm text-slate-800" : "text-slate-600"}`}
                    >
                      カラー
                    </button>
                    <button
                      onClick={() =>
                        handleDesignChange("background", "type", "image")
                      }
                      className={`px-3 py-1 text-sm rounded ${designSettings.background?.type === "image" ? "bg-white shadow-sm text-slate-800" : "text-slate-600"}`}
                    >
                      画像
                    </button>
                  </div>
                  {designSettings.background?.type === "color" ? (
                    <div className="flex items-center gap-4 animate-fade-in">
                      <input
                        type="color"
                        value={designSettings.background.color || "#F1F5F9"}
                        onChange={(e) =>
                          handleDesignChange(
                            "background",
                            "color",
                            e.target.value,
                          )
                        }
                        className="w-12 h-12 p-1 border border-slate-300 rounded-md cursor-pointer"
                      />
                      <input
                        type="text"
                        value={designSettings.background.color || "#F1F5F9"}
                        onChange={(e) =>
                          handleDesignChange(
                            "background",
                            "color",
                            e.target.value,
                          )
                        }
                        className={inputClass}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4 animate-fade-in">
                      <label className="block text-sm font-medium text-slate-700">
                        画像アップロード
                      </label>
                      <div className="flex items-center gap-4">
                        {designSettings.background?.imageUrl && (
                          <img
                            src={designSettings.background.imageUrl}
                            alt="Background preview"
                            className="w-48 h-auto object-cover rounded-md bg-slate-100 border"
                          />
                        )}
                        {isUploadingFile["background"] ? (
                          <div className="h-10 flex justify-center items-center">
                            <Spinner />
                          </div>
                        ) : (
                          <label className="cursor-pointer px-4 py-2 bg-white text-slate-700 rounded-md border border-slate-300 hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium">
                            <span>画像を選択</span>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={(e) =>
                                e.target.files &&
                                handleFileUpload(
                                  e.target.files[0],
                                  "background",
                                  (url) =>
                                    handleDesignChange(
                                      "background",
                                      "imageUrl",
                                      url,
                                    ),
                                  "design",
                                )
                              }
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeMenu === "演出" && (
              <div className="space-y-8">
                <div className="space-y-4 p-4 border border-slate-200 rounded-lg">
                  <h4 className="text-lg font-semibold text-slate-800">
                    演出タイプ
                  </h4>
                  <p className="text-sm text-slate-500">
                    参加ボタンのテキストや、デフォルトのアニメーションが変わります。
                  </p>
                  <div className="flex flex-wrap gap-4">
                    {(
                      [
                        "simple",
                        "lottery-box",
                        "gacha",
                        "scratch",
                      ] as PresentationType[]
                    ).map((type) => (
                      <label
                        key={type}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="presentationType"
                          value={type}
                          checked={presentationSettings.type === type}
                          onChange={() => handlePresentationTypeChange(type)}
                          className="h-4 w-4 text-slate-800 border-slate-300 focus:ring-slate-500"
                        />
                        <span className="text-sm font-medium text-slate-700">
                          {
                            {
                              "simple": "抽選(基本)",
                              "lottery-box": "くじ引き",
                              "gacha": "ガチャ",
                              "scratch": "スクラッチ",
                            }[type]
                          }
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-4 p-4 border border-slate-200 rounded-lg">
                  <label
                    htmlFor="participationButtonText"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    参加ボタンのテキスト
                  </label>
                  <input
                    type="text"
                    id="participationButtonText"
                    value={presentationSettings.participationButtonText}
                    onChange={(e) =>
                      setPresentationSettings((p) => ({
                        ...p,
                        participationButtonText: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </div>
                <div className="space-y-4 p-4 border border-slate-200 rounded-lg">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={presentationSettings.soundSettings?.enabled}
                      onChange={(e) =>
                        handlePresentationChange(
                          "soundSettings",
                          "enabled",
                          e.target.checked,
                        )
                      }
                      className="h-5 w-5 text-slate-800 border-slate-300 rounded focus:ring-slate-500"
                    />
                    <span className="text-lg font-semibold text-slate-800">
                      サウンド設定
                    </span>
                  </label>
                  {presentationSettings.soundSettings?.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-4 border-t animate-fade-in">
                      {(
                        [
                          {
                            id: "participationSoundUrl",
                            label: "参加ボタンクリック音",
                          },
                          { id: "drawingSoundUrl", label: "抽選中の音" },
                          { id: "winSoundUrl", label: "当選時の音" },
                          { id: "loseSoundUrl", label: "ハズレ時の音" },
                        ] as const
                      ).map((sound) => (
                        <div key={sound.id}>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            {sound.label}
                          </label>
                          {isUploadingFile[sound.id] ? (
                            <div className="h-10 flex justify-center items-center">
                              <Spinner size="sm" />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <label className="cursor-pointer px-3 py-1.5 bg-white text-slate-700 rounded-md border border-slate-300 hover:bg-slate-50 text-sm">
                                <span>ファイルを選択</span>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="audio/*"
                                  onChange={(e) =>
                                    e.target.files &&
                                    handleFileUpload(
                                      e.target.files[0],
                                      sound.id,
                                      (url) =>
                                        handlePresentationChange(
                                          "soundSettings",
                                          sound.id,
                                          url,
                                        ),
                                      "sounds",
                                    )
                                  }
                                />
                              </label>
                              {presentationSettings.soundSettings?.[
                                sound.id
                              ] && (
                                <>
                                  <audio
                                    src={
                                      presentationSettings.soundSettings[
                                        sound.id
                                      ]
                                    }
                                    controls
                                    className="h-8"
                                  ></audio>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handlePresentationChange(
                                        "soundSettings",
                                        sound.id,
                                        "",
                                      )
                                    }
                                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-full"
                                    aria-label={`${sound.label}を削除`}
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-6 p-4 border border-slate-200 rounded-lg">
                  <h4 className="text-lg font-semibold text-slate-800">
                    アニメーション設定
                  </h4>
                  <p className="text-sm text-slate-500">
                    抽選中・結果表示時に表示する画像や動画を設定します。未設定の場合はデフォルトの表示になります。
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                    {[
                      { id: "drawing", label: "抽選中" },
                      { id: "win", label: "当選時" },
                      { id: "lose", label: "ハズレ時" },
                    ].map((anim) => (
                      <div key={anim.id} className="space-y-4">
                        <h5 className="font-semibold text-slate-700">
                          {anim.label}
                        </h5>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            画像 (GIF推奨)
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            className="text-sm text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                            onChange={(e) =>
                              e.target.files &&
                              handleFileUpload(
                                e.target.files[0],
                                `${anim.id}Image`,
                                (url) =>
                                  handlePresentationChange(
                                    "animationSettings",
                                    `${anim.id}AnimationImageUrl`,
                                    url,
                                  ),
                                "animations",
                              )
                            }
                          />
                          {presentationSettings.animationSettings?.[
                            `${anim.id}AnimationImageUrl` as keyof typeof presentationSettings.animationSettings
                          ] && (
                            <div className="mt-2 flex items-center gap-2">
                              <img
                                src={
                                  presentationSettings.animationSettings[
                                    `${anim.id}AnimationImageUrl` as keyof typeof presentationSettings.animationSettings
                                  ]
                                }
                                className="h-24 w-auto rounded border"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handlePresentationChange(
                                    "animationSettings",
                                    `${anim.id}AnimationImageUrl`,
                                    "",
                                  )
                                }
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-full self-start"
                                aria-label={`${anim.label}の画像を削除`}
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            動画 (MP4)
                          </label>
                          <input
                            type="file"
                            accept="video/*"
                            className="text-sm text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                            onChange={(e) =>
                              e.target.files &&
                              handleFileUpload(
                                e.target.files[0],
                                `${anim.id}Video`,
                                (url) =>
                                  handlePresentationChange(
                                    "animationSettings",
                                    `${anim.id}AnimationVideoUrl`,
                                    url,
                                  ),
                                "animations",
                              )
                            }
                          />
                          {presentationSettings.animationSettings?.[
                            `${anim.id}AnimationVideoUrl` as keyof typeof presentationSettings.animationSettings
                          ] && (
                            <div className="mt-2 flex items-center gap-2">
                              <video
                                src={
                                  presentationSettings.animationSettings[
                                    `${anim.id}AnimationVideoUrl` as keyof typeof presentationSettings.animationSettings
                                  ]
                                }
                                className="h-24 w-auto rounded border"
                                controls
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handlePresentationChange(
                                    "animationSettings",
                                    `${anim.id}AnimationVideoUrl`,
                                    "",
                                  )
                                }
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-full self-start"
                                aria-label={`${anim.label}の動画を削除`}
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {activeMenu === "期間設定" && (
              <div className="space-y-8">
                <div className="space-y-4 p-4 border border-slate-200 rounded-lg">
                  <h4 className="text-lg font-semibold text-slate-800">
                    キャンペーン公開期間
                  </h4>
                  <p className="text-sm text-slate-500">
                    この期間外にアクセスした場合、キャンペーンページは表示されず、設定したメッセージが表示されます。
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="publishStartDate"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        公開開始日時
                      </label>
                      <input
                        type="datetime-local"
                        id="publishStartDate"
                        value={publishStartDate}
                        onChange={(e) => setPublishStartDate(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="publishEndDate"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        公開終了日時
                      </label>
                      <input
                        type="datetime-local"
                        id="publishEndDate"
                        value={publishEndDate}
                        onChange={(e) => setPublishEndDate(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="publishOutOfRangeMsg"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      期間外のページ表示メッセージ
                    </label>
                    <textarea
                      id="publishOutOfRangeMsg"
                      value={publishOutOfRangeMsg}
                      onChange={(e) => setPublishOutOfRangeMsg(e.target.value)}
                      rows={3}
                      className={textareaClass}
                    />
                  </div>
                </div>
                <div className="space-y-4 p-4 border border-slate-200 rounded-lg">
                  <h4 className="text-lg font-semibold text-slate-800">
                    応募受付期間
                  </h4>
                  <p className="text-sm text-slate-500">
                    この期間外にアクセスした場合、応募ボタンは表示されず、設定したメッセージが表示されます。
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="appStartDate"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        応募受付開始日時
                      </label>
                      <input
                        type="datetime-local"
                        id="appStartDate"
                        value={appStartDate}
                        onChange={(e) => setAppStartDate(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="appEndDate"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        応募受付終了日時
                      </label>
                      <input
                        type="datetime-local"
                        id="appEndDate"
                        value={appEndDate}
                        onChange={(e) => setAppEndDate(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="appOutOfRangeMsg"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      期間外の応募エリア表示メッセージ
                    </label>
                    <textarea
                      id="appOutOfRangeMsg"
                      value={appOutOfRangeMsg}
                      onChange={(e) => setAppOutOfRangeMsg(e.target.value)}
                      rows={3}
                      className={textareaClass}
                    />
                  </div>
                </div>
              </div>
            )}
            {activeMenu === "参加者認証" && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-slate-800">
                    参加方法
                  </h4>
                  <p className="text-sm text-slate-500">
                    キャンペーンへの参加方法を選択してください。
                  </p>
                  <div className="space-y-3">
                    <label className="flex items-center p-3 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="authMethod"
                        value="anonymous"
                        checked={participantAuthMethod === "anonymous"}
                        onChange={() => setParticipantAuthMethod("anonymous")}
                        className="h-4 w-4 text-slate-800 border-slate-300 focus:ring-slate-500"
                      />
                      <span className="ml-3 text-sm font-medium text-slate-700">
                        匿名参加を許可する（かんたん参加）
                      </span>
                    </label>
                    <label className="flex items-center p-3 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="authMethod"
                        value="required"
                        checked={participantAuthMethod === "required"}
                        onChange={() => setParticipantAuthMethod("required")}
                        className="h-4 w-4 text-slate-800 border-slate-300 focus:ring-slate-500"
                      />
                      <span className="ml-3 text-sm font-medium text-slate-700">
                        参加時にユーザー認証を必須にする
                      </span>
                    </label>
                  </div>
                </div>
                <div className="space-y-4 p-4 border border-slate-200 rounded-lg">
                  <h4 className="text-lg font-semibold text-slate-800">
                    認証方法
                  </h4>
                  <p className="text-sm text-slate-500">
                    {participantAuthMethod === "required"
                      ? "参加に必須とする認証方法を複数選択できます。"
                      : "匿名参加後に結果を保存するために利用できる認証方法を選択します。"}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { key: "email", name: "メールアドレス認証" },
                      { key: "google", name: "Google認証" },
                      { key: "line", name: "LINE認証" },
                      { key: "sms", name: "電話番号認証" },
                    ].map((provider) => (
                      <label
                        key={provider.key}
                        className="flex items-center p-3 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={
                            !!authProviders[provider.key as keyof AuthProviders]
                          }
                          onChange={() =>
                            handleAuthProviderChange(
                              provider.key as keyof AuthProviders,
                            )
                          }
                          className="h-4 w-4 text-slate-800 border-slate-300 rounded focus:ring-slate-500"
                        />
                        <span className="ml-3 text-sm font-medium text-slate-700">
                          {provider.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {activeMenu === "ルール設定" && (
              <div className="space-y-8">
                <div className="space-y-6 p-4 border border-slate-200 rounded-lg">
                  <h4 className="text-lg font-semibold text-slate-800">
                    参加条件
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                      <label
                        htmlFor="participationLimitPerUser"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        一人あたりの抽選参加回数
                      </label>
                      <input
                        type="number"
                        id="participationLimitPerUser"
                        value={participationLimitPerUser}
                        onChange={(e) =>
                          setParticipationLimitPerUser(
                            e.target.value === "" ? "" : Number(e.target.value),
                          )
                        }
                        min="0"
                        step="1"
                        placeholder="0"
                        className={inputClass}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        0 または空欄で無制限。1
                        であれば同じユーザーは一度しか抽選できません。
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        参加間隔制限
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          id="participationIntervalHours"
                          value={participationIntervalHours}
                          onChange={(e) =>
                            setParticipationIntervalHours(
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value),
                            )
                          }
                          min="0"
                          step="1"
                          placeholder="0"
                          className={inputClass}
                          aria-label="参加間隔の時間"
                        />
                        <span className="text-sm text-slate-600">時間</span>
                        <input
                          type="number"
                          id="participationIntervalMinutes"
                          value={participationIntervalMinutes}
                          onChange={(e) =>
                            setParticipationIntervalMinutes(
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value),
                            )
                          }
                          min="0"
                          max="59"
                          step="1"
                          placeholder="0"
                          className={inputClass}
                          aria-label="参加間隔の分"
                        />
                        <span className="text-sm text-slate-600">分</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        前回の参加から次に参加できるまでの時間。0時間0分で制限なし。
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-4 mt-4 space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={requireTicket}
                        onChange={(e) => setRequireTicket(e.target.checked)}
                        className="h-5 w-5 text-slate-800 border-slate-300 rounded focus:ring-slate-500"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        参加券（QRコード）を必須にする
                      </span>
                    </label>
                    {requireTicket && (
                      <div className="pl-8 space-y-4 animate-fade-in">
                        <p className="text-xs text-slate-500">
                          参加者は、ここで発行する参加券（QRコード）を使ってキャンペーンに参加します。
                          <br />
                          券ごとに異なる参加回数を設定したり、管理用のラベルを付けることができます（例：「渋谷店用」「Webサイト用」など）。
                        </p>
                        <div className="space-y-4">
                          {participationTickets.map((ticket, index) => {
                            const url = `${window.location.href.split("#")[0]}#/ticket/${campaignId}?token=${ticket.token}`;
                            return (
                              <div
                                key={ticket.id}
                                className="p-3 border rounded-lg bg-slate-50 relative"
                              >
                                <div className="flex flex-col sm:flex-row gap-4">
                                  <div className="flex-1 space-y-2">
                                    <div className="grid grid-cols-2 gap-x-4">
                                      <div>
                                        <label
                                          htmlFor={`ticket-label-${index}`}
                                          className="text-xs font-medium text-slate-600"
                                        >
                                          ラベル（管理用）
                                        </label>
                                        <input
                                          type="text"
                                          id={`ticket-label-${index}`}
                                          value={ticket.label}
                                          onChange={(e) =>
                                            handleTicketChange(
                                              index,
                                              "label",
                                              e.target.value,
                                            )
                                          }
                                          className={`${inputClass} text-sm`}
                                          placeholder="例: 渋谷店用"
                                        />
                                      </div>
                                      <div>
                                        <label
                                          htmlFor={`ticket-chances-${index}`}
                                          className="text-xs font-medium text-slate-600"
                                        >
                                          付与回数
                                        </label>
                                        <input
                                          type="number"
                                          id={`ticket-chances-${index}`}
                                          value={ticket.chancesToGrant ?? ""}
                                          onChange={(e) =>
                                            handleTicketChange(
                                              index,
                                              "chancesToGrant",
                                              e.target.value,
                                            )
                                          }
                                          className={`${inputClass} text-sm`}
                                          min="0"
                                          step="1"
                                          placeholder={String(
                                            Number(participationLimitPerUser) >
                                              0
                                              ? Number(
                                                  participationLimitPerUser,
                                                )
                                              : 1,
                                          )}
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-xs font-medium text-slate-600">
                                        参加券URL
                                      </label>
                                      <div className="flex gap-1">
                                        <input
                                          type="text"
                                          readOnly
                                          value={url}
                                          className="w-full text-xs px-2 py-1.5 bg-slate-100 border rounded-md"
                                        />
                                        <button
                                          onClick={() => handleCopyUrl(url)}
                                          className="p-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-100 flex-shrink-0"
                                        >
                                          <CopyIcon className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex-shrink-0">
                                    <label className="text-xs font-medium text-slate-600 block text-center">
                                      QRコード
                                    </label>
                                    <img
                                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(url)}`}
                                      alt="QR Code"
                                      className="border p-1 bg-white rounded-md mx-auto"
                                    />
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleRemoveTicket(index)}
                                  className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500 rounded-full"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        <div>
                          <button
                            onClick={handleAddTicket}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 text-sm"
                          >
                            <PlusIcon className="w-4 h-4" /> 新しい参加券を追加
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="border-t pt-4 mt-4 space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={requireFormApproval}
                        onChange={(e) =>
                          setRequireFormApproval(e.target.checked)
                        }
                        className="h-5 w-5 text-slate-800 border-slate-300 rounded focus:ring-slate-500"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        フォーム申請と管理者承認を必須にする
                      </span>
                    </label>
                    {requireFormApproval && (
                      <div className="pl-8 space-y-4 animate-fade-in">
                        <div>
                          <label
                            htmlFor="approvalFormTitle"
                            className="block text-sm font-medium text-slate-700 mb-1"
                          >
                            フォームタイトル
                          </label>
                          <input
                            type="text"
                            id="approvalFormTitle"
                            value={approvalFormTitle}
                            onChange={(e) =>
                              setApprovalFormTitle(e.target.value)
                            }
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="approvalFormDesc"
                            className="block text-sm font-medium text-slate-700 mb-1"
                          >
                            フォーム説明文
                          </label>
                          <textarea
                            id="approvalFormDesc"
                            value={approvalFormDescription}
                            onChange={(e) =>
                              setApprovalFormDescription(e.target.value)
                            }
                            rows={3}
                            className={textareaClass}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="approvalFormSuccess"
                            className="block text-sm font-medium text-slate-700 mb-1"
                          >
                            送信完了メッセージ
                          </label>
                          <textarea
                            id="approvalFormSuccess"
                            value={approvalFormSuccessMessage}
                            onChange={(e) =>
                              setApprovalFormSuccessMessage(e.target.value)
                            }
                            rows={3}
                            className={textareaClass}
                          />
                        </div>
                        <div>
                          <h5 className="block text-sm font-medium text-slate-700 mb-2">
                            フォーム項目
                          </h5>
                          <div className="space-y-2">
                            {approvalFormFields.map((field, index) => (
                              <div
                                key={field.id}
                                className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 p-2 rounded-md bg-slate-50 border"
                              >
                                <input
                                  type="text"
                                  value={field.label}
                                  onChange={(e) =>
                                    handleApprovalFormFieldChange(
                                      index,
                                      "label",
                                      e.target.value,
                                    )
                                  }
                                  className="text-sm px-2 py-1 border border-slate-300 rounded-md"
                                  placeholder="項目ラベル"
                                />
                                <select
                                  value={field.type}
                                  onChange={(e) =>
                                    handleApprovalFormFieldChange(
                                      index,
                                      "type",
                                      e.target
                                        .value as ApprovalFormField["type"],
                                    )
                                  }
                                  className="text-sm bg-white border border-slate-300 rounded-md"
                                >
                                  <option value="text">一行テキスト</option>
                                  <option value="email">メール</option>
                                  <option value="textarea">複数行</option>
                                  <option value="file">画像添付</option>
                                </select>
                                <div className="flex items-center gap-4">
                                  <label className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <input
                                      type="checkbox"
                                      checked={field.required}
                                      onChange={(e) =>
                                        handleApprovalFormFieldChange(
                                          index,
                                          "required",
                                          e.target.checked,
                                        )
                                      }
                                      className="h-4 w-4"
                                    />
                                    必須
                                  </label>
                                  <button
                                    onClick={() =>
                                      handleRemoveApprovalFormField(index)
                                    }
                                    className="p-1 text-slate-400 hover:text-red-500"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={handleAddApprovalFormField}
                            className="mt-2 text-sm inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md"
                          >
                            <PlusIcon className="w-4 h-4" />
                            項目追加
                          </button>
                        </div>
                        <p className="text-xs text-slate-500">
                          承認管理は「申請管理」タブから行います。
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t mt-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      景品切れの場合の動作
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="outOfStockBehavior"
                          value="show_loss"
                          checked={outOfStockBehavior === "show_loss"}
                          onChange={() => setOutOfStockBehavior("show_loss")}
                          className="h-4 w-4 text-slate-800 border-slate-300 focus:ring-slate-500"
                        />
                        <span className="text-sm text-slate-600">
                          すべての景品の在庫がなくなったら、ハズレとして表示する
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="outOfStockBehavior"
                          value="prevent_participation"
                          checked={
                            outOfStockBehavior === "prevent_participation"
                          }
                          onChange={() =>
                            setOutOfStockBehavior("prevent_participation")
                          }
                          className="h-4 w-4 text-slate-800 border-slate-300 focus:ring-slate-500"
                        />
                        <span className="text-sm text-slate-600">
                          すべての景品の在庫がなくなったら、参加できないようにする
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
                <div className="p-4 border border-slate-200 rounded-lg">
                  <label
                    className={`flex items-center gap-3 ${hasZeroProbabilityPrize ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      checked={preventDuplicatePrizes}
                      onChange={(e) =>
                        setPreventDuplicatePrizes(e.target.checked)
                      }
                      disabled={hasZeroProbabilityPrize}
                      className="h-5 w-5 text-slate-800 border-slate-300 rounded focus:ring-slate-500 disabled:bg-slate-200"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      同じ特典の重複当選を許可しない
                    </span>
                  </label>
                  <p className="text-xs text-slate-500 mt-1 pl-8">
                    有効にすると、同じユーザーは各景品に一度しか当選しなくなります。すべての景品に当選した後は、ハズレまたは参加賞が当たります。
                  </p>
                  {hasZeroProbabilityPrize && (
                    <p className="text-xs text-amber-700 mt-2 pl-8">
                      注意：いずれかの景品の配分率が0%以下に設定されているため、このオプションは無効です。
                    </p>
                  )}
                </div>
                <div className="space-y-4 p-4 border border-slate-200 rounded-lg">
                  <h4 className="text-lg font-semibold text-slate-800">
                    抽選アルゴリズム
                  </h4>
                  <p className="text-sm text-slate-500 mb-4">
                    二段階の抽選方式です。まず「全体の当選確率」で当たり/ハズレを判定し、当たった場合にのみ、各景品の配分率に基づいて賞品が決まります。
                  </p>
                  <div className="max-w-xs">
                    <label
                      htmlFor="overallWinProbability"
                      className="block text-sm font-medium text-slate-700 mb-1"
                    >
                      全体の当選確率 (%)
                    </label>
                    <input
                      type="number"
                      id="overallWinProbability"
                      value={overallWinProbability}
                      onChange={(e) =>
                        setOverallWinProbability(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="例: 50"
                      className={inputClass}
                    />
                  </div>
                  <div className="border-t border-slate-200 mt-6 pt-6 space-y-4">
                    <h4 className="text-lg font-semibold text-slate-800">
                      当選者への景品配分
                    </h4>
                    <p className="text-sm text-slate-500">
                      当選者に対し、どの景品がどのくらいの割合で当たるかを設定します。景品は「景品」タブで追加・編集できます。
                    </p>
                    <div
                      className={`p-3 rounded-lg text-sm font-medium transition-colors ${totalPrizeAllocation.toFixed(1) === "100.0" ? "bg-green-100 text-green-800" : parseFloat(totalPrizeAllocation.toFixed(1)) > 100 ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}
                    >
                      合計配分率: {totalPrizeAllocation.toFixed(1)}%
                      {totalPrizeAllocation.toFixed(1) !== "100.0" && (
                        <span className="ml-2 font-normal">
                          （合計が100%になるように設定してください）
                        </span>
                      )}
                    </div>
                    <div className="mt-4 space-y-3">
                      {prizes.length > 0 ? (
                        prizes.map((prize, index) => (
                          <div
                            key={prize.id}
                            className="flex items-center justify-between gap-4 p-2 rounded-md hover:bg-slate-50"
                          >
                            <span
                              className="text-sm font-medium text-slate-700 flex-1 truncate"
                              title={prize.title}
                            >
                              {prize.title || "(無題の景品)"}
                            </span>
                            <div className="w-40 flex-shrink-0">
                              <label
                                htmlFor={`rule-prize-probability-${index}`}
                                className="sr-only"
                              >
                                {prize.title} 当選配分率 (%)
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  id={`rule-prize-probability-${index}`}
                                  value={prize.probability ?? ""}
                                  onChange={(e) =>
                                    handlePrizeChange(
                                      index,
                                      "probability",
                                      e.target.value,
                                    )
                                  }
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  placeholder="例: 10.5"
                                  className={`${inputClass} text-right pr-8`}
                                  aria-describedby={`rule-prize-probability-unit-${index}`}
                                />
                                <span
                                  id={`rule-prize-probability-unit-${index}`}
                                  className="absolute inset-y-0 right-3 flex items-center text-sm text-slate-500 pointer-events-none"
                                >
                                  %
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 border-2 border-dashed border-slate-200 rounded-md">
                          <p className="text-sm text-slate-500">
                            景品がありません。
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            「景品」タブから追加してください。
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeMenu === "景品" && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 p-3 bg-slate-50 border rounded-md">
                  <input
                    type="checkbox"
                    id="showPrizeCountsOnPublicPage"
                    checked={showPrizeCountsOnPublicPage}
                    onChange={(e) =>
                      setShowPrizeCountsOnPublicPage(e.target.checked)
                    }
                    className="h-4 w-4 text-slate-800 border-slate-300 rounded focus:ring-slate-500"
                  />
                  <label
                    htmlFor="showPrizeCountsOnPublicPage"
                    className="text-sm font-medium text-slate-700"
                  >
                    キャンペーンページに各景品の在庫数と当選数を表示する
                  </label>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-slate-800 mb-3">
                    当選景品
                  </h4>
                  <div className="space-y-4">
                    {prizes.map((prize, index) => (
                      <div key={prize.id}>
                        {renderPrizeForm(
                          prize,
                          (field, value) =>
                            handlePrizeChange(index, field, value),
                          () => handleRemovePrize(index),
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={handleAddPrize}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 text-sm font-medium"
                    >
                      <PlusIcon />
                      当選景品を追加
                    </button>
                  </div>
                </div>

                <div className="mt-8 border-t pt-6">
                  <h4 className="text-lg font-semibold text-slate-800 mb-3">
                    ハズレ賞（参加賞）
                  </h4>
                  <p className="text-sm text-slate-500 mb-4">
                    抽選にハズレた参加者に渡す景品です。設定は任意です。在庫管理も可能です。
                  </p>
                  {consolationPrize ? (
                    renderPrizeForm(
                      consolationPrize,
                      handleConsolationPrizeChange,
                      handleRemoveConsolationPrize,
                    )
                  ) : (
                    <button
                      onClick={handleAddConsolationPrize}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 text-sm font-medium"
                    >
                      <PlusIcon />
                      ハズレ賞を追加
                    </button>
                  )}
                </div>
              </div>
            )}
            {activeMenu === "アンケート" && (
              <div className="space-y-6">
                <h4 className="text-lg font-semibold text-slate-800">
                  アンケートフォーム設定
                </h4>
                <p className="text-sm text-slate-500">
                  ここで設定したフォームは、参加者がキャンペーン規約に同意する前のポップアップに表示されます。
                </p>
                <div className="space-y-4">
                  {questionnaireFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="relative p-4 border border-slate-200 rounded-lg space-y-4 bg-slate-50/50"
                    >
                      <button
                        onClick={() => handleRemoveQuestionnaireField(index)}
                        className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        aria-label="質問を削除"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor={`q-question-${index}`}
                            className="block text-sm font-medium text-slate-700 mb-1"
                          >
                            質問文
                          </label>
                          <input
                            type="text"
                            id={`q-question-${index}`}
                            value={field.question}
                            onChange={(e) =>
                              handleQuestionnaireFieldChange(
                                index,
                                "question",
                                e.target.value,
                              )
                            }
                            placeholder="例: このキャンペーンをどこで知りましたか？"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`q-type-${index}`}
                            className="block text-sm font-medium text-slate-700 mb-1"
                          >
                            回答形式
                          </label>
                          <select
                            id={`q-type-${index}`}
                            value={field.type}
                            onChange={(e) =>
                              handleQuestionnaireFieldChange(
                                index,
                                "type",
                                e.target.value as QuestionnaireFieldType,
                              )
                            }
                            className={inputClass}
                          >
                            <option value="text">一行テキスト</option>
                            <option value="textarea">複数行テキスト</option>
                            <option value="radio">
                              単一選択 (ラジオボタン)
                            </option>
                            <option value="checkbox">
                              複数選択 (チェックボックス)
                            </option>
                            <option value="select">ドロップダウン</option>
                          </select>
                        </div>
                      </div>

                      {["radio", "checkbox", "select"].includes(field.type) && (
                        <div>
                          <label
                            htmlFor={`q-options-${index}`}
                            className="block text-sm font-medium text-slate-700 mb-1"
                          >
                            選択肢 (1行に1つ)
                          </label>
                          <textarea
                            id={`q-options-${index}`}
                            value={(field.options || []).join("\n")}
                            onChange={(e) =>
                              handleQuestionnaireFieldChange(
                                index,
                                "optionsString",
                                e.target.value,
                              )
                            }
                            rows={4}
                            placeholder="Twitter&#10;Instagram&#10;友人から"
                            className={textareaClass}
                          ></textarea>
                        </div>
                      )}

                      <div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) =>
                              handleQuestionnaireFieldChange(
                                index,
                                "required",
                                e.target.checked,
                              )
                            }
                            className="h-4 w-4 text-slate-800 border-slate-300 rounded focus:ring-slate-500"
                          />
                          <span className="text-sm font-medium text-slate-700">
                            必須回答にする
                          </span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <button
                    onClick={handleAddQuestionnaireField}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 text-sm font-medium"
                  >
                    <PlusIcon />
                    質問を追加
                  </button>
                </div>
              </div>
            )}
            {activeMenu === "お問い合わせ" && (
              <div className="space-y-6">
                <div>
                  <label className="flex items-center gap-3 cursor-pointer p-3 border rounded-md hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={contactEnabled}
                      onChange={(e) => setContactEnabled(e.target.checked)}
                      className="h-5 w-5 text-slate-800 border-slate-300 rounded focus:ring-slate-500"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      キャンペーンページにお問い合わせフォームを設置する
                    </span>
                  </label>
                </div>

                {contactEnabled && (
                  <div className="space-y-6 border-t border-slate-200 pt-6 animate-fade-in">
                    <div>
                      <label
                        htmlFor="contactFormTitle"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        フォームのタイトル
                      </label>
                      <input
                        type="text"
                        id="contactFormTitle"
                        value={contactFormTitle}
                        onChange={(e) => setContactFormTitle(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="contactFormDescription"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        フォームの説明文
                      </label>
                      <textarea
                        id="contactFormDescription"
                        value={contactFormDescription}
                        onChange={(e) =>
                          setContactFormDescription(e.target.value)
                        }
                        rows={3}
                        className={textareaClass}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="contactSuccessMessage"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        送信完了メッセージ
                      </label>
                      <textarea
                        id="contactSuccessMessage"
                        value={contactSuccessMessage}
                        onChange={(e) =>
                          setContactSuccessMessage(e.target.value)
                        }
                        rows={3}
                        className={textareaClass}
                      />
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-slate-800">
                        フォーム項目設定
                      </h4>
                      <div className="space-y-2 rounded-md border border-slate-200 p-3 bg-slate-50/50">
                        {contactFields.map((field, index) => (
                          <div
                            key={field.id}
                            className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-2 p-2 rounded-md hover:bg-slate-100"
                          >
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) =>
                                handleContactFieldChange(
                                  index,
                                  "label",
                                  e.target.value,
                                )
                              }
                              className="text-sm px-2 py-1 border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                              aria-label={`${field.id} field label`}
                            />
                            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) =>
                                  handleContactFieldChange(
                                    index,
                                    "required",
                                    e.target.checked,
                                  )
                                }
                                disabled={!field.enabled}
                                className="h-4 w-4 text-slate-800 border-slate-300 rounded focus:ring-slate-500 disabled:opacity-50"
                              />
                              必須
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.enabled}
                                onChange={(e) =>
                                  handleContactFieldChange(
                                    index,
                                    "enabled",
                                    e.target.checked,
                                  )
                                }
                                className="h-4 w-4 text-slate-800 border-slate-300 rounded focus:ring-slate-500"
                              />
                              有効
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="border-t pt-6 mt-6">
                      <label
                        htmlFor="contactNotificationEmail"
                        className="block text-lg font-semibold text-slate-800 mb-1"
                      >
                        通知先メールアドレス
                      </label>
                      <p className="text-sm text-slate-500 mb-2">
                        お問い合わせがあった際に通知を受け取るメールアドレスです。この設定を有効にするには、別途Firebase
                        Cloud Functionsの設定が必要です。
                      </p>
                      <input
                        type="email"
                        id="contactNotificationEmail"
                        value={contactNotificationEmail}
                        onChange={(e) =>
                          setContactNotificationEmail(e.target.value)
                        }
                        className={inputClass}
                        placeholder="admin@example.com"
                      />
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <h4 className="text-md font-semibold text-slate-800">
                        お問い合わせの確認方法
                      </h4>
                      <p className="text-sm text-slate-600 mt-2">
                        送信されたお問い合わせは「ダッシュボード」タブに表示されます。また、メール通知を設定することも可能です。
                      </p>
                    </div>
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex justify-between items-center">
                        <h4 className="text-md font-semibold text-yellow-800">
                          メール通知機能の実装方法
                        </h4>
                        <button
                          onClick={() => setShowFunctionCode(!showFunctionCode)}
                          className="text-sm text-yellow-700 font-medium hover:underline"
                        >
                          {showFunctionCode ? "閉じる" : "設定方法を表示"}
                        </button>
                      </div>
                      {showFunctionCode && (
                        <div className="mt-4 pt-4 border-t border-yellow-200 text-left animate-fade-in">
                          <p className="text-sm text-yellow-900 mb-2">
                            上記で通知先メールアドレスを設定した場合、以下のCloud
                            FunctionをFirebaseプロジェクトにデプロイすることで、お問い合わせ時にメールが送信されるようになります。
                          </p>
                          <h5 className="font-bold text-sm mt-4 mb-2">
                            1. Cloud Functions の準備
                          </h5>
                          <pre className="text-xs bg-white p-2 rounded-md overflow-x-auto">
                            <code>
                              {`# Firebase Toolsをインストール\nnpm install -g firebase-tools\n\n# Firebaseプロジェクトにログイン\nfirebase login\n\n# プロジェクトディレクトリでFunctionsを初期化\nfirebase init functions`}
                            </code>
                          </pre>
                          <h5 className="font-bold text-sm mt-4 mb-2">
                            2. 必要なライブラリのインストール
                          </h5>
                          <pre className="text-xs bg-white p-2 rounded-md overflow-x-auto">
                            <code>
                              {`cd functions\nnpm install nodemailer`}
                            </code>
                          </pre>
                          <h5 className="font-bold text-sm mt-4 mb-2">
                            3. 送信元メールアドレスの設定 (Gmailの場合)
                          </h5>
                          <p className="text-xs text-yellow-900 mb-2">
                            Gmailを使用する場合、Googleアカウントで「アプリパスワード」を生成して使用することを推奨します。
                          </p>
                          <pre className="text-xs bg-white p-2 rounded-md overflow-x-auto">
                            <code>
                              {`firebase functions:config:set gmail.email="your-email@gmail.com" gmail.password="your-16-digit-app-password"`}
                            </code>
                          </pre>
                          <h5 className="font-bold text-sm mt-4 mb-2">
                            4. コードの実装
                          </h5>
                          <p className="text-xs text-yellow-900 mb-2">
                            <code className="bg-white p-1 rounded">
                              functions/index.js
                            </code>{" "}
                            に以下のコードを貼り付けます。
                          </p>
                          <pre className="text-xs bg-white p-3 rounded-md overflow-x-auto">
                            <code>
                              {`const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

const mailTransport = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: functions.config().gmail.email,
    pass: functions.config().gmail.password,
  },
});

exports.sendInquiryEmail = functions.firestore
  .document("inquiries/{inquiryId}")
  .onCreate(async (snap) => {
    const inquiryData = snap.data();
    const campaignId = inquiryData.campaignId;

    try {
      const campaignDoc = await admin
        .firestore()
        .collection("campaigns")
        .doc(campaignId)
        .get();
      
      if (!campaignDoc.exists) {
        console.log(\`Campaign \${campaignId} not found.\`);
        return null;
      }

      const campaignData = campaignDoc.data();
      const notificationEmail = campaignData.contactNotificationEmail;

      if (!notificationEmail) {
        console.log(\`Notification email not set for campaign \${campaignId}.\`);
        return null;
      }
      
      const formDataText = Object.entries(inquiryData.formData)
        .map(([key, value]) => \`\${campaignData.contactFields?.find(f => f.id === key)?.label || key}: \${value}\`)
        .join("\\n");

      const mailOptions = {
        from: \`"\${campaignData.name}" <\${functions.config().gmail.email}>\`,
        to: notificationEmail,
        subject: \`[\${campaignData.name}] 新しいお問い合わせがありました\`,
        text: \`キャンペーン「\${campaignData.name}」に新しいお問い合わせがありました。\\n\\n--- お問い合わせ内容 ---\\n\${formDataText}\\n\\n--- ユーザー情報 ---\\nユーザーID: \${inquiryData.userId || 'N/A'}\\n認証情報: \${inquiryData.authInfo?.identifier || 'N/A'}\\n\`,
      };

      await mailTransport.sendMail(mailOptions);
      console.log(\`Inquiry email sent to \${notificationEmail}\`);
      return null;
    } catch (error) {
      console.error("There was an error while sending the email:", error);
      return null;
    }
  });`}
                            </code>
                          </pre>
                          <h5 className="font-bold text-sm mt-4 mb-2">
                            5. デプロイ
                          </h5>
                          <pre className="text-xs bg-white p-2 rounded-md overflow-x-auto">
                            <code>{`firebase deploy --only functions`}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignEdit;

