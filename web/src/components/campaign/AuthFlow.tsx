import React, { useState, useRef, useEffect } from "react";
import { firebase, auth, googleProvider } from "../../firebase";
import type { Campaign, AuthProviders } from "../../types";
import Spinner from "../Spinner";
import { captureException } from "@sentry/react";
// import { useParticipationTicket } from "../../pages/hooks/useParticipationTicket";

interface AuthFlowProps {
  campaign: Campaign;
  isSavingResult?: boolean;
  closeModal?: () => void;
  lastTicketToken?: string | null;
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
};

const enabledProviders = (authProviders: AuthProviders | undefined) =>
  Object.entries(authProviders || {})
    .filter(([_, v]) => v)
    .map(([k]) => k as keyof AuthProviders);

const AuthFlow: React.FC<AuthFlowProps> = ({
  campaign,
  isSavingResult = false,
  closeModal,
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
      if (!auth.currentUser) {
        await auth.signInWithRedirect(provider);

        // if (lastTicketToken && user) {
        //   await claimTicket(user.uid, campaign, lastTicketToken);
        // }
      } else {
        try {
          await auth.currentUser.linkWithRedirect(provider);
        } catch (err: any) {
          if (
            err.code === "auth/credential-already-in-use" ||
            err.code === "auth/email-already-in-use"
          ) {
            if (err.credential) {
              await auth.signInWithCredential(err.credential);

              // if (lastTicketToken && user) {
              //   await claimTicket(user.uid, campaign, lastTicketToken);
              // }
            } else {
              throw err;
            }
          } else {
            throw err;
          }
        }
      }

      closeModal?.();
    } catch (error: any) {
      if (
        error.code !== "auth/popup-closed-by-user" &&
        error.code !== "auth/cancelled-popup-request"
      ) {
        setAuthError("認証に失敗しました。");
      } else {
        captureException(error, { level: "error" });
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    handleSocialSignIn(googleProvider);
  };

  const handleLineSignIn = async () => {
    // const provider = new firebase.auth.OAuthProvider("oidc.line");
    // provider.setCustomParameters({
    //   bot_prompt: "aggressive",
    // });
    // handleSocialSignIn(provider);
    const clientId = "2008069638";
    const currentUrl = new URL(window.location.href);
    const redirectUri = encodeURIComponent(
      currentUrl.origin + currentUrl.pathname,
    );
    const state = Math.random().toString(36).substring(2);
    const lineAuthorizeUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=profile%20openid&prompt=consent&bot_prompt=aggressive`;

    window.localStorage.setItem("lineOAuthState", state);
    window.location.href = lineAuthorizeUrl;
  };

  const handleSendEmailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthLoading(true);
    const actionCodeSettings = {
      url: window.location.href,
      handleCodeInApp: true,
    };
    try {
      await auth.sendSignInLinkToEmail(emailForLink, actionCodeSettings);
      window.localStorage.setItem("emailForSignIn", emailForLink);
      setAuthView("email_sent");
    } catch (error: any) {
      setAuthError(
        "ログインリンクの送信に失敗しました: " + (error.message || ""),
      );
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
      await confirmationResult.confirm(verificationCode);
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
          <h3 className="font-semibold text-slate-800">
            メールを確認してください
          </h3>
          <p className="text-sm text-slate-600">
            {emailForLink}{" "}
            に送信されたメールを開き、中のリンクをクリックして認証を完了してください。
          </p>
          <p className="text-xs text-slate-500">
            メールが届かない場合は、迷惑メールフォルダもご確認ください。
          </p>
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
