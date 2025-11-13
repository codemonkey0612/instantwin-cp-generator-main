import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import type { Campaign, Prize, Participant } from "../types";
import Spinner from "../components/Spinner";
import { runLotteryTransaction } from "./campaignPageUtils";
import AuthFlow from "../components/campaign/AuthFlow";
import { useAuth } from "../contexts/AuthContext";

type EventState =
  | "loading"
  | "ready"
  | "participating"
  | "fading"
  | "result"
  | "error";

const EventParticipationPage: React.FC = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [eventState, setEventState] = useState<EventState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [prizeResult, setPrizeResult] = useState<
    Participant["prizeDetails"] | null
  >(null);
  const [multiplePrizeResults, setMultiplePrizeResults] = useState<
    Participant[] | null
  >(null);
  const [chancesFromToken, setChancesFromToken] = useState(1);
  const initializedRef = useRef(false);

  const { user } = useAuth();
  const [isUserLoaded, setIsUserLoaded] = useState(false);

  // Timer state
  const [tokenExpiresAt, setTokenExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState(10);

  const drawingText = useMemo(() => {
    if (!campaign) return "抽選中...";
    const type = campaign.presentationSettings?.type || "simple";
    switch (type) {
      case "lottery-box":
        return "くじ引き中...";
      case "gacha":
        return "ガチャ実行中...";
      case "scratch":
        return "スクラッチ削り中...";
      case "simple":
      default:
        return "抽選中...";
    }
  }, [campaign]);

  // Prevent title from showing the URL: set an empty title immediately,
  // then set the campaign name once loaded
  useEffect(() => {
    if (!campaign?.name) document.title = "";
  }, []);

  useEffect(() => {
    if (campaign?.name) {
      document.title = campaign.name;
    }
  }, [campaign?.name]);

  const getContrastingTextColor = (hex: string): string => {
    if (!hex || !hex.startsWith("#")) return "#FFFFFF";
    const hexValue = hex.substring(1);
    if (hexValue.length !== 6 && hexValue.length !== 3) return "#FFFFFF";
    let r, g, b;
    if (hexValue.length === 3) {
      r = parseInt(hexValue[0] + hexValue[0], 16);
      g = parseInt(hexValue[1] + hexValue[1], 16);
      b = parseInt(hexValue[2] + hexValue[2], 16);
    } else {
      r = parseInt(hexValue.substring(0, 2), 16);
      g = parseInt(hexValue.substring(2, 4), 16);
      b = parseInt(hexValue.substring(4, 6), 16);
    }
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? "#1E293B" : "#FFFFFF";
  };

  const setError = (message: string) => {
    setErrorMessage(message);
    setEventState("error");
  };

  useEffect(() => {
    if (user == null) return;

    setIsUserLoaded(true);
  }, [user]);

  useEffect(() => {
    if (auth.isSignInWithEmailLink(window.location.href)) {
      let email = window.localStorage.getItem("emailForSignIn");
      if (!email) {
        email = window.prompt(
          "認証を完了するために、メールアドレスを再度入力してください。",
        );
      }
      if (email) {
        auth
          .signInWithEmailLink(email, window.location.href)
          .then(() => {
            window.localStorage.removeItem("emailForSignIn");
            if (window.history?.replaceState) {
              window.history.replaceState(
                {},
                document.title,
                window.location.pathname + window.location.hash.split("?")[0],
              );
            }
          })
          .catch((err: any) => {
            console.error(err);
            setError("メールリンク認証に失敗しました。");
          });
      }
    }
  }, []);

  useEffect(() => {
    if (!isUserLoaded || initializedRef.current) return;

    const initialize = async () => {
      initializedRef.current = true;

      if (!campaignId || !token) {
        setError("無効なURLです。");
        return;
      }
      try {
        const campaignDoc = await db
          .collection("campaigns")
          .doc(campaignId)
          .get();
        if (!campaignDoc.exists || !campaignDoc.data()?.eventMode?.enabled) {
          setError("キャンペーンが見つからないか、イベントモードが無効です。");
          return;
        }
        const campaignData = campaignDoc.data() as Campaign;
        setCampaign(campaignData);

        let currentUser = user;
        // Ensure we have a user, sign in anonymously if needed.
        if (!currentUser) {
          const userCredential = await auth.signInAnonymously();
          currentUser = userCredential.user;
        }

        if (!currentUser) {
          // This should not happen if signInAnonymously succeeds.
          setError("ユーザー認証に失敗しました。");
          return;
        }

        // If auth is required and user is anonymous, show login options.
        if (
          campaignData.participantAuthMethod === "required" &&
          currentUser.isAnonymous
        ) {
          setEventState("ready");
          return;
        }

        const tokenRef = db
          .collection("campaigns")
          .doc(campaignId)
          .collection("eventTokens")
          .doc(token);
        const tokenDoc = await tokenRef.get();
        const tokenData = tokenDoc.data();

        if (!tokenData) {
          setError("このQRコードは無効か、期限切れです。");
          return;
        }

        if (!tokenDoc.exists || tokenData.expires.toDate() < new Date()) {
          setError("このQRコードは無効か、期限切れです。");
          return;
        }
        setTokenExpiresAt(tokenData.expires.toDate());
        setChancesFromToken(tokenData.chances || 1);

        setEventState("ready");
      } catch (err: any) {
        console.error("Initialization error:", err);
        if (err.code === "permission-denied") {
          setError(
            "キャンペーンデータの取得権限がありません。Firebaseのルール設定を確認してください。",
          );
        } else {
          setError("キャンペーンの準備に失敗しました。");
        }
      }
    };

    initialize();
  }, [isUserLoaded, user, campaignId, token]);

  // Countdown timer effect
  useEffect(() => {
    if (!tokenExpiresAt) return;
    const timer = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.round((tokenExpiresAt.getTime() - Date.now()) / 1000),
      );
      setTimeLeft(remaining);
      if (remaining === 0 && eventState === "ready") {
        setError(
          "QRコードの有効期限が切れました。モニターで新しいQRコードをスキャンしてください。",
        );
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [tokenExpiresAt, eventState]);

  const handleLotteryStart = useCallback(async () => {
    if (!campaign || !auth.currentUser || !campaignId || !token) return;
    if (timeLeft === 0) {
      setError("QRコードの有効期限が切れました。");
      return;
    }

    setEventState("participating");
    try {
      const tokenRef = db
        .collection("campaigns")
        .doc(campaignId)
        .collection("eventTokens")
        .doc(token);
      const resultRef = db
        .collection("campaigns")
        .doc(campaignId)
        .collection("eventResults")
        .doc(token);

      const results: Participant[] = [];

      await db.runTransaction(async (transaction: any) => {
        const tokenDoc = await transaction.get(tokenRef);
        if (!tokenDoc.exists || tokenDoc.data().expires.toDate() < new Date())
          throw new Error("このQRコードは無効か、期限切れです。");
        if ((await transaction.get(resultRef)).exists)
          throw new Error("このQRコードは既に使用されています。");
      });

      // Get last participation time for interval check
      let lastParticipationTime: Date | null = null;
      if (campaign?.participationIntervalHours || campaign?.participationIntervalMinutes) {
        const participantsQuery = db
          .collection("participants")
          .where("campaignId", "==", campaignId)
          .where("userId", "==", auth.currentUser.uid);
        const participantsSnap = await participantsQuery.get();
        if (!participantsSnap.empty) {
          const records = participantsSnap.docs.map((doc) => {
            const data = doc.data();
            return {
              ...data,
              wonAt: data.wonAt?.toDate(),
            };
          });
          const sortedRecords = records.sort(
            (a: any, b: any) => (b.wonAt?.getTime() || 0) - (a.wonAt?.getTime() || 0),
          );
          if (sortedRecords.length > 0 && sortedRecords[0].wonAt) {
            lastParticipationTime = sortedRecords[0].wonAt;
          }
        }
      }

      for (let i = 0; i < chancesFromToken; i++) {
        const result = await runLotteryTransaction({
          campaignId,
          user: auth.currentUser,
          alreadyWonPrizeIds: new Set(),
          pendingAnswers: {},
          lastParticipationTime: i === 0 ? lastParticipationTime : null, // Only check interval for first participation
        });
        results.push(result);
        // Update last participation time for next iteration
        if (result.wonAt) {
          lastParticipationTime = result.wonAt;
        }
      }

      const winningResults = results.filter((r) => r.prizeId !== "loss");
      const resultsToSave =
        winningResults.length > 0 ? winningResults : [results[0]];

      await resultRef.set({
        results: resultsToSave.map((r) => ({
          prize: r.prizeDetails,
          isConsolation: !!r.isConsolationPrize,
        })),
        wonAt: new Date(),
        userId: auth.currentUser.uid,
      });
      await tokenRef.delete();

      if (results.length > 1) {
        setMultiplePrizeResults(results);
      } else {
        setPrizeResult(results[0].prizeDetails);
      }

      setTimeout(() => {
        setEventState("fading");
      }, 3000);
    } catch (err: any) {
      console.error("Lottery error:", err);
      setError(err.message || "抽選に失敗しました。");
    }
  }, [campaign, campaignId, token, timeLeft, chancesFromToken]);

  useEffect(() => {
    if (eventState === "fading") {
      const timer = setTimeout(() => {
        setEventState("result");
        sessionStorage.setItem("eventParticipationDone", "true");
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [eventState]);

  useEffect(() => {
    if (eventState === "result") {
      setRedirectCountdown(10);
      const timer = setInterval(() => {
        setRedirectCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate(`/campaign/${campaignId}`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [eventState, navigate, campaignId]);

  const needsAuth = useMemo(() => {
    if (eventState !== "ready" || !campaign) return false;
    // Auth is needed if the campaign requires it AND the user is not logged in, or is anonymous.
    return (
      campaign.participantAuthMethod === "required" &&
      (!user || user.isAnonymous)
    );
  }, [eventState, campaign, user]);

  const renderContent = () => {
    const themeColor = campaign?.designSettings?.themeColor || "#1E293B";
    if (eventState === "loading" || !isUserLoaded)
      return <Spinner size="lg" color={themeColor} />;

    if (eventState === "error") {
      return (
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-700 mb-4">エラー</h2>
          <p className="text-slate-600">{errorMessage}</p>
          <button
            onClick={() => navigate(`/campaign/${campaignId}`)}
            className="mt-4 px-4 py-2 bg-slate-200 rounded-md"
          >
            キャンペーンページへ
          </button>
        </div>
      );
    }

    switch (eventState) {
      case "ready":
        if (needsAuth) {
          return <AuthFlow campaign={campaign!} />;
        }
        const buttonText =
          campaign?.presentationSettings?.participationButtonText ||
          "抽選スタート！";
        const fullButtonText =
          chancesFromToken > 1
            ? `${chancesFromToken}回 ${buttonText}`
            : buttonText;
        return (
          <div className="text-center">
            {campaign?.showNameOnPublicPage && (
              <h1
                className="text-3xl font-bold mb-2"
                style={{ color: themeColor }}
              >
                {campaign?.name}
              </h1>
            )}
            <p className="text-slate-500 mb-8">
              準備ができたらボタンを押してスタート！
            </p>
            <button
              onClick={handleLotteryStart}
              style={{ backgroundColor: themeColor }}
              className="w-full max-w-sm mx-auto text-white font-bold py-6 px-8 rounded-full text-2xl transition-all duration-300 ease-in-out shadow-lg hover:shadow-2xl transform hover:-translate-y-1"
            >
              {fullButtonText}
            </button>
            {timeLeft !== null && (
              <p className="text-center text-slate-500 mt-4">
                有効期限まで:{" "}
                <span
                  className={`font-bold text-lg ${timeLeft <= 10 ? "text-red-500" : ""}`}
                >
                  {timeLeft}
                </span>
                秒
              </p>
            )}
          </div>
        );
      case "participating":
        return (
          <div className="w-full flex-grow flex flex-col justify-center items-center">
            <Spinner size="lg" color={themeColor} />
            <p
              className="font-semibold mt-4 text-xl"
              style={{ color: themeColor }}
            >
              {drawingText}
            </p>
          </div>
        );
      case "fading":
        return null;
      case "result":
        const countdownText = (
          <p className="text-slate-600 text-sm mt-6">
            <span className="font-bold" style={{ color: themeColor }}>
              {redirectCountdown}
            </span>
            秒後にキャンペーンページに戻ります
          </p>
        );

        if (multiplePrizeResults) {
          const summary = multiplePrizeResults.reduce(
            (acc, result) => {
              const prize = result.prizeDetails;
              const key = prize.id;
              if (!acc[key])
                acc[key] = {
                  prize,
                  count: 0,
                  isConsolation: !!result.isConsolationPrize,
                };
              acc[key].count++;
              return acc;
            },
            {} as Record<
              string,
              { prize: Prize; count: number; isConsolation: boolean }
            >,
          );
          const hasWin = multiplePrizeResults.some(
            (r) => r.prizeId !== "loss" && !r.isConsolationPrize,
          );
          return (
            <div className="text-center animate-prize-pop">
              <h2
                className="text-2xl font-bold mb-4"
                style={{ color: themeColor }}
              >
                {hasWin ? "おめでとうございます！" : "抽選結果"}
              </h2>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {Object.values(summary).map(
                  ({ prize, count, isConsolation }) => (
                    <div
                      key={prize.id}
                      className="p-2 border rounded-md flex items-center gap-3"
                    >
                      {prize.imageUrl && (
                        <img
                          src={prize.imageUrl}
                          alt={prize.title}
                          className="w-12 h-12 rounded-md object-cover"
                        />
                      )}
                      <div className="text-left flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full inline-block"
                            style={{
                              backgroundColor: prize.rankColor || "#6366F1",
                              color: getContrastingTextColor(
                                prize.rankColor || "#6366F1",
                              ),
                            }}
                          >
                            {prize.rank}
                          </span>
                          {isConsolation && (
                            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full">
                              参加賞
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-slate-800">
                          {prize.title}
                        </p>
                      </div>
                      <p className="font-bold text-lg text-slate-800">
                        x {count}
                      </p>
                    </div>
                  ),
                )}
              </div>
              {countdownText}
            </div>
          );
        }
        return (
          <div className="text-center animate-prize-pop">
            {prizeResult && prizeResult.id !== "loss" ? (
              <>
                <h2
                  className="text-2xl font-bold mb-4 whitespace-pre-line"
                  style={{ color: themeColor }}
                >
                  {"おめでとうございます！\n当選内容"}
                </h2>
                <span
                  className="text-md font-bold px-3 py-1 rounded-full inline-block"
                  style={{
                    backgroundColor: prizeResult.rankColor || "#6366F1",
                    color: getContrastingTextColor(
                      prizeResult.rankColor || "#6366F1",
                    ),
                  }}
                >
                  {prizeResult.rank}
                </span>
                <h3 className="text-2xl font-bold text-slate-800 mt-3 mb-2">
                  {prizeResult.title}
                </h3>
                {prizeResult.imageUrl && (
                  <img
                    src={prizeResult.imageUrl}
                    alt={prizeResult.title}
                    className="max-w-full h-32 object-contain mx-auto rounded-md mt-2"
                  />
                )}
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                  残念...
                </h2>
                <p className="text-slate-600 text-lg">
                  またのチャレンジをお待ちしております
                </p>
              </>
            )}
            {countdownText}
          </div>
        );
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col justify-center items-center p-4 transition-colors duration-500 relative"
      style={{
        backgroundColor:
          campaign?.designSettings?.background?.type === "color"
            ? campaign.designSettings.background.color
            : "#F1F5F9",
      }}
    >
      {campaign?.designSettings?.background?.type === "image" &&
        campaign.designSettings.background.imageUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${campaign.designSettings.background.imageUrl})`,
            }}
          ></div>
        )}
      {eventState === "fading" && (
        <div className="absolute inset-0 bg-white animate-fade-in z-20"></div>
      )}
      <div className="bg-white/80 backdrop-blur-sm p-8 sm:p-12 rounded-2xl shadow-xl max-w-md w-full z-10 flex flex-col justify-center items-center min-h-[400px]">
        {renderContent()}
      </div>
    </div>
  );
};

export default EventParticipationPage;
