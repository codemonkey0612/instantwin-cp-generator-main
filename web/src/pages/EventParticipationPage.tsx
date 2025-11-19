import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { db, auth, FieldValue } from "../firebase";
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

const EVENT_TOKEN_DISPLAY_LIMIT = 30;

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
  const isProcessingRef = useRef(false);
  const tokenUnsubscribeRef = useRef<(() => void) | null>(null);
  const isTransactionInProgressRef = useRef(false); // Prevent listener updates during transaction
  const buttonRef = useRef<HTMLButtonElement | null>(null); // Ref to track button element

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

        if (!tokenDoc.exists) {
          setError("このQRコードは無効か、期限切れです。");
          return;
        }

        const expiresAt = tokenData.expires?.toDate ? tokenData.expires.toDate() : new Date(tokenData.expires);
        if (expiresAt < new Date()) {
          setError("このQRコードは無効か、期限切れです。");
          return;
        }
        
        const initialRemaining = Math.max(
          0,
          Math.round((expiresAt.getTime() - Date.now()) / 1000),
        );
        
        // Always read the latest remainingChances from database
        const totalRemaining =
          typeof tokenData.remainingChances === "number"
            ? tokenData.remainingChances
            : (typeof tokenData.chances === "number" ? tokenData.chances : 1);
            
        console.log(`[Initialization] Token loaded: remainingChances = ${totalRemaining}, chances = ${tokenData.chances}`);
        
        if (totalRemaining <= 0) {
          setError(
            "このQRコードの参加可能回数は終了しました。モニターで新しいQRコードをスキャンしてください。",
          );
          return;
        }
        
        setTokenExpiresAt(expiresAt);
        setTimeLeft(Math.min(EVENT_TOKEN_DISPLAY_LIMIT, initialRemaining));
        setChancesFromToken(totalRemaining);

        // Clean up any existing listener
        if (tokenUnsubscribeRef.current) {
          tokenUnsubscribeRef.current();
          tokenUnsubscribeRef.current = null;
        }

        // Set up a real-time listener to keep chancesFromToken in sync with database
        const unsubscribe = tokenRef.onSnapshot((doc) => {
          // Don't update state if a transaction is in progress - let the transaction handle state updates
          if (isTransactionInProgressRef.current) {
            console.log(`[Listener] Ignoring update - transaction in progress`);
            return;
          }
          
          if (doc.exists) {
            const data = doc.data();
            const latestRemaining =
              typeof data?.remainingChances === "number"
                ? data.remainingChances
                : (typeof data?.chances === "number" ? data.chances : 1);
            console.log(`[Listener] Token updated in DB: remainingChances = ${latestRemaining}`);
            setChancesFromToken((prev) => {
              if (prev !== latestRemaining) {
                console.log(`[Listener] Syncing state: ${prev} -> ${latestRemaining}`);
              }
              return latestRemaining;
            });
          }
        }, (err) => {
          console.error("Token listener error:", err);
        });

        // Store unsubscribe function to clean up later
        tokenUnsubscribeRef.current = unsubscribe;

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
    
    // Cleanup function - unsubscribe from token listener when component unmounts or dependencies change
    return () => {
      if (tokenUnsubscribeRef.current) {
        console.log("[Cleanup] Unsubscribing from token listener");
        tokenUnsubscribeRef.current();
        tokenUnsubscribeRef.current = null;
      }
    };
  }, [isUserLoaded, user, campaignId, token]);

  // Countdown timer effect
  useEffect(() => {
    if (!tokenExpiresAt) return;
    const updateCountdown = () => {
      const remainingActual = Math.max(
        0,
        Math.round((tokenExpiresAt.getTime() - Date.now()) / 1000),
      );
      const displayRemaining = Math.min(
        EVENT_TOKEN_DISPLAY_LIMIT,
        remainingActual,
      );
      setTimeLeft(displayRemaining);
      if (remainingActual === 0 && eventState === "ready") {
        setError(
          "QRコードの有効期限が切れました。モニターで新しいQRコードをスキャンしてください。",
        );
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [tokenExpiresAt, eventState]);

  const handleLotteryStart = useCallback(async () => {
    // Log the call stack to identify if this is being called automatically
    // Use console.log with a very visible prefix
    console.log("========== [handleLotteryStart] CALLED ==========", {
      eventState,
      chancesFromToken,
      isProcessing: isProcessingRef.current,
      timeLeft,
      timestamp: new Date().toISOString(),
    });
    console.log("[handleLotteryStart] Stack trace:", new Error().stack);
    
    if (!campaign || !auth.currentUser || !campaignId || !token) {
      console.warn("[handleLotteryStart] Blocked: missing required data");
      return;
    }
    if (timeLeft === 0) {
      setError("QRコードの有効期限が切れました。");
      return;
    }
    // Prevent double-clicks and automatic execution by checking state and ref
    // This function should ONLY be called from user button clicks, never automatically
    if (eventState !== "ready" || isProcessingRef.current) {
      console.warn("[handleLotteryStart] Blocked:", { eventState, isProcessing: isProcessingRef.current });
      return;
    }

    // Set processing flag immediately to prevent concurrent transactions
    isProcessingRef.current = true;
    isTransactionInProgressRef.current = true; // Block listener updates during transaction
    // Immediately set to participating to prevent double-clicks
    setEventState("participating");
    setMultiplePrizeResults(null);
    setErrorMessage(null);
    
    try {
      const tokenRef = db
        .collection("campaigns")
        .doc(campaignId)
        .collection("eventTokens")
        .doc(token);
      let nextRemainingChances = 0;
      let actualRemainingBefore = 0;
      let retryCount = 0;
      const maxRetries = 5; // Increased retries for better conflict handling

      // Retry transaction in case of conflicts
      while (retryCount < maxRetries) {
        try {
          await db.runTransaction(async (transaction: any) => {
            const tokenDoc = await transaction.get(tokenRef);
            if (!tokenDoc.exists) {
              throw new Error("このQRコードは無効か、期限切れです。");
            }
            const tokenData = tokenDoc.data();
            const expiresAt = tokenData.expires?.toDate ? tokenData.expires.toDate() : new Date(tokenData.expires);
            if (expiresAt < new Date()) {
              throw new Error("このQRコードは無効か、期限切れです。");
            }
            
            // Always read the LATEST remainingChances from database
            actualRemainingBefore =
              typeof tokenData.remainingChances === "number"
                ? tokenData.remainingChances
                : (typeof tokenData.chances === "number" ? tokenData.chances : 1);
            
            console.log(`[Token Transaction] Attempt ${retryCount + 1}/${maxRetries}: Reading from DB: remainingChances = ${actualRemainingBefore}`);
            
            // Double-check: if somehow we have 0 or less, throw error
            if (actualRemainingBefore <= 0) {
              console.warn(`[Token Transaction] No chances left! remainingChances = ${actualRemainingBefore}`);
              throw new Error("NO_CHANCES_LEFT");
            }
            
            nextRemainingChances = actualRemainingBefore - 1;
            console.log(`[Token Transaction] Updating: ${actualRemainingBefore} -> ${nextRemainingChances}`);
            
            // Update token with new remaining chances - this is atomic
            transaction.update(tokenRef, {
              remainingChances: nextRemainingChances,
              lastUsedAt: FieldValue.serverTimestamp(),
              ...(nextRemainingChances <= 0 && { depletedAt: FieldValue.serverTimestamp() }),
            });
          });
          
          // Transaction succeeded, break out of retry loop
          console.log(`[Token Transaction] Success after ${retryCount + 1} attempt(s)`);
          break;
        } catch (err: any) {
          retryCount++;
          // If it's a transaction conflict, retry
          if (err.code === "failed-precondition" && retryCount < maxRetries) {
            const backoffMs = 100 * Math.pow(2, retryCount - 1); // Exponential backoff
            console.warn(`[Token Transaction] Conflict detected, retrying (${retryCount}/${maxRetries}) after ${backoffMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            continue;
          }
          // For other errors or max retries reached, throw
          console.error(`[Token Transaction] Failed after ${retryCount} attempts:`, err);
          throw err;
        }
      }
      
      // Update state immediately after successful transaction - this is critical
      // Always use the value from the transaction, not from previous state
      console.log(`[State Update] Transaction completed: ${actualRemainingBefore} -> ${nextRemainingChances}`);
      if (nextRemainingChances < 0) {
        console.error("[State Update] Invalid remaining chances from transaction:", nextRemainingChances);
        setChancesFromToken(0);
      } else {
        // Directly set the value from transaction - this is the source of truth
        console.log(`[State Update] Setting chancesFromToken to ${nextRemainingChances}`);
        setChancesFromToken(nextRemainingChances);
      }
      
      // Allow listener to update again after we've set the state from transaction
      isTransactionInProgressRef.current = false;

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

      // Run lottery transaction - if this fails, we should NOT consume the token chance
      // So we do this AFTER the token transaction succeeds
      // In event mode, we skip the normal participation limit check since we use token chances instead
      console.log("[handleLotteryStart] About to call runLotteryTransaction", {
        campaignId,
        userId: auth.currentUser?.uid,
        remainingChances: nextRemainingChances,
        stack: new Error().stack,
      });
      let result: Participant;
      try {
        result = await runLotteryTransaction({
          campaignId,
          user: auth.currentUser,
          alreadyWonPrizeIds: new Set(),
          pendingAnswers: {},
          lastParticipationTime,
          skipParticipationLimitCheck: true, // Event mode uses token chances, not normal participation limits
        });
      } catch (lotteryError: any) {
        console.error("[Lottery] Lottery transaction failed:", lotteryError);
        // If lottery fails, we need to ROLLBACK the token consumption
        // Re-increment the remainingChances
        try {
          // Temporarily allow listener updates during rollback, but block them
          isTransactionInProgressRef.current = true;
          await db.runTransaction(async (rollbackTransaction: any) => {
            const tokenDoc = await rollbackTransaction.get(tokenRef);
            if (tokenDoc.exists) {
              const currentRemaining = tokenDoc.data().remainingChances || 0;
              rollbackTransaction.update(tokenRef, {
                remainingChances: currentRemaining + 1,
              });
              console.log(`[Rollback] Restored token chance: ${currentRemaining} -> ${currentRemaining + 1}`);
            }
          });
          // Update state to reflect rollback
          setChancesFromToken((prev) => prev + 1);
          isTransactionInProgressRef.current = false;
        } catch (rollbackError) {
          console.error("[Rollback] Failed to rollback token consumption:", rollbackError);
          isTransactionInProgressRef.current = false;
        }
        // Re-throw the lottery error
        throw lotteryError;
      }

      const resultRef = db
        .collection("campaigns")
        .doc(campaignId)
        .collection("eventResults")
        .doc();
      const winningResults = result.prizeId !== "loss" ? [result] : [];
      const resultsToSave =
        winningResults.length > 0 ? winningResults : [result];

      await resultRef.set({
        results: resultsToSave.map((r) => ({
          prize: r.prizeDetails,
          isConsolation: !!r.isConsolationPrize,
        })),
        wonAt: FieldValue.serverTimestamp(),
        userId: auth.currentUser.uid,
        tokenId: token,
        remainingChances: nextRemainingChances,
      });

      setPrizeResult(result.prizeDetails);

      // After showing result, transition back to ready state so user can draw again if chances remain
      // The state chancesFromToken is already updated above, so it will be correct when ready state is shown
      console.log(`[State Transition] Moving to fading, remaining chances: ${nextRemainingChances}`);
      setTimeout(() => {
        setEventState("fading");
      }, 3000);
      
      // After fading, go to result, then after countdown, user is redirected
      // But if they somehow stay, we need to ensure state is correct
    } catch (err: any) {
      console.error("Lottery error:", err);
      // Always reset processing flags on error
      isProcessingRef.current = false;
      isTransactionInProgressRef.current = false;
      if (err.message === "NO_CHANCES_LEFT") {
        setError(
          "このQRコードの参加可能回数は終了しました。モニターで新しいQRコードをスキャンしてください。",
        );
        // Update state to 0 when chances are depleted
        setChancesFromToken(0);
      } else if (err.message === "PARTICIPATION_LIMIT_REACHED") {
        // In event mode, this should not happen, but if it does, show a more appropriate message
        // The token chances should be the only limit in event mode
        console.warn("[Event Mode] PARTICIPATION_LIMIT_REACHED error detected - this should not happen in event mode");
        setError(
          "抽選に失敗しました。モニターで新しいQRコードをスキャンしてください。",
        );
      } else {
        setError(err.message || "抽選に失敗しました。");
      }
      // Always reset to ready state on error so user can try again or see the error
      setEventState("ready");
    }
  }, [campaign, campaignId, token, timeLeft, eventState]);

  useEffect(() => {
    if (eventState === "fading") {
      const timer = setTimeout(() => {
        setEventState("result");
        sessionStorage.setItem("eventParticipationDone", "true");
        // Reset processing flag when transitioning to result
        // Note: isTransactionInProgressRef should already be false at this point
        isProcessingRef.current = false;
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [eventState]);

  // Use a ref to track if we've already set up the result state handler for the current result state
  // This prevents the effect from running multiple times when chancesFromToken changes
  const resultStateHandledRef = useRef(false);
  // Use a ref to store the chances value when entering result state
  const chancesAtResultRef = useRef<number | null>(null);

  useEffect(() => {
    if (eventState === "result") {
      // Only handle result state once per transition to "result"
      // This prevents re-running when chancesFromToken changes
      if (resultStateHandledRef.current) {
        return;
      }
      resultStateHandledRef.current = true;
      
      // Capture the current chancesFromToken value at the time of entering result state
      // Store it in a ref so we can use it later without depending on chancesFromToken
      chancesAtResultRef.current = chancesFromToken;
      const currentChances = chancesFromToken;
      
      console.log(`[Result State] Entered result state with ${currentChances} chances remaining`);
      
      if (currentChances <= 0) {
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
      } else {
        // If chances remain, allow user to continue - transition back to ready after showing result
        // DO NOT automatically start the next draw - user must click the button
        const timer = setTimeout(() => {
          console.log(`[State] Returning to ready state, remaining chances: ${currentChances}`);
          // Ensure processing flags are reset before allowing next draw
          isProcessingRef.current = false;
          isTransactionInProgressRef.current = false;
          setEventState("ready");
          setPrizeResult(null);
          // Reset the flag when transitioning back to ready so next result state can be handled
          resultStateHandledRef.current = false;
          chancesAtResultRef.current = null;
        }, 5000); // Show result for 5 seconds, then allow next draw
        return () => clearTimeout(timer);
      }
    } else {
      // Reset the flag when we're not in result state
      resultStateHandledRef.current = false;
      chancesAtResultRef.current = null;
    }
  }, [eventState, navigate, campaignId]); // Removed chancesFromToken to prevent re-running when it changes

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
        const fullButtonText = buttonText;
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
              type="button" // Explicitly set to prevent form submission behavior
              ref={buttonRef}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("========== [Button] CLICKED ==========", {
                  eventState,
                  chancesFromToken,
                  isProcessing: isProcessingRef.current,
                  timeLeft,
                  isTrusted: e.isTrusted, // Browser-generated events have isTrusted: false
                  timestamp: new Date().toISOString(),
                });
                // Double-check conditions before calling - use ref to prevent race conditions
                // Only allow user-initiated clicks (isTrusted: true)
                if (e.isTrusted && eventState === "ready" && !isProcessingRef.current && chancesFromToken > 0 && timeLeft !== 0) {
                  console.log("[Button] Conditions met, calling handleLotteryStart");
                  handleLotteryStart();
                } else {
                  console.warn("========== [Button] CLICK BLOCKED ==========", { 
                    isTrusted: e.isTrusted,
                    eventState, 
                    isProcessing: isProcessingRef.current,
                    chancesFromToken, 
                    timeLeft 
                  });
                }
              }}
              disabled={eventState !== "ready" || isProcessingRef.current || chancesFromToken <= 0 || timeLeft === 0}
              autoFocus={false} // Prevent automatic focus
              style={{ backgroundColor: themeColor }}
              className="w-full max-w-sm mx-auto text-white font-bold py-6 px-8 rounded-full text-2xl transition-all duration-300 ease-in-out shadow-lg hover:shadow-2xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {fullButtonText}
            </button>
            {chancesFromToken > 0 && (
              <p className="text-center text-slate-500 mt-3 text-sm">
                このQRコードで残り
                <span className="font-semibold mx-1 text-slate-700">
                  {chancesFromToken}
                </span>
                回参加できます。
              </p>
            )}
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
              {chancesFromToken > 0 ? (
                <p className="text-slate-600 text-sm mt-6">
                  残り
                  <span className="font-bold mx-1" style={{ color: themeColor }}>
                    {chancesFromToken}
                  </span>
                  回抽選できます。しばらくすると次の抽選が可能になります。
                </p>
              ) : (
                countdownText
              )}
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
            {chancesFromToken > 0 ? (
              <p className="text-slate-600 text-sm mt-6">
                残り
                <span className="font-bold mx-1" style={{ color: themeColor }}>
                  {chancesFromToken}
                </span>
                回抽選できます。しばらくすると次の抽選が可能になります。
              </p>
            ) : (
              countdownText
            )}
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

