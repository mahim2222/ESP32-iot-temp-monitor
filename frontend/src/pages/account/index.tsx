import type { ReactElement, ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import AuthCheck from "@/components/layout/auth-check";
import Layout from "@/components/layout/layout";
import UserAvatar from "@/components/layout/user-avatar";
import { updateProfileRequest } from "@/lib/auth-api";
import { AuthLogin } from "@/store/auth-slice";
import type { AppDispatch, RootState } from "@/store";
import type { NextPageWithLayout } from "../_app";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB before compress
const AVATAR_SIZE = 256;

function extractMessage(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === "object" &&
    "response" in err &&
    err.response &&
    typeof err.response === "object" &&
    "data" in err.response &&
    err.response.data &&
    typeof err.response.data === "object" &&
    "message" in err.response.data &&
    typeof (err.response.data as { message: unknown }).message === "string"
  ) {
    return (err.response.data as { message: string }).message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not process image"));
          return;
        }

        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

const AccountPage: NextPageWithLayout = () => {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.auth.user);
  const profile = useSelector((s: RootState) => s.auth.profile);

  const [name, setName] = useState(user?.name ?? "");
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar ?? "");
  const [savingName, setSavingName] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(user?.name ?? "");
  }, [user?.name]);

  useEffect(() => {
    setAvatarPreview(profile?.avatar ?? "");
  }, [profile?.avatar]);

  const nameDirty = name.trim() !== (user?.name ?? "").trim();
  const displayName = name.trim() || user?.name || "User";

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!nameDirty || savingName) return;
    setSavingName(true);
    setMessage(null);
    try {
      const payload = await updateProfileRequest({ name: name.trim() });
      dispatch(AuthLogin(payload));
      if (typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(payload.user));
        localStorage.setItem("profile", JSON.stringify(payload.profile));
      }
      setMessage({ kind: "ok", text: "Name updated" });
    } catch (err) {
      setMessage({ kind: "error", text: extractMessage(err, "Failed to update name") });
    } finally {
      setSavingName(false);
      setTimeout(() => {
        setMessage((prev) => (prev?.kind === "ok" ? null : prev));
      }, 2500);
    }
  }

  async function onAvatarSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage({ kind: "error", text: "Please choose an image file" });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setMessage({ kind: "error", text: "Image must be under 5MB" });
      return;
    }

    setSavingAvatar(true);
    setMessage(null);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setAvatarPreview(dataUrl);
      const payload = await updateProfileRequest({ avatar: dataUrl });
      dispatch(AuthLogin(payload));
      if (typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(payload.user));
        localStorage.setItem("profile", JSON.stringify(payload.profile));
      }
      setMessage({ kind: "ok", text: "Profile picture updated" });
    } catch (err) {
      setAvatarPreview(profile?.avatar ?? "");
      setMessage({
        kind: "error",
        text: extractMessage(err, "Failed to update profile picture"),
      });
    } finally {
      setSavingAvatar(false);
      setTimeout(() => {
        setMessage((prev) => (prev?.kind === "ok" ? null : prev));
      }, 2500);
    }
  }

  async function removeAvatar() {
    if (savingAvatar || !avatarPreview) return;
    setSavingAvatar(true);
    setMessage(null);
    try {
      const payload = await updateProfileRequest({ avatar: "" });
      dispatch(AuthLogin(payload));
      if (typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(payload.user));
        localStorage.setItem("profile", JSON.stringify(payload.profile));
      }
      setAvatarPreview("");
      setMessage({ kind: "ok", text: "Profile picture removed" });
    } catch (err) {
      setMessage({
        kind: "error",
        text: extractMessage(err, "Failed to remove profile picture"),
      });
    } finally {
      setSavingAvatar(false);
      setTimeout(() => {
        setMessage((prev) => (prev?.kind === "ok" ? null : prev));
      }, 2500);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Update your name and profile picture.
        </p>
      </div>

      {message && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${
            message.kind === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </p>
      )}

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Profile picture</h2>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
          <UserAvatar
            name={displayName}
            avatarUrl={avatarPreview}
            className="h-24 w-24 text-2xl"
          />
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              JPG, PNG, or WebP. Images are cropped to a square and compressed before
              saving.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={savingAvatar}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {savingAvatar ? "Uploading…" : "Change picture"}
              </button>
              {avatarPreview ? (
                <button
                  type="button"
                  disabled={savingAvatar}
                  onClick={() => void removeAvatar()}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => void onAvatarSelected(e)}
            />
          </div>
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Profile details</h2>
        <form onSubmit={(e) => void saveName(e)} className="mt-5 space-y-4">
          <div>
            <label htmlFor="account-name" className="block text-sm font-medium text-slate-700">
              Name
            </label>
            <input
              id="account-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
              className="mt-1 w-full max-w-md rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">Email</p>
            <p className="mt-1 text-sm text-slate-900">{user?.email ?? "—"}</p>
            <p className="mt-1 text-xs text-slate-500">Email cannot be changed here.</p>
          </div>
          <button
            type="submit"
            disabled={!nameDirty || savingName || !name.trim()}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {savingName ? "Saving…" : "Save name"}
          </button>
        </form>
      </article>
    </div>
  );
};

AccountPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthCheck>
      <Layout>{page}</Layout>
    </AuthCheck>
  );
};

export default AccountPage;
