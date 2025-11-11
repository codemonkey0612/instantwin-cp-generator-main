import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import Spinner from "../components/Spinner";
import { useAuth } from "../contexts/AuthContext";

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // FIX: Using Firebase v8 syntax for signing in.
      await auth.signInWithEmailAndPassword(email, password);
      navigate("/admin");
    } catch (err: any) {
      // FIX: Firebase v8 error codes.
      switch (err.code) {
        case "auth/user-not-found":
        case "auth/wrong-password":
          setError("メールアドレスまたはパスワードが正しくありません。");
          break;
        case "auth/invalid-email":
          setError("無効なメールアドレス形式です。");
          break;
        default:
          setError("ログインに失敗しました。もう一度お試しください。");
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  // If user is already logged in, redirect to dashboard
  if (user) {
    navigate("/admin");
    return null;
  }

  const inputClass =
    "block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
        <h1 className="text-xl font-bold text-center text-slate-800 mb-6">
        インスタントウィン管理画面｜ログイン
        </h1>
        {error && (
          <div
            className="bg-red-100 border border-red-300 text-red-800 text-sm p-3 rounded-md mb-4"
            role="alert"
          >
            {error}
          </div>
        )}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              メールアドレス
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              required
              autoComplete="email"
            />
          </div>
          <div>
            {/* FIX: Corrected typo `aclassName` to `className`. */}
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              パスワード
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center px-4 py-2.5 bg-slate-800 text-white font-semibold rounded-md hover:bg-slate-900 transition-colors disabled:bg-slate-400"
            >
              {loading ? <Spinner size="sm" /> : "ログイン"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
