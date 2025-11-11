import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import Spinner from '../components/Spinner';
import { useAuth } from '../contexts/AuthContext';

const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('パスワードが一致しません。');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      // FIX: Using Firebase v8 syntax for creating a user.
      await auth.createUserWithEmailAndPassword(email, password);
      navigate('/admin');
    } catch (err: any) {
      // FIX: Firebase v8 error codes.
      switch (err.code) {
        case 'auth/email-already-in-use':
          setError('このメールアドレスは既に使用されています。');
          break;
        case 'auth/invalid-email':
          setError('無効なメールアドレス形式です。');
          break;
        case 'auth/weak-password':
          setError('パスワードは6文字以上で設定してください。');
          break;
        default:
          setError('登録に失敗しました。もう一度お試しください。');
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  // If user is already logged in, redirect to dashboard
  if (user) {
    navigate('/admin');
    return null;
  }

  const inputClass = "block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-center text-slate-800 mb-6">
        インスタントウィン管理画面｜管理者登録
        </h1>
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-sm p-3 rounded-md mb-4" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={handleRegister} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
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
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              パスワード (6文字以上)
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            {/* FIX: Corrected typo `aclassName` to `className`. */}
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
              パスワード (確認用)
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center px-4 py-2.5 bg-slate-800 text-white font-semibold rounded-md hover:bg-slate-900 transition-colors disabled:bg-slate-400"
            >
              {loading ? <Spinner size="sm" /> : '登録してログイン'}
            </button>
          </div>
        </form>
        <p className="text-center text-sm text-slate-500 mt-6">
          既にアカウントをお持ちですか？{' '}
          <Link to="/admin/login" className="font-medium text-slate-800 hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;