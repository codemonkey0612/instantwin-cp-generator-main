import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { firebase, auth } from "../firebase";

interface AuthContextType {
  user: firebase.User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<firebase.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // FIX: Using Firebase v8 syntax. onAuthStateChanged provides a user object or null.
    const unsubscribe = auth.onAuthStateChanged(
      (user: firebase.User | null) => {
        setUser(user);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const value = { user, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
