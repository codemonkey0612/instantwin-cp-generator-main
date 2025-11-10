import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { auth, functions } from "../firebase";
import { captureException } from "@sentry/react";
import Spinner from "../components/Spinner";
import { setCampaignAuth, getAndClearStoredCampaignId, getCampaignIdFromUrl } from "../utils/campaignAuth";

/**
 * LINE OAuth callback handler
 * This component handles the callback from LINE after user authorization
 */
const LineAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleLineCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error_description = searchParams.get("error_description");

      // Handle error from LINE
      if (error_description) {
        setError("LINEログイン中にエラーが発生しました: " + error_description);
        setLoading(false);
        captureException(new Error(error_description), { level: "error" });
        return;
      }

      // Check if we have the required parameters
      if (!code || !state) {
        setError("LINEログインのパラメータが不正です。");
        setLoading(false);
        return;
      }

      try {
        // Verify state parameter
        const storedState = window.localStorage.getItem("lineOAuthState");
        if (!storedState || state !== storedState) {
          throw new Error("Invalid state parameter - possible CSRF attack");
        }

        // Use the same redirect URI as in the authorization request
        // This must match exactly what was used in AuthFlow.tsx
        const redirectUri = `${window.location.origin}/auth/line/callback`;

        // Call Firebase function to exchange code for custom token
        const createToken = functions.httpsCallable(
          "createFirebaseAuthCustomToken",
        );
        const result = await createToken({
          code,
          redirectUri,
        });
        const firebaseCustomToken = result.data.customToken;

        // Sign in with the custom token
        await auth.signInWithCustomToken(firebaseCustomToken);

        // Mark campaign as authenticated
        const campaignId = getAndClearStoredCampaignId() || getCampaignIdFromUrl();
        if (campaignId) {
          setCampaignAuth(campaignId);
        }

        // Clean up stored state
        window.localStorage.removeItem("lineOAuthState");

        // Redirect to the stored return URL or home
        const returnUrl = window.localStorage.getItem("lineReturnUrl");
        window.localStorage.removeItem("lineReturnUrl");

        if (returnUrl) {
          // Remove query parameters from return URL
          const returnUrlObj = new URL(returnUrl);
          returnUrlObj.search = "";
          window.location.href = returnUrlObj.toString();
        } else {
          // Default redirect to home
          navigate("/");
        }
      } catch (e: any) {
        setError("LINEログイン中にエラーが発生しました: " + (e.message || ""));
        setLoading(false);
        captureException(e, { level: "error" });
        // Clean up on error
        window.localStorage.removeItem("lineOAuthState");
        window.localStorage.removeItem("lineReturnUrl");
      }
    };

    handleLineCallback();
  }, [searchParams, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-slate-50">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-slate-600">LINEログインを処理中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-slate-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full mx-4">
          <h2 className="text-xl font-bold text-slate-800 mb-4">エラー</h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="w-full bg-slate-500 text-white font-bold py-2 px-4 rounded hover:bg-slate-600"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default LineAuthCallback;

