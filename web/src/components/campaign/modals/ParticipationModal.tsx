import React, { useRef, useEffect } from "react";
import type { Prize } from "../../../types";
import Spinner from "../../Spinner";
import PrizeDisplay from "../PrizeDisplay";
import { useCampaignPage } from "../../../pages/useCampaignPage";
import AuthFlow from "../AuthFlow";
import { captureException } from "@sentry/react";

type ParticipationModalProps = ReturnType<typeof useCampaignPage>;

const ParticipationModal: React.FC<ParticipationModalProps> = (props) => {
  const {
    modalStep,
    closeModal,
    campaign,
    promptToSaveResult,
    setModalStep,
    handleConfirmAndParticipate,
    questionnaireError,
    termsAgreed,
    setTermsAgreed,
    questionnaireAnswers,
    handleAnswerChange,
    participantRecord,
    multipleLotteryResults,
    handleShowPrizeDetails,
    getContrastingTextColor,
    presentationTexts,
    lastTicketToken,
  } = props;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (
      modalStep === "participating" &&
      (participantRecord ||
        (multipleLotteryResults && multipleLotteryResults.length > 0))
    ) {
      const videoElement = videoRef.current;
      const drawingVideoUrl =
        campaign?.presentationSettings?.animationSettings
          ?.drawingAnimationVideoUrl;

      if (drawingVideoUrl && videoElement) {
        const handleVideoEnd = () => {
          setModalStep("result");
        };
        videoElement.addEventListener("ended", handleVideoEnd);
        if (videoElement.ended) {
          // Handle case where video is already ended
          handleVideoEnd();
        }
        return () => videoElement.removeEventListener("ended", handleVideoEnd);
      } else {
        const timer = setTimeout(() => {
          setModalStep("result");
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [
    modalStep,
    participantRecord,
    multipleLotteryResults,
    campaign,
    setModalStep,
  ]);

  const handleParticipateClick = () => {
    const soundUrl =
      campaign?.presentationSettings?.soundSettings?.participationSoundUrl;
    if (soundUrl && campaign?.presentationSettings?.soundSettings?.enabled) {
      new Audio(soundUrl).play().catch((e) => {
        captureException(e, { level: "error" });
      });
    }
    handleConfirmAndParticipate();
  };

  useEffect(() => {
    const settings = campaign?.presentationSettings?.soundSettings;
    if (!settings?.enabled) return;

    const stopSound = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };

    let soundUrl: string | undefined;
    let loop = false;

    if (modalStep === "participating") {
      soundUrl = settings.drawingSoundUrl;
      loop = true;
    } else if (modalStep === "result") {
      const isMultiple =
        multipleLotteryResults && multipleLotteryResults.length > 0;
      let playWinSound = false; // Default to lose sound

      if (isMultiple) {
        // If there's any result that isn't a "loss" and is explicitly not a consolation prize, play the win sound.
        playWinSound = multipleLotteryResults.some(
          (r) => r.prizeId !== "loss" && r.isConsolationPrize === false,
        );
      } else {
        // For a single result, play win sound if it's not a "loss" and explicitly not a consolation prize.
        playWinSound = !!(
          participantRecord &&
          participantRecord.prizeId !== "loss" &&
          participantRecord.isConsolationPrize === false
        );
      }

      soundUrl = playWinSound ? settings.winSoundUrl : settings.loseSoundUrl;
    }

    if (soundUrl) {
      stopSound();
      audioRef.current = new Audio(soundUrl);
      audioRef.current.loop = loop;
      audioRef.current.play().catch((e) => {
        captureException(e, { level: "error" });
      });
    } else {
      stopSound();
    }

    return stopSound;
  }, [modalStep, campaign, participantRecord, multipleLotteryResults]);

  const renderModalContent = () => {
    const animSettings = campaign?.presentationSettings?.animationSettings;

    switch (modalStep) {
      case "auth":
        return (
          <AuthFlow
            campaign={campaign!}
            lastTicketToken={lastTicketToken}
            isSavingResult={promptToSaveResult}
            closeModal={closeModal}
            setModalStep={setModalStep}
          />
        );

      case "confirm":
        const termsContent =
          campaign?.pageContent?.termsOfServiceEnabled &&
          campaign.pageContent.termsOfServiceContent
            ? campaign.pageContent.termsOfServiceContent
            : campaign?.pageContent?.participationGuideType === "custom_text"
              ? campaign.pageContent.participationGuideCustomText
              : "";

        const hasTerms = !!termsContent?.trim();
        return (
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-6">
              参加前の確認
            </h2>
            {campaign?.questionnaireFields &&
              campaign.questionnaireFields.length > 0 && (
                <div className="mb-6 bg-slate-50 p-4 rounded-lg shadow-inner border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">
                    アンケートにご協力ください
                  </h3>
                  <div className="space-y-4 max-h-72 overflow-y-auto pr-2">
                    {campaign.questionnaireFields.map((field) => (
                      <div key={field.id}>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          {field.question}
                          {field.required && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </label>
                        {field.type === "text" && (
                          <input
                            type="text"
                            value={
                              (questionnaireAnswers[field.id] as string) || ""
                            }
                            onChange={(e) =>
                              handleAnswerChange(
                                field.id,
                                field.type,
                                e.target.value,
                              )
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm"
                          />
                        )}
                        {field.type === "textarea" && (
                          <textarea
                            value={
                              (questionnaireAnswers[field.id] as string) || ""
                            }
                            onChange={(e) =>
                              handleAnswerChange(
                                field.id,
                                field.type,
                                e.target.value,
                              )
                            }
                            rows={3}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm"
                          />
                        )}
                        {field.type === "select" && (
                          <select
                            value={
                              (questionnaireAnswers[field.id] as string) || ""
                            }
                            onChange={(e) =>
                              handleAnswerChange(
                                field.id,
                                field.type,
                                e.target.value,
                              )
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm bg-white"
                          >
                            <option value="">選択してください</option>
                            {(field.options || []).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        )}
                        {field.type === "radio" && (
                          <div className="space-y-1">
                            {(field.options || []).map((opt) => (
                              <label
                                key={opt}
                                className="flex items-center gap-2 text-sm text-slate-600"
                              >
                                <input
                                  type="radio"
                                  name={field.id}
                                  value={opt}
                                  checked={
                                    (questionnaireAnswers[
                                      field.id
                                    ] as string) === opt
                                  }
                                  onChange={(e) =>
                                    handleAnswerChange(
                                      field.id,
                                      field.type,
                                      e.target.value,
                                    )
                                  }
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                        )}
                        {field.type === "checkbox" && (
                          <div className="space-y-1">
                            {(field.options || []).map((opt) => (
                              <label
                                key={opt}
                                className="flex items-center gap-2 text-sm text-slate-600"
                              >
                                <input
                                  type="checkbox"
                                  value={opt}
                                  checked={(
                                    (questionnaireAnswers[
                                      field.id
                                    ] as string[]) || []
                                  ).includes(opt)}
                                  onChange={(e) =>
                                    handleAnswerChange(
                                      field.id,
                                      field.type,
                                      e.target.value,
                                      e.target.checked,
                                    )
                                  }
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            {hasTerms && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                  キャンペーン規約
                </h3>
                <div className="prose prose-sm max-h-32 overflow-y-auto p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-slate-600 whitespace-pre-wrap">
                    {termsContent}
                  </p>
                </div>
                <label className="flex items-center gap-3 mt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAgreed}
                    onChange={(e) => setTermsAgreed(e.target.checked)}
                    className="h-5 w-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    利用規約に同意する
                  </span>
                </label>
              </div>
            )}
            {questionnaireError && (
              <p className="text-sm text-red-600 mt-4 text-center">
                {questionnaireError}
              </p>
            )}
            <div className="mt-8">
              <button
                onClick={handleParticipateClick}
                style={{ backgroundColor: "var(--theme-color, #4F46E5)" }}
                disabled={hasTerms && !termsAgreed}
                className="w-full px-6 py-3 text-white font-semibold rounded-lg hover:opacity-90 transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed"
              >
                {presentationTexts.agreeAndParticipate}
              </button>
            </div>
          </div>
        );
      case "participating":
        const drawingVideo = animSettings?.drawingAnimationVideoUrl;
        const drawingImage = animSettings?.drawingAnimationImageUrl;
        return (
          <div className="text-center py-8 flex flex-col items-center justify-center min-h-[300px]">
            {drawingVideo ? (
              <video
                ref={videoRef}
                src={drawingVideo}
                autoPlay
                muted
                playsInline
                className="h-20 w-auto mx-auto rounded-lg mb-4"
              ></video>
            ) : drawingImage ? (
              <img
                src={drawingImage}
                alt="抽選中"
                className="h-20 w-auto mx-auto mb-4"
              />
            ) : (
              <div className="flex justify-center items-center h-20">
                <Spinner
                  size="lg"
                  color={campaign?.designSettings?.themeColor || "#4F46E5"}
                />
              </div>
            )}
            <p
              style={{ color: "var(--theme-color, #4F46E5)" }}
              className="text-xl font-bold mt-4 animate-pulse"
            >
              {presentationTexts.drawing}
            </p>
          </div>
        );
      case "result":
        const isMultipleResult =
          multipleLotteryResults && multipleLotteryResults.length > 0;
        if (isMultipleResult) {
          const summary = multipleLotteryResults.reduce(
            (acc, result) => {
              const prize = result.prizeDetails;
              const key = prize.id;
              if (!acc[key]) {
                acc[key] = {
                  prize,
                  count: 0,
                  isConsolationPrize: !!result.isConsolationPrize,
                };
              }
              acc[key].count++;
              return acc;
            },
            {} as Record<
              string,
              { prize: Prize; count: number; isConsolationPrize: boolean }
            >,
          );

          const summaryArray = Object.values(summary).sort((a, b) => {
            const getSortScore = (item: {
              prize: Prize;
              count: number;
              isConsolationPrize: boolean;
            }) => {
              if (item.prize.id === "loss") return 3; // 3: ハズレ
              if (item.isConsolationPrize) return 2; // 2: 参加賞
              return 1; // 1: 当選景品
            };

            const scoreA = getSortScore(a);
            const scoreB = getSortScore(b);

            if (scoreA !== scoreB) {
              return scoreA - scoreB;
            }

            if (scoreA === 1) {
              return (a.prize.rank || "").localeCompare(b.prize.rank || "");
            }

            return 0;
          });

          const hasWin = summaryArray.some(
            (item) =>
              item.isConsolationPrize === false && item.prize.id !== "loss",
          );
          const resultVideo = hasWin
            ? animSettings?.winAnimationVideoUrl
            : animSettings?.loseAnimationVideoUrl;
          const resultImage = hasWin
            ? animSettings?.winAnimationImageUrl
            : animSettings?.loseAnimationImageUrl;

          return (
            <div className="text-center flex flex-col items-center animate-fade-in w-full">
              {resultVideo ? (
                <video
                  src={resultVideo}
                  autoPlay
                  muted
                  playsInline
                  className="h-20 w-auto mx-auto rounded-lg mb-4"
                ></video>
              ) : resultImage ? (
                <img
                  src={resultImage}
                  alt="結果"
                  className="h-20 w-auto mx-auto mb-4"
                />
              ) : null}
              <h2 className="text-2xl font-bold text-slate-800">
                {hasWin
                  ? "おめでとうございます！"
                  : presentationTexts.resultTitle}
              </h2>
              <p className="text-slate-500 mt-1 mb-4">
                {presentationTexts.multipleResultsText(
                  multipleLotteryResults.length,
                )}
              </p>
              <div className="w-full mt-2 space-y-3 max-h-[50vh] overflow-y-auto p-1">
                {summaryArray.map(({ prize, count, isConsolationPrize }) => {
                  const isLoss = prize.id === "loss";
                  const firstParticipantRecord = multipleLotteryResults.find(
                    (p) => p.prizeId === prize.id,
                  );
                  const textColorClass = getContrastingTextColor(
                    prize.rankColor || "#6366F1",
                  );

                  if (isLoss) {
                    return (
                      <div
                        key={prize.id}
                        className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-center"
                      >
                        <p className="font-semibold text-slate-700">
                          ハズレ{" "}
                          <span className="font-bold text-xl ml-2">
                            x {count}
                          </span>
                        </p>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={prize.id}
                      onClick={() =>
                        firstParticipantRecord &&
                        handleShowPrizeDetails(
                          firstParticipantRecord.prizeDetails,
                        )
                      }
                      className="w-full text-left p-3 bg-white border border-slate-200 rounded-lg flex items-center gap-4 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      <img
                        src={
                          prize.imageUrl || "https://via.placeholder.com/150"
                        }
                        alt={prize.title}
                        className="w-16 h-16 object-cover rounded-md flex-shrink-0 bg-slate-100"
                      />
                      <div className="flex-grow">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${textColorClass}`}
                            style={{
                              backgroundColor: prize.rankColor || "#6366F1",
                            }}
                          >
                            {prize.rank}
                          </span>
                          {isConsolationPrize && (
                            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full">
                              参加賞
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-slate-800 mt-1">
                          {prize.title}
                        </h4>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm text-slate-500">当選数</p>
                        <p className="font-bold text-xl text-slate-800">
                          {count}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-4">
                {presentationTexts.resultNote}
              </p>
            </div>
          );
        }
        const isWin =
          participantRecord &&
          participantRecord.prizeId !== "loss" &&
          participantRecord.isConsolationPrize === false;
        const resultVideo = isWin
          ? animSettings?.winAnimationVideoUrl
          : animSettings?.loseAnimationVideoUrl;
        const resultImage = isWin
          ? animSettings?.winAnimationImageUrl
          : animSettings?.loseAnimationImageUrl;

        return (
          <div className="text-center flex flex-col items-center animate-fade-in w-full">
            {resultVideo ? (
              <video
                src={resultVideo}
                autoPlay
                muted
                playsInline
                className="h-20 w-auto mx-auto rounded-lg mb-4"
              ></video>
            ) : resultImage ? (
              <img
                src={resultImage}
                alt="結果"
                className="h-20 w-auto mx-auto mb-4"
              />
            ) : null}

            {participantRecord &&
            campaign &&
            participantRecord.prizeId !== "loss" ? (
              <PrizeDisplay
                {...props}
                participantRecord={participantRecord}
                campaign={campaign}
                showInteractionButton={false}
              />
            ) : (
              <>
                <h2 className="text-2xl font-bold text-slate-800">
                  残念、ハズレです
                </h2>
                <p className="text-slate-500 mt-2">
                  またの挑戦をお待ちしております。
                </p>
              </>
            )}
            {promptToSaveResult && (
              <div className="mt-6 p-4 w-full bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-center">
                <p className="text-indigo-800 font-semibold mb-3">
                  抽選結果を保存しますか？
                </p>
                <p className="text-indigo-700 text-xs mb-4">
                  ユーザー認証をすると、この結果がアカウントに紐付けられ、後からでも確認できるようになります。
                </p>
                <button
                  onClick={() => setModalStep("auth")}
                  style={{ backgroundColor: "var(--theme-color, #4F46E5)" }}
                  className="w-full text-white font-bold py-2 px-4 rounded-md hover:opacity-90 transition-colors text-sm"
                >
                  ユーザー認証へ進む
                </button>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && modalStep !== "participating")
          closeModal();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full transform transition-all duration-300 scale-95 animate-modal-pop max-h-[85vh] relative flex flex-col">
        {modalStep !== "participating" && (
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-800 bg-white/60 backdrop-blur-sm rounded-full transition-colors z-20"
            aria-label="閉じる"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
        <div className="overflow-y-auto px-6 pb-6 pt-12 sm:px-8 sm:pb-8 sm:pt-12">
          {renderModalContent()}
        </div>
      </div>
    </div>
  );
};

export default ParticipationModal;
