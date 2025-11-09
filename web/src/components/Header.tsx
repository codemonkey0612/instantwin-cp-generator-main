import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { auth } from "../firebase";
import UserIcon from "./icons/UserIcon";

const Header: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate("/admin/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link
            to="/admin"
            className="text-xl font-bold text-slate-800 hover:text-slate-900 transition-colors"
          >
            インスタントウィンジェネレーター
          </Link>
          {user && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <UserIcon className="w-5 h-5 text-slate-400" />
                <span>{user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm font-medium bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors"
              >
                ログアウト
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
