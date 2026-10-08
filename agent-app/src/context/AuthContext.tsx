import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/api/auth.api";
import { setUnauthorizedHandler } from "@/api/client";
import { tokenStorage } from "@/utils/tokenStorage";

interface AuthContextValue {
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (agentId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const queryClient = useQueryClient();

  const logout = useCallback(async () => {
    // Read first: the server is told with the token this phone was signed
    // in with, and only if there was one (see the note in api/client.ts)
    const token = await tokenStorage.get();
    await tokenStorage.clear();
    queryClient.clear();
    setIsAuthenticated(false);
    // A courtesy to the server. Signed out here whatever it answers.
    if (token) authApi.logout(token).catch(() => {});
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    (async () => {
      const token = await tokenStorage.get();
      setIsAuthenticated(!!token);
      setIsBootstrapping(false);
    })();
  }, []);

  const login = useCallback(
    async (agentId: string, password: string) => {
      const { token } = await authApi.login(agentId, password);
      await tokenStorage.set(token);
      queryClient.clear();
      setIsAuthenticated(true);
    },
    [queryClient],
  );

  return (
    <AuthContext.Provider value={{ isAuthenticated, isBootstrapping, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
