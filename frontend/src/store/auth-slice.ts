import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  is_blocked?: string;
  blocked_text?: string;
  created_at?: string;
  updated_at?: string;
};

export type AuthProfile = {
  avatar: string;
  created_at?: string;
  updated_at?: string;
};

type AuthState = {
  user: AuthUser | null;
  profile: AuthProfile | null;
};

const initialState: AuthState = {
  user: null,
  profile: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    AuthLogin: (state, action: PayloadAction<{ user: AuthUser; profile: AuthProfile }>) => {
      state.user = action.payload.user;
      state.profile = action.payload.profile;
    },
    AuthLogout: (state) => {
      state.user = null;
      state.profile = null;
    },
  },
});

export const { AuthLogin, AuthLogout } = authSlice.actions;
export default authSlice.reducer;
