import { useState, useEffect, useRef, useCallback } from "react";
import { db, auth, functions } from "../../firebase";
import type {
  Campaign,
  ClaimedTicket,
  Participant,
  ParticipationRequest,
} from "../../types";
import { useSearchParams } from "react-router-dom";
import { captureException } from "@sentry/react";
import { clearAllCampaignAuth, setCampaignAuth } from "../../utils/campaignAuth";

export const useCampaignData = (campaignId: string | undefined) => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error_description = searchParams.get("error_description");

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);

  const [allParticipantRecords, setAllParticipantRecords] = useState<
    Participant[]
  >([]);
  const [participantRecord, setParticipantRecord] =
    useState<Participant | null>(null);
  const [participationCount, setParticipationCount] = useState(0);
  const [extraChances, setExtraChances] = useState(0);
  const [userParticipationRequest, setUserParticipationRequest] =
    useState<ParticipationRequest | null>(null);
  const [lastTicketToken, setlastTicketToken] = useState<string | null>(null);
  const isRequiredTicket = campaign?.requireTicket || false;
  const hasTicket = !campaign?.requireTicket || lastTicketToken !== null;
  const [nextAvailableTime, setNextAvailableTime] = useState<Date | null>(null);
  const [timeLeftMessage, setTimeLeftMessage] = useState<string>("");
  const intervalTimerRef = useRef<number | null>(null);
  const campaignRef = useRef(campaign);

  useEffect(() => {
    campaignRef.current = campaign;
  }, [campaign]);

  const loadParticipantData = useCallback(async (preserveCurrentRecord: boolean = false) => {
    const currentUser = user;
    const currentCampaign = campaign;

    if (!campaignId || !currentUser || !currentCampaign) {
      setAllParticipantRecords([]);
      if (!preserveCurrentRecord) {
      setParticipantRecord(null);
      }
      setParticipationCount(0);
      setExtraChances(0);
      setUserParticipationRequest(null);
      return;
    }

    if (currentCampaign.requireTicket) {
      try {
        const claimedTicketsQuery = db
          .collection("campaigns")
          .doc(campaignId)
          .collection("overrides")
          .doc(currentUser.uid)
          .collection("claimedTickets")
          .orderBy("claimedAt", "desc")
          .limit(1);
        const ticketSnap = await claimedTicketsQuery.get();
        const ticketDoc = ticketSnap.docs[0];
        const ticketData = ticketSnap.empty
          ? null
          : ({
              ...ticketDoc.data(),
              id: ticketDoc.id,
              claimedAt: ticketDoc.data().claimedAt?.toDate(),
            } as ClaimedTicket);
        if (ticketData) {
          setlastTicketToken(ticketData.id);
        }
      } catch (e) {
        console.warn("Could not check for ticket", e);
      }
    }

    try {
      const participantsRef = db
        .collection("participants")
        .where("campaignId", "==", campaignId)
        .where("userId", "==", currentUser.uid);
      const snapshot = await participantsRef.get();
      setParticipationCount(snapshot.size);

      if (!snapshot.empty) {
        const records = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              wonAt: data.wonAt?.toDate(),
            } as Participant;
          })
          .sort(
            (a, b) => (b.wonAt?.getTime() || 0) - (a.wonAt?.getTime() || 0),
          );
        setAllParticipantRecords(records);
        // Set participantRecord to the most recent record (including losses)
        // This ensures the modal can transition to result step even for losses
        setParticipantRecord(records[0] || null);
        
        // Calculate next available participation time based on interval restriction
        const lastParticipation = records[0]; // Most recent participation (sorted by wonAt desc)
        if (lastParticipation?.wonAt && currentCampaign) {
          const intervalHours = currentCampaign.participationIntervalHours || 0;
          const intervalMinutes = currentCampaign.participationIntervalMinutes || 0;
          
          if (intervalHours > 0 || intervalMinutes > 0) {
            const intervalMs = (intervalHours * 60 + intervalMinutes) * 60 * 1000;
            const lastWonAt = lastParticipation.wonAt.getTime();
            const nextAvailable = new Date(lastWonAt + intervalMs);
            const now = Date.now();
            
            if (nextAvailable.getTime() > now) {
              setNextAvailableTime(nextAvailable);
            } else {
              setNextAvailableTime(null);
            }
          } else {
            setNextAvailableTime(null);
          }
        } else {
          setNextAvailableTime(null);
        }
      } else {
        setAllParticipantRecords([]);
        setParticipantRecord(null);
        setNextAvailableTime(null);
      }
    } catch (e) {
      console.warn("Could not read participation history.", e);
    }

    try {
      const overrideRef = db
        .collection("campaigns")
        .doc(campaignId)
        .collection("overrides")
        .doc(currentUser.uid);
      const snap = await overrideRef.get();
      setExtraChances(snap.exists ? snap.data()?.extraChances || 0 : 0);
    } catch (e) {
      console.warn("Could not check for overrides.", e);
    }

    if (currentCampaign.requireFormApproval) {
      try {
        const reqQuery = db
          .collection("participationRequests")
          .where("userId", "==", currentUser.uid);
        const snap = await reqQuery.get();
        if (snap.empty) {
          setUserParticipationRequest(null);
        } else {
          const allUserRequests = snap.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate(),
            } as ParticipationRequest;
          });
          const campaignRequests = allUserRequests.filter(
            (req) => req.campaignId === campaignId,
          );
          if (campaignRequests.length > 0) {
            campaignRequests.sort(
              (a, b) =>
                (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0),
            );
            setUserParticipationRequest(campaignRequests[0]);
          } else {
            setUserParticipationRequest(null);
          }
        }
      } catch (e) {
        console.warn("Could not check for approval request.", e);
        setUserParticipationRequest(null);
      }
    }
  }, [campaign, user, campaignId]);

  useEffect(() => {
    const authUnsubscribe = auth.onAuthStateChanged((newUser: any) => {
      setUser(newUser);
      // Clear campaign auth when user signs out
      if (!newUser) {
        clearAllCampaignAuth();
      }
    });
    return () => authUnsubscribe();
  }, []);

  // Note: LINE OAuth callback is now handled by LineAuthCallback component
  // This code is kept for backward compatibility but should not be triggered
  // if the callback route is properly configured
  useEffect(() => {
    // Only handle callback if we're not on the dedicated callback route
    if (window.location.pathname === "/auth/line/callback") {
      return;
    }

    async function createLINEAuthCustomToken(code: string, state: string) {
      try {
        const storedState = window.localStorage.getItem("lineOAuthState");
        if (!storedState || state !== storedState) {
          throw new Error("Invalid state parameter - possible CSRF attack");
        }

        // Use the same redirect URI as in the authorization request
        const redirectUri = `${window.location.origin}/auth/line/callback`;
        
        const createToken = functions.httpsCallable(
          "createFirebaseAuthCustomToken",
        );
        const result = await createToken({
          code,
          redirectUri,
        });
        const firebaseCustomToken = result.data.customToken;
        await auth.signInWithCustomToken(firebaseCustomToken);
        
        // Get return URL before processing
        const returnUrl = window.localStorage.getItem("lineReturnUrl");
        
        // Mark campaign as authenticated (before redirect)
        const campaignIdFromUrl = returnUrl ? new URL(returnUrl).pathname.match(/\/campaign\/([^/]+)/)?.[1] : null;
        const storedCampaignId = window.localStorage.getItem("pendingCampaignAuth");
        if (storedCampaignId) {
          setCampaignAuth(storedCampaignId);
          window.localStorage.removeItem("pendingCampaignAuth");
        } else if (campaignIdFromUrl) {
          setCampaignAuth(campaignIdFromUrl);
        }
        
        // Redirect to the stored return URL if it exists
        if (returnUrl) {
          // Remove query parameters from return URL to avoid duplicates
          const returnUrlObj = new URL(returnUrl);
          returnUrlObj.search = ""; // Clear existing search params
          window.location.href = returnUrlObj.toString();
          return; // Exit early since we're redirecting
        }
      } catch (e) {
        setError("LINEログイン中にエラーが発生しました。");
        captureException(e, { level: "error" });
      } finally {
        window.localStorage.removeItem("lineOAuthState");
        window.localStorage.removeItem("lineReturnUrl");
      }
    }

    if (code && state) {
      setLoading(true);
      createLINEAuthCustomToken(code, state)
        .catch((error) => {
          setError("LINEログイン中にエラーが発生しました。");
          captureException(error, { level: "error" });
        })
        .finally(() => {
          // Only clean up URL if we're not redirecting
          if (!window.localStorage.getItem("lineReturnUrl")) {
          setLoading(false);
          const url = new URL(window.location.href);
          url.searchParams.delete("code");
          url.searchParams.delete("state");
          url.searchParams.delete("error");
          url.searchParams.delete("error_description");
          window.history.replaceState({}, document.title, url.toString());
          }
        });
    }
  }, [code, state]);

  useEffect(() => {
    if (error_description) {
      setError("LINEログイン中にエラーが発生しました。");
      captureException(new Error(error_description), { level: "error" });
    }
  }, [error_description]);

  useEffect(() => {
    if (!campaignId) {
      setError("キャンペーンIDが無効です。");
      setLoading(false);
      return;
    }

    const campaignDocRef = db.collection("campaigns").doc(campaignId);
    const campaignUnsubscribe = campaignDocRef.onSnapshot(
      (doc: any) => {
        if (!doc.exists || doc.data().status !== "published") {
          setError(
            doc.exists
              ? "このキャンペーンは現在公開されていません。"
              : "キャンペーンが見つかりませんでした。",
          );
          setCampaign(null);
          setLoading(false);
          return;
        }
        const data = doc.data();
        const now = new Date();
        const publishStartDate = data.publishStartDate?.toDate();
        const publishEndDate = data.publishEndDate?.toDate();

        if (
          (publishStartDate && now < publishStartDate) ||
          (publishEndDate && now > publishEndDate)
        ) {
          setError(
            data.publishPeriodOutOfRangeMessage ||
              "このキャンペーンは現在公開期間外です。",
          );
          setCampaign(null);
        } else {
          const campaignData = {
            id: doc.id,
            ...data,
            publishStartDate,
            publishEndDate,
            applicationStartDate: data.applicationStartDate?.toDate(),
            applicationEndDate: data.applicationEndDate?.toDate(),
            createdAt: data.createdAt?.toDate(),
            prizes: (data.prizes || []).map((p: any) => ({
              ...p,
              validFrom: p.validFrom?.toDate(),
              validTo: p.validTo?.toDate(),
            })),
            consolationPrize: data.consolationPrize
              ? {
                  ...data.consolationPrize,
                  validFrom: data.consolationPrize.validFrom?.toDate(),
                  validTo: data.consolationPrize.validTo?.toDate(),
                }
              : null,
          } as Campaign;

          setCampaign(campaignData);
          setError(null);
        }

        if (code && state) {
          // LINEログイン処理中はloadingを維持
          return;
        }

        setLoading(false);
      },
      (err: any) => {
        setError("キャンペーンの読み込み中にエラーが発生しました。");
        setLoading(false);
        captureException(err, { level: "error" });
      },
    );

    return () => campaignUnsubscribe();
  }, [campaignId]);

  useEffect(() => {
    loadParticipantData();
  }, [user, campaign, loadParticipantData]);

  useEffect(() => {
    if (campaign?.designSettings) {
      const { themeColor, background } = campaign.designSettings;
      const root = document.documentElement;
      if (themeColor) root.style.setProperty("--theme-color", themeColor);
      if (background?.type === "image" && background.imageUrl) {
        document.body.style.backgroundImage = `url(${background.imageUrl})`;
        document.body.style.backgroundSize = "cover";
        document.body.style.backgroundPosition = "center";
      } else if (background?.type === "color" && background.color) {
        document.body.style.backgroundColor = background.color;
      }
    }
  }, [campaign?.designSettings]);

  useEffect(() => {
    if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
    if (nextAvailableTime) {
      const update = () => {
        const remaining = nextAvailableTime.getTime() - Date.now();
        if (remaining <= 0) {
          setNextAvailableTime(null);
          setTimeLeftMessage("");
          if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
        } else {
          const remainingHours = Math.floor(remaining / (60 * 60 * 1000));
          const remainingMinutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
          const remainingSeconds = Math.floor((remaining % (60 * 1000)) / 1000);
          
          let timeMessage = "次回参加可能まで: ";
          if (remainingHours > 0) {
            timeMessage += `${remainingHours}時間`;
            if (remainingMinutes > 0) {
              timeMessage += `${remainingMinutes}分`;
            }
          } else if (remainingMinutes > 0) {
            timeMessage += `${remainingMinutes}分`;
            if (remainingSeconds > 0) {
              timeMessage += `${remainingSeconds}秒`;
            }
          } else {
            timeMessage += `${remainingSeconds}秒`;
          }
          
          setTimeLeftMessage(timeMessage);
        }
      };
      update();
      // Update every second for better UX when close to the time
      intervalTimerRef.current = window.setInterval(update, 1000);
    } else {
      setTimeLeftMessage("");
    }
    return () => {
      if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
    };
  }, [nextAvailableTime]);

  return {
    campaign,
    loading,
    error,
    user,
    campaignRef,
    allParticipantRecords,
    setAllParticipantRecords,
    participantRecord,
    setParticipantRecord,
    participationCount,
    setParticipationCount,
    extraChances,
    userParticipationRequest,
    setUserParticipationRequest,
    lastTicketToken,
    isRequiredTicket,
    hasTicket,
    nextAvailableTime,
    timeLeftMessage,
    loadParticipantData,
  };
};
