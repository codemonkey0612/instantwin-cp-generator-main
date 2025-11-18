import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useParams } from "react-router-dom";
import { db, FieldValue } from "../firebase";
import type { Campaign, Prize } from "../types";
import Spinner from "../components/Spinner";

type LotteryState = "waiting" | "animating" | "fading" | "result";

// Helper function for color contrast
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
  return yiq >= 128 ? "#1E293B" : "#FFFFFF"; // slate-800 or white
};

const MonitorPage: React.FC = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEventStarted, setIsEventStarted] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [lotteryState, setLotteryState] = useState<LotteryState>("waiting");
  const [prizeResults, setPrizeResults] = useState<
    { prize: Prize; isConsolation: boolean }[] | null
  >(null);
  const [chancesToGrant, setChancesToGrant] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const hasRealWin = useMemo(() => {
    if (!prizeResults) return false;
    return prizeResults.some((r) => r.prize.id !== "loss" && !r.isConsolation);
  }, [prizeResults]);

  const generateToken = useCallback(async () => {
    if (!campaignId || document.hidden) return;
    try {
      const token = crypto.randomUUID();
      const expires = new Date(Date.now() + 30000); // 30s validity

      await db
        .collection("campaigns")
        .doc(campaignId)
        .collection("eventTokens")
        .doc(token)
        .set({
          expires,
          chances: chancesToGrant,
          remainingChances: chancesToGrant,
          createdAt: FieldValue.serverTimestamp(),
          lastUsedAt: null,
        });

      // Use path-based routing (no hash) since the app uses BrowserRouter
      // Remove any monitor path and construct the event URL
      const basePath = window.location.pathname.replace(/\/monitor\/.*/, "");
      const eventUrl = `${window.location.origin}${basePath}/event/${campaignId}?token=${token}`;
      setQrCodeUrl(
        `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(eventUrl)}`,
      );
      setError(null);
    } catch (err: any) {
      console.error("Failed to generate event token:", err);
      setQrCodeUrl("");
      if (err.code === "permission-denied") {
        setError(
          "QRコードの生成に失敗しました。データベースへの書き込み権限がありません。Firebaseのセキュリティルールを確認してください。",
        );
      } else {
        setError(
          "QRコードの生成に失敗しました。ネットワーク接続を確認し、ページを再読み込みしてください。",
        );
      }
    }
  }, [campaignId, chancesToGrant]);

  // Fetch campaign data
  useEffect(() => {
    if (!campaignId) {
      setError("キャンペーンIDが見つかりません。");
      setLoading(false);
      return;
    }
    const campaignRef = db.collection("campaigns").doc(campaignId);
    const unsubscribe = campaignRef.onSnapshot(
      (doc) => {
        if (doc.exists) {
          const data = doc.data() as Omit<Campaign, "id">;
          if (!data.eventMode?.enabled) {
            setError(
              "このキャンペーンではイベントモードが有効になっていません。",
            );
            setCampaign(null);
          } else {
            setCampaign({ id: doc.id, ...data, showNameOnPublicPage: true });
            setChancesToGrant(data.eventMode?.chancesToGrant || 1);
            setError(null);
          }
        } else {
          setError("キャンペーンが見つかりませんでした。");
          setCampaign(null);
        }
        setLoading(false);
      },
      (err: any) => {
        console.error(err);
        setError("キャンペーン情報の取得に失敗しました。");
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [campaignId]);

  // QR Code generation and countdown timer
  useEffect(() => {
    let tokenInterval: number | undefined;
    if (campaign && lotteryState === "waiting" && !error && isEventStarted) {
      generateToken();
      tokenInterval = window.setInterval(generateToken, 30000);
    }
    return () => {
      if (tokenInterval) clearInterval(tokenInterval);
    };
  }, [campaign, lotteryState, error, generateToken, isEventStarted]);

  // Listen for lottery results
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (
      campaign &&
      campaignId &&
      lotteryState === "waiting" &&
      isEventStarted
    ) {
      const listenerStartTime = new Date();
      const resultsCollectionRef = db
        .collection("campaigns")
        .doc(campaignId)
        .collection("eventResults")
        .where("wonAt", ">=", listenerStartTime);

      unsubscribe = resultsCollectionRef.onSnapshot(
        (snapshot: any) => {
          snapshot.docChanges().forEach((change: any) => {
            if (change.type === "added") {
              const data = change.doc.data();
              let resultsFromDB: { prize: Prize; isConsolation: boolean }[] =
                [];
              if (data.results) {
                // New structure
                resultsFromDB = data.results;
              } else if (data.prizes) {
                // Old structure for compatibility
                resultsFromDB = (data.prizes as Prize[]).map((p) => ({
                  prize: p,
                  isConsolation: !!(
                    campaign?.consolationPrize &&
                    p.id === campaign.consolationPrize.id
                  ),
                }));
              }
              setPrizeResults(resultsFromDB);
              setLotteryState("animating");
              return; // Process only the first new result
            }
          });
        },
        (err: any) => {
          console.error("Firestore listener error:", err);
          setError("抽選結果の待機中にエラーが発生しました。");
        },
      );
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [campaign, campaignId, lotteryState, isEventStarted]);

  // Animation/result display sequence
  useEffect(() => {
    let timer: number;

    if (lotteryState === "animating") {
      timer = window.setTimeout(() => {
        setLotteryState("fading");
      }, 2000);
    } else if (lotteryState === "fading") {
      timer = window.setTimeout(() => {
        setLotteryState("result");
      }, 500);
    } else if (lotteryState === "result") {
      timer = window.setTimeout(() => {
        setLotteryState("waiting");
        setPrizeResults(null);
      }, 10000);
    }
    return () => {
      clearTimeout(timer);
    };
  }, [lotteryState]);

  // Sound playback effect
  useEffect(() => {
    if (!campaign?.presentationSettings?.soundSettings?.enabled) return;

    const settings = campaign.presentationSettings.soundSettings;
    const stopSound = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };

    let soundUrl: string | undefined;
    let loop = false;

    if (lotteryState === "animating") {
      soundUrl = settings.drawingSoundUrl;
      loop = true;
    } else if (lotteryState === "result" && prizeResults) {
      soundUrl = hasRealWin ? settings.winSoundUrl : settings.loseSoundUrl;
    }

    if (soundUrl) {
      stopSound();
      audioRef.current = new Audio(soundUrl);
      audioRef.current.loop = loop;
      audioRef.current
        .play()
        .catch((e) => console.error("Audio play failed:", e));
    } else {
      stopSound();
    }

    if (lotteryState === "waiting") {
      stopSound();
    }

    return stopSound;
  }, [lotteryState, prizeResults, campaign, hasRealWin]);

  const aggregatedPrizes = useMemo(() => {
    if (!prizeResults) return [];

    const summary = new Map<string, { prize: Prize; count: number }>();
    prizeResults.forEach((result) => {
      const { prize } = result;
      if (prize.id === "loss") return;
      const existing = summary.get(prize.id);
      if (existing) {
        existing.count++;
      } else {
        summary.set(prize.id, { prize, count: 1 });
      }
    });

    return Array.from(summary.values()).sort((a, b) =>
      (a.prize.rank || "").localeCompare(b.prize.rank || ""),
    );
  }, [prizeResults]);

  const handleStartEvent = () => {
    // Unlock audio context by playing a silent sound
    const audio = new Audio();
    audio.play().catch(() => {});

    // Request fullscreen for better experience
    document.documentElement.requestFullscreen().catch((err) => {
      console.warn(`Fullscreen request failed: ${err.message}`);
    });

    setIsEventStarted(true);
  };

  if (loading) {
    return (
      <div className="w-screen h-screen flex justify-center items-center bg-slate-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-screen h-screen flex justify-center items-center bg-red-100 text-red-800 p-8 text-center font-bold text-xl">
        {error}
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="w-screen h-screen flex justify-center items-center bg-slate-900 text-white">
        キャンペーンデータを読み込んでいます...
      </div>
    );
  }

  const themeColor = campaign.designSettings?.themeColor || "#1E293B";
  const backgroundSettings = campaign.designSettings?.background;
  const backgroundStyle: React.CSSProperties = {
    "--theme-color": themeColor,
  } as React.CSSProperties;
  const outerTextStyle: React.CSSProperties = {};

  if (backgroundSettings?.type === "image" && backgroundSettings.imageUrl) {
    backgroundStyle.backgroundImage = `url(${backgroundSettings.imageUrl})`;
    backgroundStyle.backgroundSize = "cover";
    backgroundStyle.backgroundPosition = "center";
    outerTextStyle.color = "#FFFFFF";
    outerTextStyle.textShadow = "0 2px 4px rgba(0, 0, 0, 0.5)";
  } else {
    const bgColor = backgroundSettings?.color || "#111827";
    backgroundStyle.backgroundColor = bgColor;
    outerTextStyle.color = getContrastingTextColor(bgColor);
  }

  if (!isEventStarted) {
    return (
      <div
        className="w-screen h-screen flex flex-col justify-center items-center p-8 transition-colors duration-500 overflow-hidden"
        style={backgroundStyle}
      >
        <div className="text-center p-8 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl animate-fade-in">
          <h1
            className="text-3xl lg:text-4xl font-bold mb-2"
            style={{ color: themeColor }}
          >
            {campaign.name}
          </h1>
          <p className="text-slate-600 mb-8">モニター画面の準備ができました</p>
          <button
            onClick={handleStartEvent}
            style={{ backgroundColor: themeColor }}
            className="px-12 py-4 text-white font-bold text-xl rounded-lg shadow-lg hover:shadow-xl transition-transform transform hover:-translate-y-1"
          >
            イベントを開始する
          </button>
          <p className="text-xs text-slate-500 mt-4">
            最適な体験のために、フルスクリーンで表示されます。
          </p>
        </div>
      </div>
    );
  }

  const animSettings = campaign.presentationSettings?.animationSettings;
  const hasDrawingAnimation =
    animSettings?.drawingAnimationVideoUrl ||
    animSettings?.drawingAnimationImageUrl;

  return (
    <div
      className="w-screen h-screen relative flex flex-col justify-center items-center p-8 transition-colors duration-500 overflow-hidden"
      style={backgroundStyle}
    >
      {lotteryState === "waiting" && (
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl max-w-2xl w-full p-8 text-slate-800 flex flex-col items-center animate-fade-in max-h-[95vh] min-h-[75vh]">
          <div className="flex-shrink-0 text-center mb-4">
            <h1
              className="text-3xl lg:text-4xl font-bold mb-2"
              style={{ color: themeColor }}
            >
              {campaign.name}
            </h1>
            {campaign.description && (
              <p className="text-slate-500 mb-4">{campaign.description}</p>
            )}
            <p className="text-lg lg:text-xl text-slate-700 font-medium">
              QRコードをスキャンして参加！
            </p>
          </div>

          <div className="flex-1 w-full flex flex-col items-center justify-center min-h-0">
            <div className="relative w-full max-w-sm aspect-square max-h-full">
              {qrCodeUrl ? (
                <div className="bg-white p-4 rounded-lg border border-slate-200 w-full h-full">
                  <img
                    src={qrCodeUrl}
                    alt="Participation QR Code"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex justify-center items-center bg-slate-100 rounded-lg">
                  <Spinner size="lg" />
                </div>
              )}
            </div>
          </div>

          <div className="w-full max-w-sm flex-shrink-0 mt-8">
            <div className="flex items-center justify-center gap-4">
              <label
                htmlFor="chancesToGrant"
                className="font-medium text-slate-700"
              >
                現在の実施可能数:
              </label>
              <input
                type="number"
                id="chancesToGrant"
                value={chancesToGrant}
                onChange={(e) =>
                  setChancesToGrant(Math.max(1, parseInt(e.target.value) || 1))
                }
                min="1"
                className="w-20 text-center font-bold text-lg border-slate-300 rounded-md shadow-sm focus:ring-2 focus:ring-[var(--theme-color)] focus:border-[var(--theme-color)]"
              />
            </div>
          </div>
        </div>
      )}
      {lotteryState === "animating" && (
        <>
          {animSettings?.drawingAnimationVideoUrl && (
            <video
              src={animSettings.drawingAnimationVideoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover z-0"
            />
          )}
          {animSettings?.drawingAnimationImageUrl &&
            !animSettings.drawingAnimationVideoUrl && (
              <img
                src={animSettings.drawingAnimationImageUrl}
                alt="抽選中"
                className="absolute inset-0 w-full h-full object-cover z-0"
              />
            )}
          <div
            className={`relative z-10 ${hasDrawingAnimation ? "bg-black/30 text-white" : "bg-white/95 text-slate-800"} backdrop-blur-sm rounded-2xl shadow-2xl p-8 text-center animate-fade-in max-w-2xl w-full flex flex-col justify-center items-center min-h-[75vh]`}
          >
            <div>
              <Spinner
                size="lg"
                color={hasDrawingAnimation ? "#FFFFFF" : themeColor}
              />
              <h2
                className="text-5xl font-bold mt-6"
                style={hasDrawingAnimation ? {} : { color: themeColor }}
              >
                {drawingText}
              </h2>
            </div>
          </div>
        </>
      )}
      {lotteryState === "fading" && (
        <div className="absolute inset-0 bg-white animate-fade-in z-10"></div>
      )}
      {lotteryState === "result" &&
        prizeResults &&
        (() => {
          const resultVideo = hasRealWin
            ? animSettings?.winAnimationVideoUrl
            : animSettings?.loseAnimationVideoUrl;
          const resultImage = hasRealWin
            ? animSettings?.winAnimationImageUrl
            : animSettings?.loseAnimationImageUrl;
          return (
            <div className="w-full h-full flex justify-center items-center">
              <div className="relative z-10 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 text-slate-800 text-center animate-prize-pop max-w-3xl w-full flex flex-col justify-center items-center min-h-[75vh]">
                {resultVideo && (
                  <video
                    src={resultVideo}
                    autoPlay
                    muted
                    playsInline
                    className="w-full max-w-sm mx-auto rounded-lg mb-4"
                  />
                )}
                {resultImage && !resultVideo && (
                  <img
                    src={resultImage}
                    alt="結果"
                    className="w-full max-w-sm mx-auto mb-4"
                  />
                )}
                {aggregatedPrizes.length > 0 ? (
                  <>
                    <h2
                      className="text-5xl lg:text-6xl font-bold mb-8"
                      style={{ color: themeColor }}
                    >
                      {hasRealWin ? "おめでとうございます！" : "抽選結果"}
                    </h2>
                    <div className="w-full space-y-4 max-h-[60vh] overflow-y-auto p-2">
                      {aggregatedPrizes.map(({ prize, count }) => (
                        <div
                          key={prize.id}
                          className="p-4 bg-white border-2 border-slate-200 rounded-xl flex items-center gap-6 shadow-lg"
                        >
                          {prize.imageUrl && (
                            <img
                              src={prize.imageUrl}
                              alt={prize.title}
                              className="w-32 h-32 object-cover rounded-lg flex-shrink-0 bg-slate-100"
                            />
                          )}
                          <div className="text-left flex-grow">
                            <span
                              className="text-lg font-bold px-4 py-1.5 rounded-full inline-block"
                              style={{
                                backgroundColor: prize.rankColor || "#6366F1",
                                color: getContrastingTextColor(
                                  prize.rankColor || "#6366F1",
                                ),
                              }}
                            >
                              {prize.rank}
                            </span>
                            <h3 className="text-4xl font-bold mt-2 break-words">
                              {prize.title}
                            </h3>
                          </div>
                          <div className="flex-shrink-0 text-right pr-4">
                            <span className="text-slate-500 text-2xl">x</span>
                            <span className="text-slate-800 text-6xl font-bold ml-2">
                              {count}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="text-7xl lg:text-8xl font-bold text-slate-800 opacity-90">
                      残念...
                    </h2>
                    <p className="text-2xl lg:text-3xl text-slate-600 mt-4">
                      またのチャレンジをお待ちしております
                    </p>
                  </>
                )}
              </div>
            </div>
          );
        })()}
    </div>
  );
};

export default MonitorPage;
