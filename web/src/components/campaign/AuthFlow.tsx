import React, { useState, useRef, useEffect } from "react";
import { firebase, auth, googleProvider } from "../../firebase";
import type { Campaign, AuthProviders } from "../../types";
import Spinner from "../Spinner";
import { captureException } from "@sentry/react";
import { setCampaignAuth, storeCampaignIdForAuth } from "../../utils/campaignAuth";
// import { useParticipationTicket } from "../../pages/hooks/useParticipationTicket";

interface AuthFlowProps {
  campaign: Campaign;
  isSavingResult?: boolean;
  closeModal?: () => void;
  lastTicketToken?: string | null;
  setModalStep?: (step: "closed" | "auth" | "confirm" | "participating" | "result") => void;
}

const providerDetails = {
  google: { name: "Google", bg: "bg-red-500", hover: "hover:bg-red-600" },
  line: { name: "LINE", bg: "bg-green-500", hover: "hover:bg-green-600" },
  email: {
    name: "メールアドレス",
    bg: "bg-slate-500",
    hover: "hover:bg-slate-600",
  },
  sms: { name: "電話番号", bg: "bg-blue-500", hover: "hover:bg-blue-600" },
} as const;

// Enforce a deterministic provider order
const PROVIDER_ORDER: Array<keyof typeof providerDetails> = [
  "google",
  "line",
  "email",
  "sms",
];

const enabledProviders = (authProviders: AuthProviders | undefined) => {
  const enabledSet = new Set(
  Object.entries(authProviders || {})
      .filter(([_, v]) => Boolean(v))
      .map(([k]) => k as keyof AuthProviders),
  );
  return PROVIDER_ORDER.filter((key) => enabledSet.has(key as keyof AuthProviders));
};

const AuthFlow: React.FC<AuthFlowProps> = ({
  campaign,
  isSavingResult = false,
  closeModal,
  setModalStep,
  // lastTicketToken,
}) => {
  const [authView, setAuthView] = useState<
    "select" | "email_entry" | "email_sent" | "sms_phone" | "sms_code"
  >("select");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [emailForLink, setEmailForLink] = useState("");
  const [smsNumber, setSmsNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmationResult, setConfirmationResult] =
    useState<firebase.auth.ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<firebase.auth.RecaptchaVerifier | null>(
    null,
  );
  // const recaptchaWidgetId = useRef<number | null>(null);
  // const { claimTicket } = useParticipationTicket();

  useEffect(() => {
    if (authView === "sms_phone") {
      if (recaptchaVerifierRef.current) recaptchaVerifierRef.current.clear();
      try {
        recaptchaVerifierRef.current = new firebase.auth.RecaptchaVerifier(
          "recaptcha-container",
          {
            "size": "invisible",
            "callback": () => {},
          },
        );
        recaptchaVerifierRef.current.render().catch((err: any) => {
          captureException(err, { level: "error" });
        });
      } catch (e) {
        captureException(e, { level: "error" });
      }
    }
  }, [authView]);

  const handleSocialSignIn = async (provider: firebase.auth.AuthProvider) => {
    setAuthError(null);
    setIsAuthLoading(true);
    try {
      // Store campaign ID before authentication so we can mark it as authenticated after callback
      if (campaign.id) {
        storeCampaignIdForAuth(campaign.id);
        console.log("Stored campaign ID for auth:", campaign.id);
      }

      const currentUser = auth.currentUser;
      console.log("Current user before auth:", currentUser?.uid, currentUser?.isAnonymous);
      
      // If there's an anonymous user, we need to sign out first before authenticating
      // Otherwise, Firebase might not complete the authentication properly
      if (currentUser && currentUser.isAnonymous) {
        console.log("Signing out anonymous user before auth");
        await auth.signOut();
      }

      // Use popup for both localhost and production - more reliable and better UX
      console.log("Using popup sign-in with provider:", provider.providerId);
      const result = await auth.signInWithPopup(provider);
      console.log("Popup sign-in successful:", result.user?.uid, result.user?.email);

      // Mark campaign as authenticated after successful popup sign-in
      if (campaign.id && result.user && !result.user.isAnonymous) {
        setCampaignAuth(campaign.id);
        console.log("Campaign auth set for:", campaign.id);
        window.localStorage.removeItem("pendingCampaignAuth");
        setModalStep?.("confirm");
      closeModal?.();
      }
      setIsAuthLoading(false);
    } catch (error: any) {
      console.error("Sign-in error:", error);
      console.error("Error code:", error.code, "Error message:", error.message);
      setIsAuthLoading(false);
      
      if (
        error.code === "auth/popup-closed-by-user" ||
        error.code === "auth/cancelled-popup-request"
      ) {
        // User cancelled - this is not an error, just clear the stored campaign ID
        if (campaign.id) {
          window.localStorage.removeItem("pendingCampaignAuth");
        }
      } else {
        setAuthError("認証に失敗しました。");
        // Clear stored campaign ID on error
        if (campaign.id) {
          window.localStorage.removeItem("pendingCampaignAuth");
        }
        captureException(error, { level: "error" });
      }
    }
  };

  const handleGoogleSignIn = async () => {
    handleSocialSignIn(googleProvider);
  };

  const handleLineSignIn = async () => {
    try {
      setAuthError(null);
      setIsAuthLoading(true);
      
      // Store the current URL to redirect back after authentication
      const currentUrl = window.location.href;
      window.localStorage.setItem("lineReturnUrl", currentUrl);

      // Store campaign ID for authentication association
      if (campaign.id) {
        storeCampaignIdForAuth(campaign.id);
        console.log("Stored campaign ID for LINE auth:", campaign.id);
      }

      // Use a fixed callback URL (must be registered in LINE Developers console)
      // This must match EXACTLY what's registered in LINE Developers Console
      const redirectUri = `${window.location.origin}/auth/line/callback`;
      
      // LINE Channel ID - must match the channel ID in LINE Developers Console
    const clientId = "2008069638";
      
      console.log("LINE Login Configuration:", {
        clientId,
        redirectUri,
        origin: window.location.origin,
        currentUrl: window.location.href,
      });
      
      // Generate state for CSRF protection
      const state = Math.random().toString(36).substring(2, 15) + 
                    Math.random().toString(36).substring(2, 15);
      
      // Build LINE authorization URL
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        state: state,
        scope: "profile openid",
        prompt: "consent",
        bot_prompt: "aggressive",
      });
      
      const lineAuthorizeUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
      
      console.log("Redirecting to LINE authorization:", lineAuthorizeUrl);

      // Store state for verification
    window.localStorage.setItem("lineOAuthState", state);
      
      // Redirect to LINE authorization
    window.location.href = lineAuthorizeUrl;
    } catch (error: any) {
      console.error("LINE login error:", error);
      setAuthError("LINEログインの開始に失敗しました。");
      setIsAuthLoading(false);
      captureException(error, { level: "error" });
    }
  };

  const handleSendEmailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthLoading(true);
    
    // Configure action code settings for email link
    // The URL must be in the authorized domains list in Firebase Console
    // For localhost, use the full URL with the campaign path
    // For production, use the production URL
    let continueUrl = window.location.href;
    
    // Ensure the URL doesn't have query parameters that might interfere
    try {
      const url = new URL(continueUrl);
      // Remove any existing query params that might interfere with the email link
      url.search = '';
      continueUrl = url.toString();
    } catch (e) {
      // If URL parsing fails, use the original href
      console.warn("Failed to parse URL for email link:", e);
    }
    
    const actionCodeSettings = {
      url: continueUrl,
      handleCodeInApp: true,
      // Optional: Set dynamic link domain if using Firebase Dynamic Links
      // dynamicLinkDomain: 'your-app.page.link',
    };
    
    console.log("Sending email link to:", emailForLink);
    console.log("Action code settings:", actionCodeSettings);
    
    try {
      // Store campaign ID for authentication association
      if (campaign.id) {
        storeCampaignIdForAuth(campaign.id);
        console.log("Stored campaign ID for email auth:", campaign.id);
      }
      
      await auth.sendSignInLinkToEmail(emailForLink, actionCodeSettings);
      console.log("Email link sent successfully");
      
      window.localStorage.setItem("emailForSignIn", emailForLink);
      setAuthView("email_sent");
    } catch (error: any) {
      console.error("Email link send error:", error);
      console.error("Error code:", error.code, "Error message:", error.message);
      
      // Provide more specific error messages
      let errorMessage = "ログインリンクの送信に失敗しました。";
      if (error.code === "auth/invalid-email") {
        errorMessage = "無効なメールアドレスです。";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "リクエストが多すぎます。しばらく待ってから再度お試しください。";
      } else if (error.message) {
        errorMessage += " " + error.message;
      }
      
      setAuthError(errorMessage);
      captureException(error, { level: "error" });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSendSmsCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthLoading(true);
    try {
      if (!recaptchaVerifierRef.current) {
        throw new Error("reCAPTCHAの初期化に失敗しました。");
      }

      const plainNumber = smsNumber.replace(/[^0-9]/g, "");
      if (plainNumber.length < 10) {
        throw new Error("電話番号の形式が正しくありません。");
      }
      const phoneNumber = `+81${plainNumber.slice(-10)}`;
      const confirmation = await auth.signInWithPhoneNumber(
        phoneNumber,
        recaptchaVerifierRef.current,
      );
      setConfirmationResult(confirmation);
      setAuthView("sms_code");
    } catch (error: any) {
      setAuthError(
        "確認コードの送信に失敗しました。電話番号を確認してください。",
      );
      captureException(error, { level: "error" });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleVerifySmsCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    setAuthError(null);
    setIsAuthLoading(true);
    try {
      const userCredential = await confirmationResult.confirm(verificationCode);
      // Mark campaign as authenticated after successful SMS verification
      if (campaign.id && userCredential.user && !userCredential.user.isAnonymous) {
        setCampaignAuth(campaign.id);
        // Close modal and proceed to next step after successful authentication
        closeModal?.();
        setModalStep?.("confirm");
      }
    } catch (error) {
      setAuthError("認証コードが正しくありません。");
      setIsAuthLoading(false);
      captureException(error, { level: "error" });
    }
  };

  const providers = enabledProviders(campaign.authProviders);
  const modalTitle = "ユーザー認証";
  const modalDescription = isSavingResult
    ? "抽選結果を保存するために、ユーザー認証をお勧めします。\n認証すると、結果がアカウントに保存され、いつでも確認できます。"
    : "認証方法を選択してください。";

  return (
    <div>
      <div
        id="recaptcha-container"
        style={{ position: "absolute", top: "-100px", left: 0 }}
      ></div>
      <h2 className="text-xl font-bold text-slate-800 mb-4 text-center">
        {modalTitle}
      </h2>

      {authView === "select" && (
        <div className="space-y-4 animate-fade-in">
          <p className="text-slate-600 mb-2 text-center text-sm whitespace-pre-wrap">
            {modalDescription}
          </p>
          {providers.length > 0 ? (
            <div className="space-y-3">
              {providers.map((providerKey) => {
                const details = providerDetails[providerKey];
                if (!details) return null;

                let action = () => {};
                if (providerKey === "google") action = handleGoogleSignIn;
                else if (providerKey === "email")
                  action = () => setAuthView("email_entry");
                else if (providerKey === "sms")
                  action = () => setAuthView("sms_phone");
                else if (providerKey === "line") action = handleLineSignIn;

                return (
                  <button
                    key={providerKey}
                    onClick={action}
                    className={`w-full ${details.bg} text-white font-bold py-3 px-6 rounded-lg ${details.hover} transition-all duration-300 ease-in-out shadow-md hover:shadow-lg transform hover:-translate-y-px`}
                  >
                    {details.name}で認証
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-sm text-red-500">
              参加可能な認証方法が設定されていません。
            </p>
          )}
          {authError && (
            <p className="text-sm text-red-600 mt-4 text-center">{authError}</p>
          )}
        </div>
      )}

      {authView === "email_entry" && (
        <div className="animate-fade-in">
          <form onSubmit={handleSendEmailLink} className="space-y-4">
            <p className="text-sm text-slate-600 text-center">
              入力されたメールアドレスに認証用の特別なリンクを送信します。
            </p>
            <input
              type="email"
              value={emailForLink}
              onChange={(e) => setEmailForLink(e.target.value)}
              placeholder="メールアドレス"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
            {authError && (
              <p className="text-sm text-red-600 text-center">{authError}</p>
            )}
            <button
              type="submit"
              disabled={isAuthLoading}
              className="w-full bg-slate-500 text-white font-bold py-3 rounded-lg hover:bg-slate-600 disabled:opacity-50 flex justify-center items-center"
            >
              {isAuthLoading ? <Spinner size="sm" /> : "認証リンクを送信"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setAuthView("select")}
            className="w-full text-sm text-slate-600 hover:underline mt-4"
          >
            他の方法で認証
          </button>
        </div>
      )}

      {authView === "email_sent" && (
        <div className="text-center space-y-4 animate-fade-in">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-slate-800 mb-2">
              📧 メールを確認してください
          </h3>
            <p className="text-sm text-slate-600 mb-2">
              <strong>{emailForLink}</strong>{" "}
            に送信されたメールを開き、中のリンクをクリックして認証を完了してください。
          </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
              <p className="text-xs text-yellow-800 font-semibold mb-1">
                ⚠️ メールが届かない場合:
              </p>
              <ul className="text-xs text-yellow-700 text-left space-y-1 list-disc list-inside">
                <li>迷惑メール（スパム）フォルダをご確認ください</li>
                <li>数分待ってから再度確認してください</li>
                <li>メールアドレスが正しいか確認してください</li>
              </ul>
            </div>
          </div>
          <button
            onClick={() => setAuthView("email_entry")}
            className="text-sm text-slate-600 hover:underline"
          >
            メールアドレスを再入力
          </button>
        </div>
      )}

      {authView === "sms_phone" && (
        <form
          onSubmit={handleSendSmsCode}
          className="space-y-4 animate-fade-in"
        >
          <input
            type="tel"
            value={smsNumber}
            onChange={(e) => setSmsNumber(e.target.value)}
            placeholder="電話番号 (例: 09012345678)"
            required
            className="w-full px-3 py-2 border border-slate-300 rounded-md"
          />
          <p className="text-xs text-slate-500">
            日本の電話番号 (+81) のみ対応しています。ハイフンは不要です。
          </p>
          {authError && (
            <p className="text-sm text-red-600 text-center">{authError}</p>
          )}
          <button
            type="submit"
            disabled={isAuthLoading}
            className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 flex justify-center items-center"
          >
            {isAuthLoading ? <Spinner size="sm" /> : "確認コードを送信"}
          </button>
          <button
            type="button"
            onClick={() => setAuthView("select")}
            className="w-full text-sm text-slate-600 hover:underline"
          >
            他の方法で認証
          </button>
        </form>
      )}

      {authView === "sms_code" && (
        <form
          onSubmit={handleVerifySmsCode}
          className="space-y-4 animate-fade-in"
        >
          <input
            type="text"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            placeholder="確認コード"
            required
            className="w-full px-3 py-2 border border-slate-300 rounded-md"
          />
          <p className="text-xs text-slate-500">
            {smsNumber} に送信された6桁のコードを入力してください。
          </p>
          {authError && (
            <p className="text-sm text-red-600 text-center">{authError}</p>
          )}
          <button
            type="submit"
            disabled={isAuthLoading}
            className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 flex justify-center items-center"
          >
            {isAuthLoading ? <Spinner size="sm" /> : "認証する"}
          </button>
          <button
            type="button"
            onClick={() => setAuthView("sms_phone")}
            className="w-full text-sm text-slate-600 hover:underline"
          >
            電話番号を再入力
          </button>
        </form>
      )}
    </div>
  );
};

export default AuthFlow;
