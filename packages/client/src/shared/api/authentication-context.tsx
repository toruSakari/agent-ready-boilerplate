"use client";
import { createContext, useContext } from "react";

export type AuthenticationStatus = "loading" | "signed-out" | "signed-in";

// ローカルデモはAPI側のデモ認証を使うため既定値をsigned-inにする。
// Clerkを使うアプリではProviderが読込中・ログアウト状態を明示して上書きする。
export const AuthenticationContext = createContext<AuthenticationStatus>("signed-in");
export const useAuthenticationStatus = () => useContext(AuthenticationContext);
