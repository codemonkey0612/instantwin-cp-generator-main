import React from "react";

interface LoginPromptBannerProps {
  onLoginClick: () => void;
  saveResultPrompt: string;
}

const LoginPromptBanner: React.FC<LoginPromptBannerProps> = ({
  onLoginClick,
  saveResultPrompt,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-4 border-t border-slate-200 shadow-lg animate-fade-in-up z-40">
      <div className="max-w-md mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-slate-700 text-center sm:text-left">
          <span className="font-semibold">{saveResultPrompt}</span>
          <br />
          ユーザー認証で結果をアカウントに保存できます。
        </p>
        <button
          onClick={onLoginClick}
          style={{ backgroundColor: "var(--theme-color, #4F46E5)" }}
          className="w-full sm:w-auto flex-shrink-0 px-6 py-2.5 text-white font-semibold rounded-lg hover:opacity-90 transition-colors shadow-md"
        >
          ユーザー認証
        </button>
      </div>
    </div>
  );
};

export default LoginPromptBanner;
