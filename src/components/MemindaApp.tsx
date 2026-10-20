"use client";

import React, { useState, useEffect, useCallback } from "react";
import confetti from "canvas-confetti";
import {
  Gift,
  Plus,
  Share2,
  ExternalLink,
  Check,
  Sparkles,
  Users,
  Eye,
  EyeOff,
  Upload,
  Link2,
  Trash2,
  CheckCircle2,
  Calendar,
  X,
  UserPlus,
  LogIn,
  LogOut,
  FolderPlus,
  UserCheck,
  Lock,
  ArrowLeft,
  ArrowRight,
  SlidersHorizontal,
  Home,
  Settings,
  Camera,
  ShoppingBag,
  Heart,
  Search,
} from "lucide-react";
import { TRANSLATIONS, Language } from "@/lib/meminda-data";
import type { PublicUser } from "@/lib/auth";
import type { WishlistRecord, WishItemRecord } from "@/lib/db";
import { auth, googleProvider } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  updatePassword,
  updateEmail,
} from "firebase/auth";

const GUEST_TOKENS_STORAGE_KEY = "meminda_guest_cancel_tokens_v1";

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
];

type PriceRangeFilter = "all" | "under100" | "100to300" | "300to700" | "over700";
type SortOption = "newest" | "priceAsc" | "priceDesc";

export default function MemindaApp() {
  const [lang, setLang] = useState<Language>("ka");
  const [activePage, setActivePage] = useState<"home" | "wishlist">("home");
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [wishlists, setWishlists] = useState<WishlistRecord[]>([]);
  const [items, setItems] = useState<WishItemRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Navigation & Active Selection State
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedWishlistId, setSelectedWishlistId] = useState<string>("");

  // Filters & Sorting
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "reserved">("all");
  const [priceFilter, setPriceFilter] = useState<PriceRangeFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [userSearchQuery, setUserSearchQuery] = useState<string>("");
  const [headerSearchQuery, setHeaderSearchQuery] = useState<string>("");
  const [isHeaderSearchOpen, setIsHeaderSearchOpen] = useState<boolean>(false);

  // Guest cancel tokens stored in browser localStorage
  const [guestCancelTokens, setGuestCancelTokens] = useState<Record<string, string>>({});

  // UI Feedback
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals State
  const [authModalMode, setAuthModalMode] = useState<"login" | "register" | null>(null);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [isNewWishlistModalOpen, setIsNewWishlistModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [activeReserveItem, setActiveReserveItem] = useState<WishItemRecord | null>(null);

  // Auth Form State
  const [authIdentifier, setAuthIdentifier] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regBio, setRegBio] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Profile Settings Form State
  const [settingsName, setSettingsName] = useState("");
  const [settingsUsername, setSettingsUsername] = useState("");
  const [settingsEmail, setSettingsEmail] = useState("");
  const [settingsBio, setSettingsBio] = useState("");
  const [settingsAvatar, setSettingsAvatar] = useState("");
  const [settingsNewPassword, setSettingsNewPassword] = useState("");
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Create Wishlist Form State
  const [wlTitle, setWlTitle] = useState("");
  const [wlDesc, setWlDesc] = useState("");
  const [wlOccasion, setWlOccasion] = useState<WishlistRecord["occasion"]>("birthday");
  const [wlDate, setWlDate] = useState("");

  // Add Wish Item Form State
  const [addTab, setAddTab] = useState<"link" | "manual">("link");
  const [urlInput, setUrlInput] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newStore, setNewStore] = useState("");
  const [newImage, setNewImage] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("high");
  const [conversionInfo, setConversionInfo] = useState<{
    originalPrice: number;
    originalCurrency: string;
    exchangeRateUsed: number;
    rateSource: string;
  } | null>(null);

  // Reserve Gift Form State (Anonymous for all OR Named)
  const [reserveName, setReserveName] = useState("");
  const [reserveNote, setReserveNote] = useState("");
  const [reserveIsAnonymousForAll, setReserveIsAnonymousForAll] = useState(false);

  const t = TRANSLATIONS[lang];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 65,
        spread: 60,
        origin: { y: 0.65 },
      });
    } catch {
      // Ignore confetti error
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(GUEST_TOKENS_STORAGE_KEY);
      if (saved) {
        setGuestCancelTokens(JSON.parse(saved));
      }
    } catch {
      // Ignore
    }
  }, []);

  const saveGuestCancelToken = (itemId: string, token: string) => {
    const updated = { ...guestCancelTokens, [itemId]: token };
    setGuestCancelTokens(updated);
    try {
      localStorage.setItem(GUEST_TOKENS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const fetchAllData = useCallback(
    async (
      preferredUserId?: string,
      preferredWishlistId?: string,
      openWishlistView?: boolean
    ) => {
      try {
        const res = await fetch("/api/wishlists", { cache: "no-store" });
        const data = await res.json();
        const loadedUsers: PublicUser[] = data.users || [];
        const loadedWishlists: WishlistRecord[] = data.wishlists || [];
        const loadedItems: WishItemRecord[] = data.items || [];
        const loggedUser: PublicUser | null = data.currentUser || null;

        setUsers(loadedUsers);
        setWishlists(loadedWishlists);
        setItems(loadedItems);
        setCurrentUser(loggedUser);

        const params = new URLSearchParams(window.location.search);
        const urlUsername = params.get("u")?.toLowerCase();
        const urlUser = urlUsername
          ? loadedUsers.find((u) => u.username.toLowerCase() === urlUsername)
          : undefined;

        const targetUserId =
          preferredUserId ||
          urlUser?.id ||
          selectedUserId ||
          loggedUser?.id ||
          loadedUsers[0]?.id ||
          "";

        setSelectedUserId(targetUserId);

        const userWls = loadedWishlists.filter((w) => w.ownerId === targetUserId);
        const targetWlId =
          preferredWishlistId ||
          (userWls.some((w) => w.id === selectedWishlistId)
            ? selectedWishlistId
            : userWls[0]?.id || "");

        setSelectedWishlistId(targetWlId);

        if (openWishlistView || urlUser) {
          setActivePage("wishlist");
        }
      } catch (e) {
        console.error("Failed to fetch wishlists:", e);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedUserId, selectedWishlistId]
  );

  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open a specific user's wishlist
  const openUserWishlist = (userId: string, wishlistId?: string) => {
    setSelectedUserId(userId);
    const userWls = wishlists.filter((w) => w.ownerId === userId);
    setSelectedWishlistId(wishlistId || userWls[0]?.id || "");
    setStatusFilter("all");
    setPriceFilter("all");
    setActivePage("wishlist");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Open Profile Settings Modal & prefill current user data
  const openProfileSettingsModal = () => {
    if (!currentUser) return;
    setSettingsName(currentUser.name || "");
    setSettingsUsername(currentUser.username || "");
    setSettingsEmail(currentUser.email || "");
    setSettingsBio(lang === "ka" ? currentUser.bioKa : currentUser.bioEn);
    setSettingsAvatar(currentUser.avatarUrl || "");
    setSettingsNewPassword("");
    setSettingsError(null);
    setIsProfileSettingsOpen(true);
  };

  const compressImageFile = (
    file: File,
    maxDimension: number,
    onDone: (dataUrl: string) => void
  ) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const raw = reader.result;
      if (typeof raw !== "string") return;
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(
          1,
          maxDimension / Math.max(img.width || 1, img.height || 1)
        );
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          onDone(canvas.toDataURL("image/jpeg", 0.82));
        } else {
          onDone(raw);
        }
      };
      img.onerror = () => onDone(raw);
      img.src = raw;
    };
    reader.readAsDataURL(file);
  };

  // Handle Profile Picture file upload (auto-resizes to clean Data URL)
  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImageFile(file, 450, (dataUrl) => setSettingsAvatar(dataUrl));
  };

  // Save Profile Settings
  const handleSaveProfileSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSettingsError(null);
    setIsSavingSettings(true);

    try {
      // 1. Update backend user record
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: settingsName,
          username: settingsUsername,
          email: settingsEmail,
          bio: settingsBio,
          avatarUrl: settingsAvatar,
          newPassword: settingsNewPassword || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSettingsError(data.error || "Could not update profile");
        return;
      }

      // 2. Also sync with Firebase Auth currentUser if active in browser
      const fbUser = auth.currentUser;
      if (fbUser) {
        try {
          await updateProfile(fbUser, {
            displayName: settingsName.trim(),
            ...(settingsAvatar.startsWith("http")
              ? { photoURL: settingsAvatar }
              : {}),
          });
        } catch {
          // Ignore non-critical Firebase display update error
        }

        if (
          settingsEmail.trim() &&
          fbUser.email &&
          settingsEmail.trim().toLowerCase() !== fbUser.email.toLowerCase()
        ) {
          try {
            await updateEmail(fbUser, settingsEmail.trim());
          } catch {
            // Firebase may require recent login for email change; backend email is already updated
          }
        }

        if (settingsNewPassword && settingsNewPassword.length >= 6) {
          try {
            await updatePassword(fbUser, settingsNewPassword);
          } catch {
            // Firebase may require recent re-login; backend password hash is updated
          }
        }
      }

      setIsProfileSettingsOpen(false);
      setSettingsNewPassword("");
      await fetchAllData(currentUser.id, selectedWishlistId);
      showToast(t.profileUpdatedToast);
    } catch {
      setSettingsError("Network error while saving settings");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Currently viewed profile & wishlists
  const activeProfileUser =
    users.find((u) => u.id === selectedUserId) || users[0] || null;
  const profileWishlists = wishlists.filter(
    (w) => w.ownerId === activeProfileUser?.id
  );
  const activeWishlist =
    profileWishlists.find((w) => w.id === selectedWishlistId) ||
    profileWishlists[0] ||
    null;

  const isViewingOwnWishlist = Boolean(
    currentUser && activeProfileUser && currentUser.id === activeProfileUser.id
  );

  const wishlistItems = items.filter((i) => i.wishlistId === activeWishlist?.id);
  const reservedCount = wishlistItems.filter((i) => Boolean(i.reservation)).length;
  const availableCount = wishlistItems.length - reservedCount;

  // Apply Status Filter, Price Filter, and Sort
  const filteredItems = wishlistItems
    .filter((item) => {
      if (statusFilter === "available" && item.reservation) return false;
      if (statusFilter === "reserved" && !item.reservation) return false;

      if (priceFilter === "under100" && item.price >= 100) return false;
      if (priceFilter === "100to300" && (item.price < 100 || item.price > 300))
        return false;
      if (priceFilter === "300to700" && (item.price <= 300 || item.price > 700))
        return false;
      if (priceFilter === "over700" && item.price <= 700) return false;

      return true;
    })
    .sort((a, b) => {
      if (sortBy === "priceAsc") return a.price - b.price;
      if (sortBy === "priceDesc") return b.price - a.price;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  // Firebase & Server Auth Sync Helper
  const syncFirebaseUserWithBackend = async (
    idToken: string,
    extra?: { name?: string; username?: string; email?: string; bio?: string }
  ) => {
    const res = await fetch("/api/auth/firebase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken,
        ...extra,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Authentication failed");
    }
    return data;
  };

  // Google Sign-In via Firebase Auth
  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setIsSubmittingAuth(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const idToken = await cred.user.getIdToken();
      const data = await syncFirebaseUserWithBackend(idToken, {
        name: cred.user.displayName || undefined,
        email: cred.user.email || undefined,
      });
      setAuthModalMode(null);
      await fetchAllData(data.user.id, data.defaultWishlistId, true);
      triggerConfetti();
      showToast(
        lang === "ka"
          ? `👋 მოგესალმებით, ${data.user.name}!`
          : `👋 Welcome, ${data.user.name}!`
      );
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code === "auth/unauthorized-domain") {
        const host =
          typeof window !== "undefined" ? window.location.hostname : "meminda.ge";
        setAuthError(
          lang === "ka"
            ? `დომენი "${host}" დასამატებელია Firebase Console -> Authentication -> Settings -> Authorized domains-ში.`
            : `Please add "${host}" in Firebase Console -> Authentication -> Settings -> Authorized domains.`
        );
      } else if (code !== "auth/popup-closed-by-user") {
        setAuthError(
          lang === "ka"
            ? `Google-ით შესვლა ვერ მოხერხდა (${code || "შეცდომა"}).`
            : `Google Sign-In failed (${code || "error"}).`
        );
      }
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Email/Password Login via Firebase Auth (with fallback for seeded demo usernames & local password updates)
  const handleLoginSubmit = async (
    e: React.FormEvent,
    quickIdent?: string,
    quickPass?: string
  ) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmittingAuth(true);
    const identifier = (quickIdent ?? authIdentifier).trim();
    const password = quickPass ?? authPassword;

    try {
      // First try local/backend login (handles demo accounts & updated passwords)
      const localRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      if (localRes.ok) {
        const localData = await localRes.json();
        setAuthModalMode(null);
        setAuthIdentifier("");
        setAuthPassword("");
        await fetchAllData(localData.user.id, undefined, true);
        showToast(
          lang === "ka"
            ? `👋 მოგესალმებით, ${localData.user.name}!`
            : `👋 Welcome back, ${localData.user.name}!`
        );
        return;
      }

      // Otherwise authenticate with Firebase Auth
      const emailToUse = identifier.includes("@")
        ? identifier
        : users.find((u) => u.username.toLowerCase() === identifier.toLowerCase())
            ?.email || identifier;

      const cred = await signInWithEmailAndPassword(auth, emailToUse, password);
      const idToken = await cred.user.getIdToken();
      const data = await syncFirebaseUserWithBackend(idToken, {
        email: cred.user.email || emailToUse,
      });
      setAuthModalMode(null);
      setAuthIdentifier("");
      setAuthPassword("");
      await fetchAllData(data.user.id, undefined, true);
      showToast(
        lang === "ka"
          ? `👋 მოგესალმებით, ${data.user.name}!`
          : `👋 Welcome back, ${data.user.name}!`
      );
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
      ) {
        setAuthError(
          lang === "ka"
            ? "არასწორი ელ-ფოსტა ან პაროლი"
            : "Invalid email or password"
        );
      } else {
        setAuthError(
          lang === "ka"
            ? "არასწორი მომხმარებელი ან პაროლი"
            : "Invalid credentials"
        );
      }
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Register New Account via Firebase Authentication
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (authPassword.length < 6) {
      setAuthError(
        lang === "ka"
          ? "პაროლი უნდა შეიცავდეს მინიმუმ 6 სიმბოლოს"
          : "Password must be at least 6 characters long"
      );
      return;
    }

    setIsSubmittingAuth(true);
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        regEmail.trim(),
        authPassword
      );
      if (regName.trim()) {
        await updateProfile(cred.user, { displayName: regName.trim() });
      }
      const idToken = await cred.user.getIdToken(true);
      const data = await syncFirebaseUserWithBackend(idToken, {
        name: regName.trim(),
        username: regUsername.trim(),
        email: regEmail.trim(),
        bio: regBio.trim(),
      });

      setAuthModalMode(null);
      setRegName("");
      setRegUsername("");
      setRegEmail("");
      setRegBio("");
      setAuthPassword("");
      await fetchAllData(data.user.id, data.defaultWishlistId, true);
      triggerConfetti();
      showToast(
        lang === "ka"
          ? `🎉 ანგარიში შეიქმნა! მოგესალმებით, ${data.user.name}!`
          : `🎉 Account created! Welcome, ${data.user.name}!`
      );
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code === "auth/email-already-in-use") {
        setAuthError(
          lang === "ka"
            ? "ამ ელ-ფოსტით ანგარიში უკვე არსებობს"
            : "This email is already registered"
        );
      } else if (code === "auth/weak-password") {
        setAuthError(
          lang === "ka"
            ? "პაროლი ძალიან სუსტია (მინიმუმ 6 სიმბოლო)"
            : "Password is too weak (minimum 6 characters)"
        );
      } else {
        setAuthError(
          (err as Error)?.message ||
            (lang === "ka" ? "რეგისტრაციის შეცდომა" : "Registration error")
        );
      }
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Password Reset Email via Firebase Auth
  const handleForgotPassword = async () => {
    const email = authIdentifier.trim();
    if (!email || !email.includes("@")) {
      setAuthError(
        lang === "ka"
          ? "პაროლის აღსადგენად გთხოვთ ჩაწეროთ თქვენი ელ-ფოსტა ზემოთ ველში"
          : "Please enter your email address above to receive a password reset link"
      );
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      showToast(
        lang === "ka"
          ? `📧 პაროლის აღდგენის ბმული გაიგზავნა: ${email}`
          : `📧 Password reset email sent to ${email}`
      );
    } catch {
      setAuthError(
        lang === "ka"
          ? "პაროლის აღდგენის წერილის გაგზავნა ვერ მოხერხდა"
          : "Could not send password reset email"
      );
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      // Ignore client signout error
    }
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
    showToast(lang === "ka" ? "ანგარიშიდან გამოხვედით" : "Logged out");
  };

  // Create New Wishlist Handler
  const handleCreateWishlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wlTitle.trim()) return;

    const res = await fetch("/api/wishlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: wlTitle,
        description: wlDesc,
        occasion: wlOccasion,
        eventDate: wlDate || undefined,
      }),
    });
    const data = await res.json();
    if (res.ok && data.wishlist) {
      setIsNewWishlistModalOpen(false);
      setWlTitle("");
      setWlDesc("");
      setWlDate("");
      await fetchAllData(currentUser?.id, data.wishlist.id, true);
      showToast(
        lang === "ka"
          ? "✨ ახალი სურვილების სია შეიქმნა!"
          : "✨ New wishlist created!"
      );
    }
  };

  // URL Auto-Scrape Handler
  const handleAutoScrape = async (customUrl?: string) => {
    const targetUrl = customUrl ?? urlInput;
    if (!targetUrl.trim()) return;
    setIsScraping(true);
    setConversionInfo(null);
    try {
      const res = await fetch("/api/scrape-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = await res.json();
      if (data.title) setNewTitle(data.title);
      if (data.price) setNewPrice(String(data.price));
      if (data.store) setNewStore(data.store);
      if (data.image) setNewImage(data.image);
      if (data.description) setNewDesc(data.description);
      if (
        data.originalCurrency &&
        data.originalCurrency !== "GEL" &&
        data.originalPrice &&
        data.exchangeRateUsed
      ) {
        setConversionInfo({
          originalPrice: data.originalPrice,
          originalCurrency: data.originalCurrency,
          exchangeRateUsed: data.exchangeRateUsed,
          rateSource: data.rateSource || "TBC Bank",
        });
      }
    } catch {
      // Fallback
    } finally {
      setIsScraping(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImageFile(file, 750, (dataUrl) => setNewImage(dataUrl));
  };

  // Add Item to Wishlist
  const handleCreateWishItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWishlist || !newTitle.trim()) return;

    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wishlistId: activeWishlist.id,
        title: newTitle,
        description: newDesc,
        price: Number(newPrice) || 100,
        originalPrice: conversionInfo?.originalPrice,
        originalCurrency: conversionInfo?.originalCurrency,
        imageUrl: newImage,
        productUrl: urlInput || undefined,
        storeName: newStore || undefined,
        priority: newPriority,
      }),
    });

    if (res.ok) {
      setIsAddItemModalOpen(false);
      setUrlInput("");
      setNewTitle("");
      setNewPrice("");
      setNewStore("");
      setNewImage("");
      setNewDesc("");
      setConversionInfo(null);
      await fetchAllData(activeProfileUser?.id, activeWishlist.id, true);
      showToast(
        lang === "ka"
          ? "✨ სურვილი წარმატებით დაემატა სიას!"
          : "✨ Wish item added to your wishlist!"
      );
    }
  };

  // Delete Item (Owner)
  const handleDeleteItem = async (itemId: string) => {
    const res = await fetch(`/api/items?id=${encodeURIComponent(itemId)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await fetchAllData(activeProfileUser?.id, activeWishlist?.id, true);
      showToast(lang === "ka" ? "სურვილი წაიშალა" : "Wish item removed");
    }
  };

  // Reserve Gift Submit (Named OR Anonymous for All)
  const handleReserveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReserveItem) return;

    const finalName = reserveIsAnonymousForAll
      ? lang === "ka"
        ? "ანონიმური"
        : "Anonymous"
      : currentUser
      ? reserveName.trim() || currentUser.name
      : reserveName.trim();

    if (!finalName && !reserveIsAnonymousForAll) return;

    const res = await fetch("/api/items/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reserve",
        itemId: activeReserveItem.id,
        reservedByName: finalName,
        isAnonymousForAll: reserveIsAnonymousForAll,
        note: reserveNote,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      if (data.guestCancelToken) {
        saveGuestCancelToken(activeReserveItem.id, data.guestCancelToken);
      }
      setActiveReserveItem(null);
      setReserveName("");
      setReserveNote("");
      setReserveIsAnonymousForAll(false);
      await fetchAllData(activeProfileUser?.id, activeWishlist?.id, true);
      triggerConfetti();
      showToast(
        lang === "ka"
          ? "🎁 საჩუქარი წარმატებით დაიჯავშნა!"
          : "🎁 Gift reserved! Other guests will see it is taken."
      );
    } else {
      showToast(data.error || "Could not reserve gift");
    }
  };

  // Unreserve Gift
  const handleUnreserve = async (item: WishItemRecord) => {
    const guestCancelToken = guestCancelTokens[item.id];
    const res = await fetch("/api/items/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "unreserve",
        itemId: item.id,
        guestCancelToken,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      await fetchAllData(activeProfileUser?.id, activeWishlist?.id, true);
      showToast(lang === "ka" ? "ჯავშანი გაუქმდა" : "Reservation cancelled");
    } else {
      showToast(data.error || "Cannot unreserve");
    }
  };

  const canVisitorUnreserve = (item: WishItemRecord): boolean => {
    if (!item.reservation) return false;
    if (isViewingOwnWishlist) return true;
    if (
      currentUser &&
      item.reservation.reservedByUserId &&
      currentUser.id === item.reservation.reservedByUserId
    ) {
      return true;
    }
    if (guestCancelTokens[item.id]) return true;
    return false;
  };

  const getReservationDisplayName = (item: WishItemRecord): string => {
    const r = item.reservation;
    if (!r) return "";
    if (r.isAnonymousToPublic || r.hideFromOwnerSpoilerFree) {
      return t.anonymousForAllText;
    }
    return r.reservedByName;
  };

  const occasionBadge = (occ?: WishlistRecord["occasion"]) => {
    switch (occ) {
      case "wedding":
        return t.occasionWedding;
      case "housewarming":
        return t.occasionHousewarming;
      case "baby":
        return t.occasionBaby;
      case "christmas":
        return t.occasionChristmas;
      case "other":
        return t.occasionOther;
      default:
        return t.occasionBirthday;
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-slate-900 pb-20">
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#FF5A5F] to-[#FF7A45] px-4 py-3.5 text-xs sm:text-sm font-bold text-white shadow-2xl border border-white/25">
          <Sparkles className="h-4 w-4 text-[#FFE066] shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* MOBILE-FRIENDLY STICKY HEADER                             */}
      {/* ========================================================= */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#FFFDF9]/95 border-b border-orange-100">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          {/* Brand Logo -> Navigates to Main Landing Page */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            <button
              onClick={() => setActivePage("home")}
              className="flex items-center text-left cursor-pointer group shrink-0"
              aria-label="Meminda Home"
            >
              {/* Mobile Logo (meminda.svg) */}
              <img
                src="/meminda.svg"
                alt="Meminda"
                className="block sm:hidden h-9 w-9 object-contain group-hover:scale-105 transition-transform"
              />
              {/* Desktop Logo: MemindaGE.svg for Georgian, MemindaEN.svg for English */}
              <img
                src={lang === "ka" ? "/MemindaGE.svg" : "/MemindaEN.svg"}
                alt="Meminda"
                className="hidden sm:block h-10 md:h-11 w-auto object-contain group-hover:scale-[1.03] transition-transform"
              />
            </button>
          </div>

          {/* Desktop User Search Bar with Instant Dropdown */}
          <div className="relative hidden md:block flex-1 max-w-xs lg:max-w-sm mx-2">
            <div className="relative flex items-center">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={headerSearchQuery}
                onFocus={() => setIsHeaderSearchOpen(true)}
                onBlur={() => setTimeout(() => setIsHeaderSearchOpen(false), 180)}
                onChange={(e) => {
                  setHeaderSearchQuery(e.target.value);
                  setIsHeaderSearchOpen(true);
                }}
                placeholder={t.searchUsersPlaceholder}
                className="w-full rounded-xl bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-rose-400 pl-9 pr-8 py-1.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none transition"
              />
              {headerSearchQuery && (
                <button
                  type="button"
                  onClick={() => setHeaderSearchQuery("")}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {isHeaderSearchOpen && headerSearchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 mt-2 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-50 max-h-72 overflow-y-auto">
                {(() => {
                  const q = headerSearchQuery.trim().toLowerCase().replace(/^@/, "");
                  const matchedUsers = users.filter(
                    (u) =>
                      u.name.toLowerCase().includes(q) ||
                      u.username.toLowerCase().includes(q)
                  );
                  if (matchedUsers.length === 0) {
                    return (
                      <p className="px-4 py-3 text-xs text-slate-500 text-center">
                        {t.noUsersFound}
                      </p>
                    );
                  }
                  return matchedUsers.map((u) => {
                    const userWls = wishlists.filter((w) => w.ownerId === u.id);
                    const totalItemsCount = items.filter((it) =>
                      userWls.some((w) => w.id === it.wishlistId)
                    ).length;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onMouseDown={() => {
                          openUserWishlist(u.id);
                          setIsHeaderSearchOpen(false);
                          setHeaderSearchQuery("");
                        }}
                        className="w-full px-3.5 py-2.5 hover:bg-rose-50/70 flex items-center justify-between gap-2 text-left transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={u.avatarUrl}
                            alt={u.name}
                            className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {u.name}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              @{u.username}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full bg-rose-50 text-rose-700 px-2 py-0.5 text-[10px] font-bold shrink-0">
                          🎁 {totalItemsCount} {t.itemsCountSuffix}
                        </span>
                      </button>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* Right Navigation Actions (Compact on Mobile) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Mobile Search Toggle Button */}
            <button
              type="button"
              onClick={() => setIsHeaderSearchOpen((prev) => !prev)}
              className="md:hidden inline-flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 text-xs font-bold transition cursor-pointer"
              title={t.searchHeaderPlaceholder}
            >
              <Search className="h-4 w-4" />
            </button>

            {activePage === "wishlist" && (
              <button
                onClick={() => setActivePage("home")}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-2 text-xs font-bold transition cursor-pointer"
                title={t.homeNav}
              >
                <Home className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.homeNav}</span>
              </button>
            )}

            {currentUser ? (
              <>
                <button
                  onClick={() => openUserWishlist(currentUser.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold transition cursor-pointer ${
                    activePage === "wishlist" && isViewingOwnWishlist
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                  }`}
                >
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="h-5 w-5 rounded-full object-cover shrink-0"
                  />
                  <span className="max-w-[85px] sm:max-w-[130px] truncate">
                    {currentUser.name.split(" ")[0]}
                  </span>
                </button>

                {/* Profile Settings Button */}
                <button
                  onClick={openProfileSettingsModal}
                  title={t.settingsBtn}
                  className="inline-flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-2 text-xs font-bold transition cursor-pointer"
                >
                  <Settings className="h-4 w-4 text-slate-600" />
                  <span className="hidden md:inline">{t.settingsBtn}</span>
                </button>

                {activePage === "wishlist" && isViewingOwnWishlist && activeWishlist && (
                  <button
                    onClick={() => setIsAddItemModalOpen(true)}
                    className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-[#FF5A5F] to-[#FF7A45] hover:from-[#FF4248] hover:to-[#FF662A] text-white px-2.5 sm:px-3.5 py-2 text-xs font-bold shadow-sm transition cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t.addGiftBtn}</span>
                  </button>
                )}

                <button
                  onClick={handleLogout}
                  title={t.logoutBtn}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-100 hover:bg-orange-50 hover:text-[#FF5A5F] text-slate-600 p-2 text-xs font-semibold transition cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setAuthError(null);
                    setAuthModalMode("login");
                  }}
                  className="inline-flex items-center gap-1 rounded-xl bg-orange-50 hover:bg-orange-100 text-slate-800 px-2.5 sm:px-3.5 py-2 text-xs font-bold transition cursor-pointer"
                >
                  <LogIn className="h-3.5 w-3.5 text-[#FF5A5F]" />
                  <span>{t.loginBtn}</span>
                </button>

                <button
                  onClick={() => {
                    setAuthError(null);
                    setAuthModalMode("register");
                  }}
                  className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-[#FF5A5F] to-[#FF7A45] hover:from-[#FF4248] hover:to-[#FF662A] text-white px-2.5 sm:px-3.5 py-2 text-xs font-bold shadow-sm shadow-[#FF5A5F]/20 transition cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5 hidden sm:inline" />
                  <span>{t.registerBtn}</span>
                </button>
              </>
            )}

            {/* Compact Language Toggle */}
            <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
              <button
                onClick={() => setLang("ka")}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  lang === "ka"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                ქარ
              </button>
              <button
                onClick={() => setLang("en")}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  lang === "en"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Expandable User Search Drawer */}
        {isHeaderSearchOpen && (
          <div className="md:hidden px-3 pb-3 border-t border-slate-100 bg-white">
            <div className="relative flex items-center mt-2">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={headerSearchQuery}
                onChange={(e) => setHeaderSearchQuery(e.target.value)}
                placeholder={t.searchUsersPlaceholder}
                autoFocus
                className="w-full rounded-xl bg-slate-100 focus:bg-white border border-slate-200 focus:border-rose-400 pl-9 pr-8 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none"
              />
              {headerSearchQuery && (
                <button
                  type="button"
                  onClick={() => setHeaderSearchQuery("")}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {headerSearchQuery.trim().length > 0 && (
              <div className="mt-2 rounded-2xl bg-slate-50 border border-slate-200 divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {(() => {
                  const q = headerSearchQuery.trim().toLowerCase().replace(/^@/, "");
                  const matchedUsers = users.filter(
                    (u) =>
                      u.name.toLowerCase().includes(q) ||
                      u.username.toLowerCase().includes(q)
                  );
                  if (matchedUsers.length === 0) {
                    return (
                      <p className="px-4 py-3 text-xs text-slate-500 text-center">
                        {t.noUsersFound}
                      </p>
                    );
                  }
                  return matchedUsers.map((u) => {
                    const userWls = wishlists.filter((w) => w.ownerId === u.id);
                    const totalItemsCount = items.filter((it) =>
                      userWls.some((w) => w.id === it.wishlistId)
                    ).length;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          openUserWishlist(u.id);
                          setIsHeaderSearchOpen(false);
                          setHeaderSearchQuery("");
                        }}
                        className="w-full px-3.5 py-2.5 hover:bg-rose-50 flex items-center justify-between gap-2 text-left transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={u.avatarUrl}
                            alt={u.name}
                            className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {u.name}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              @{u.username}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 text-[10px] font-bold shrink-0">
                          🎁 {totalItemsCount} {t.itemsCountSuffix}
                        </span>
                      </button>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        )}
      </header>

      {/* ========================================================= */}
      {/* VIEW 1: LIVELY MAIN LANDING PAGE WITH IMAGES & ANIMATIONS */}
      {/* ========================================================= */}
      {activePage === "home" && (
        <div className="space-y-12 sm:space-y-16">
          {/* Animated Split Hero Section — Sunshine Coral & Tangerine Pop */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FF5A5F] via-[#FF7A45] to-[#FFB800] text-white px-5 py-9 sm:p-10 md:p-14 shadow-2xl shadow-[#FF5A5F]/20">
              {/* Animated Ambient Sunshine Glow Orbs */}
              <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-[#FFE066]/40 blur-3xl animate-pulse-soft" />
              <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-white/25 blur-3xl animate-pulse-soft" />

              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
                {/* Left Column: Hero Copy & CTAs */}
                <div className="lg:col-span-7">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur px-3.5 py-1 text-xs font-extrabold text-white border border-white/30 shadow-2xs">
                    {t.heroBadge}
                  </span>

                  <h1 className="mt-4 sm:mt-5 text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight drop-shadow-xs">
                    {t.heroTitleLine1}{" "}
                    <span className="text-[#FFF3B0] underline decoration-[#FFF3B0]/50 decoration-wavy underline-offset-8">
                      {t.heroTitleLine2}
                    </span>
                  </h1>

                  <p className="mt-3.5 sm:mt-4 text-sm sm:text-base md:text-lg text-white/95 font-medium leading-relaxed max-w-xl">
                    {t.heroSubtitle}
                  </p>

                  <div className="mt-6 sm:mt-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {currentUser ? (
                      <button
                        onClick={() => openUserWishlist(currentUser.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white hover:bg-[#FFFDF9] text-[#FF5A5F] px-6 py-3.5 text-sm sm:text-base font-black shadow-xl shadow-black/10 transition hover:-translate-y-0.5 cursor-pointer"
                      >
                        <Gift className="h-5 w-5 text-[#FF5A5F]" />
                        <span>{t.heroGoToMyProfile}</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setAuthError(null);
                          setAuthModalMode("register");
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white hover:bg-[#FFFDF9] text-[#FF5A5F] px-6 py-3.5 text-sm sm:text-base font-black shadow-xl shadow-black/10 transition hover:-translate-y-0.5 cursor-pointer"
                      >
                        <Sparkles className="h-5 w-5 text-[#FFB800] fill-[#FFB800]" />
                        <span>{t.heroPrimaryCta}</span>
                      </button>
                    )}

                    <a
                      href="#explore-wishlists"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/20 hover:bg-white/30 border border-white/35 text-white px-6 py-3.5 text-sm sm:text-base font-extrabold backdrop-blur-xs transition"
                    >
                      <Users className="h-4 w-4" />
                      <span>{t.heroSecondaryCta}</span>
                    </a>
                  </div>

                  {/* Social Proof Avatars Strip */}
                  <div className="mt-7 pt-5 border-t border-white/25 flex flex-wrap items-center gap-3">
                    <div className="flex -space-x-2.5">
                      {PRESET_AVATARS.slice(0, 4).map((av, i) => (
                        <img
                          key={i}
                          src={av}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover ring-2 ring-white"
                        />
                      ))}
                    </div>
                    <p className="text-xs font-semibold text-white/95">
                      {lang === "ka"
                        ? "🇬🇪 შექმნილია საქართველოსთვის • 100% უფასო • რეგისტრაციის გარეშე დაჯავშნა"
                        : "🇬🇪 Built for Georgia • 100% Free • Reserve gifts without registration"}
                    </p>
                  </div>
                </div>

                {/* Right Column: Floating Animated Gift Cards Showcase */}
                <div className="lg:col-span-5 relative">
                  <div className="relative mx-auto max-w-sm">
                    {/* Main Floating Product Card */}
                    <div className="rounded-3xl bg-white/95 backdrop-blur-xl border border-white p-4 shadow-2xl text-slate-900 animate-float-slow">
                      <div className="relative h-44 sm:h-48 rounded-2xl overflow-hidden bg-orange-50">
                        <img
                          src="https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=800&q=80"
                          alt="Headphones"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                        <span className="absolute top-2.5 left-2.5 rounded-full bg-[#FF5A5F] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs">
                          🔥 {t.priorityHigh}
                        </span>
                        <span className="absolute top-2.5 right-2.5 rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-bold text-slate-900">
                          🛍️ Zoommer.ge
                        </span>
                        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white">
                          <span className="text-sm font-bold truncate">
                            Sony WH-1000XM5
                          </span>
                          <span className="text-lg font-black text-[#FFE066]">
                            949 ₾
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <img
                            src={PRESET_AVATARS[0]}
                            alt="Nini"
                            className="h-7 w-7 rounded-full object-cover ring-2 ring-[#FF5A5F]"
                          />
                          <span className="text-xs font-extrabold text-slate-800">
                            {lang === "ka" ? "ნინის დაბადების დღე 🎂" : "Nini's Birthday 🎂"}
                          </span>
                        </div>
                        <span className="rounded-xl bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700">
                          ✓ {t.reservedBadge}
                        </span>
                      </div>
                    </div>

                    {/* Secondary Floating Mini Card (Bottom Left) */}
                    <div className="mt-3 sm:mt-0 sm:absolute sm:-bottom-5 sm:-left-6 rounded-2xl bg-white text-slate-900 p-3 shadow-xl border border-amber-100 flex items-center gap-3 animate-float-delayed">
                      <img
                        src="https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=300&q=80"
                        alt="Espresso"
                        className="h-12 w-12 rounded-xl object-cover shrink-0"
                      />
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#FF5A5F] block">
                          {lang === "ka" ? "ახალმოსახლეობა 🏡" : "Housewarming 🏡"}
                        </span>
                        <p className="text-xs font-bold text-slate-900">
                          DeLonghi Dedica • 689 ₾
                        </p>
                        <p className="text-[11px] text-emerald-600 font-bold">
                          {lang === "ka"
                            ? "🎁 დაჯავშნა: ანონიმურმა მეგობარმა"
                            : "🎁 Reserved by: Anonymous"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Supported Stores Strip */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="rounded-3xl bg-white border border-slate-200/80 px-4 py-5 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 text-center md:text-left">
                <ShoppingBag className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{t.supportedStoresTitle}:</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {[
                  "🛍️ Veli.store",
                  "📱 Zoommer.ge",
                  "🏠 Extra.ge",
                  "📦 Amazon.com (TBC ₾)",
                  "✨ Lutecia.ge",
                  "👗 Dressup.ge",
                  "📸 Instagram Shops",
                ].map((store) => (
                  <span
                    key={store}
                    className="rounded-xl bg-slate-50 hover:bg-rose-50 hover:text-rose-700 border border-slate-200/80 px-3 py-1.5 text-xs font-bold text-slate-700 transition"
                  >
                    {store}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Visual Occasions Photo Grid ("ყველა განსაკუთრებული დღისთვის") */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-xl mx-auto mb-7">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {t.occasionsTitle}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {t.occasionsSub}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  title: t.occCardBirthdayTitle,
                  sub: t.occCardBirthdaySub,
                  badge: "🎂",
                  img: "https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=700&q=80",
                },
                {
                  title: t.occCardWeddingTitle,
                  sub: t.occCardWeddingSub,
                  badge: "💍",
                  img: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=700&q=80",
                },
                {
                  title: t.occCardHomeTitle,
                  sub: t.occCardHomeSub,
                  badge: "🏡",
                  img: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=700&q=80",
                },
                {
                  title: t.occCardSantaTitle,
                  sub: t.occCardSantaSub,
                  badge: "🎄",
                  img: "https://images.unsplash.com/photo-1512909006721-3d6018887383?auto=format&fit=crop&w=700&q=80",
                },
              ].map((card, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    if (currentUser) {
                      setIsNewWishlistModalOpen(true);
                    } else {
                      setAuthModalMode("register");
                    }
                  }}
                  className="group relative h-56 sm:h-64 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer"
                >
                  <img
                    src={card.img}
                    alt={card.title}
                    className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent" />
                  <span className="absolute top-3.5 left-3.5 h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-lg shadow-sm">
                    {card.badge}
                  </span>
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <h3 className="text-base font-extrabold group-hover:text-amber-300 transition">
                      {card.title}
                    </h3>
                    <p className="text-xs text-slate-200 mt-0.5 line-clamp-2">
                      {card.sub}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* How It Works (3 Cards with Hover Lift) */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-xl mx-auto mb-8">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {t.howItWorksTitle}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {t.howItWorksSub}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {[
                {
                  icon: <Link2 className="h-6 w-6 text-[#FF5A5F]" />,
                  bg: "bg-orange-50 border-orange-100",
                  title: t.step1Title,
                  desc: t.step1Desc,
                },
                {
                  icon: <Share2 className="h-6 w-6 text-amber-500" />,
                  bg: "bg-amber-50 border-amber-100",
                  title: t.step2Title,
                  desc: t.step2Desc,
                },
                {
                  icon: <Gift className="h-6 w-6 text-emerald-600" />,
                  bg: "bg-emerald-50 border-emerald-100",
                  title: t.step3Title,
                  desc: t.step3Desc,
                },
              ].map((step, idx) => (
                <div
                  key={idx}
                  className="rounded-3xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-xs hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
                >
                  <div
                    className={`h-12 w-12 rounded-2xl border ${step.bg} flex items-center justify-center mb-4`}
                  >
                    {step.icon}
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Featured / Public Wishlists Directory */}
          <section id="explore-wishlists" className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Heart className="h-5 w-5 text-rose-600 fill-rose-600" />
                  <span>{t.featuredWishlistsTitle}</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  {t.featuredWishlistsSub}
                </p>
              </div>

              {/* Search Bar for Specific User / @Username / Wishlist */}
              <div className="relative w-full md:w-80 lg:w-96">
                <Search className="h-4 w-4 text-rose-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder={t.searchUsersPlaceholder}
                  className="w-full rounded-2xl bg-white border border-slate-200/90 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 pl-10 pr-9 py-2.5 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-2xs outline-none transition"
                />
                {userSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setUserSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {(() => {
              const q = userSearchQuery.trim().toLowerCase().replace(/^@/, "");
              const filteredWishlists = q
                ? wishlists.filter((wl) => {
                    const owner = users.find((u) => u.id === wl.ownerId);
                    return (
                      owner?.name.toLowerCase().includes(q) ||
                      owner?.username.toLowerCase().includes(q) ||
                      wl.title.toLowerCase().includes(q) ||
                      wl.description?.toLowerCase().includes(q)
                    );
                  })
                : wishlists;

              if (filteredWishlists.length === 0) {
                return (
                  <div className="rounded-3xl bg-white border border-slate-200/90 p-10 text-center">
                    <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">
                      {t.noUsersFound}
                    </p>
                    <button
                      type="button"
                      onClick={() => setUserSearchQuery("")}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 px-4 py-2 text-xs font-bold transition cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>{t.clearSearchBtn}</span>
                    </button>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {filteredWishlists.map((wl) => {
                    const owner = users.find((u) => u.id === wl.ownerId);
                    const wlItems = items.filter((i) => i.wishlistId === wl.id);
                    const wlReserved = wlItems.filter((i) => Boolean(i.reservation)).length;
                    const previewImages = wlItems.slice(0, 3).map((i) => i.imageUrl);

                    return (
                      <div
                        key={wl.id}
                        onClick={() => openUserWishlist(wl.ownerId, wl.id)}
                        className="group rounded-3xl bg-white border border-slate-200/90 p-5 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {owner && (
                                <img
                                  src={owner.avatarUrl}
                                  alt={owner.name}
                                  className="h-10 w-10 rounded-full object-cover ring-2 ring-rose-100 shrink-0"
                                />
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">
                                  {owner?.name}
                                </p>
                                <p className="text-xs text-slate-400 truncate">
                                  @{owner?.username}
                                </p>
                              </div>
                            </div>

                            <span className="rounded-full bg-rose-50 text-rose-700 border border-rose-200/60 px-2.5 py-1 text-[11px] font-bold shrink-0">
                              {occasionBadge(wl.occasion)}
                            </span>
                          </div>

                          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 group-hover:text-rose-600 transition line-clamp-1">
                            {wl.title}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                            {wl.description}
                          </p>

                          {previewImages.length > 0 && (
                            <div className="mt-4 grid grid-cols-3 gap-2">
                              {previewImages.map((imgUrl, i) => (
                                <div
                                  key={i}
                                  className="h-20 rounded-xl bg-slate-100 overflow-hidden"
                                >
                                  <img
                                    src={imgUrl}
                                    alt=""
                                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-600">
                            🎁 {wlItems.length} {t.itemsCountSuffix} ({wlReserved}{" "}
                            {t.reservedGiftsCount})
                          </span>
                          <span className="inline-flex items-center gap-1 font-extrabold text-rose-600 group-hover:translate-x-0.5 transition-transform">
                            <span>{t.viewWishlistBtn}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </section>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 2: WISHLIST PROFILE & ITEMS PAGE                     */}
      {/* ========================================================= */}
      {activePage === "wishlist" && activeProfileUser && (
        <div>
          {/* Top Sub-bar: Back to Home + Quick User Switcher */}
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 flex items-center justify-between gap-2">
            <button
              onClick={() => setActivePage("home")}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.backToHome}</span>
            </button>

            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[65%] sm:max-w-none py-1 no-scrollbar">
              {users.map((u) => {
                const isSelected = u.id === activeProfileUser.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => openUserWishlist(u.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer shrink-0 ${
                      isSelected
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <img
                      src={u.avatarUrl}
                      alt={u.name}
                      className="h-4 w-4 rounded-full object-cover"
                    />
                    <span className="truncate max-w-[90px]">{u.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Profile Hero Banner — Sunshine Coral & Tangerine Pop */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-3">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FF5A5F] via-[#FF7A45] to-[#FFB800] text-white p-5 sm:p-8 shadow-xl shadow-[#FF5A5F]/15">
              <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[#FFE066]/35 blur-3xl" />
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <img
                      src={activeProfileUser.avatarUrl}
                      alt={activeProfileUser.name}
                      className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-cover ring-3 ring-white/50 shadow-md"
                    />
                    {isViewingOwnWishlist && (
                      <button
                        onClick={openProfileSettingsModal}
                        title={t.profileSettingsTitle}
                        className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-white text-[#FF5A5F] hover:bg-orange-50 flex items-center justify-center shadow-md ring-2 ring-[#FF5A5F] cursor-pointer"
                      >
                        <Camera className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      <span className="rounded-full bg-white/25 backdrop-blur-xs px-2.5 py-0.5 text-[11px] font-bold text-white">
                        @{activeProfileUser.username}
                      </span>
                      {isViewingOwnWishlist && (
                        <button
                          onClick={openProfileSettingsModal}
                          className="inline-flex items-center gap-1 rounded-full bg-white/95 hover:bg-white px-2.5 py-0.5 text-[11px] font-extrabold text-[#FF5A5F] shadow-2xs cursor-pointer"
                        >
                          <span>👑 {t.ownerBadge}</span>
                          <Settings className="h-3 w-3 ml-0.5" />
                        </button>
                      )}
                      {activeWishlist && (
                        <span className="rounded-full bg-[#FFF3B0]/30 border border-white/30 px-2.5 py-0.5 text-[11px] font-bold text-white">
                          {occasionBadge(activeWishlist.occasion)}
                        </span>
                      )}
                    </div>

                    <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight leading-snug drop-shadow-2xs">
                      {activeWishlist ? activeWishlist.title : activeProfileUser.name}
                    </h1>
                    <p className="mt-1 text-xs sm:text-sm text-white/95 font-medium max-w-2xl line-clamp-2">
                      {activeWishlist
                        ? activeWishlist.description
                        : lang === "ka"
                        ? activeProfileUser.bioKa
                        : activeProfileUser.bioEn}
                    </p>
                  </div>
                </div>

                {/* Stats + Share Button */}
                <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto pt-3 md:pt-0 border-t border-white/20 md:border-none">
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl bg-white/20 backdrop-blur-xs border border-white/25 px-3 py-2 text-center">
                      <p className="text-[10px] font-bold text-white/90">{t.totalWishes}</p>
                      <p className="text-base sm:text-xl font-black text-white">
                        {wishlistItems.length}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/20 backdrop-blur-xs border border-white/25 px-3 py-2 text-center">
                      <p className="text-[10px] font-bold text-white/90">{t.availableWishes}</p>
                      <p className="text-base sm:text-xl font-black text-[#FFF3B0]">
                        {availableCount}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/20 backdrop-blur-xs border border-white/25 px-3 py-2 text-center">
                      <p className="text-[10px] font-bold text-white/90">{t.reservedGiftsCount}</p>
                      <p className="text-base sm:text-xl font-black text-emerald-100">
                        {reservedCount}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/?u=${activeProfileUser.username}`;
                      navigator.clipboard?.writeText(shareUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2500);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white text-[#FF5A5F] hover:bg-orange-50 px-3.5 py-2.5 text-xs font-extrabold shadow-md transition cursor-pointer shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-600" />
                        <span className="text-emerald-700">{t.copiedLink}</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="h-4 w-4 text-[#FF5A5F]" />
                        <span>{t.shareBtn}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Multiple Wishlists Tabs */}
              <div className="mt-5 pt-4 border-t border-white/25 flex items-center gap-2 overflow-x-auto no-scrollbar">
                {profileWishlists.map((wl) => (
                  <button
                    key={wl.id}
                    onClick={() => setSelectedWishlistId(wl.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer shrink-0 ${
                      wl.id === activeWishlist?.id
                        ? "bg-white text-[#FF5A5F] shadow-sm font-extrabold"
                        : "bg-white/20 text-white hover:bg-white/30"
                    }`}
                  >
                    <span>{wl.title}</span>
                    {wl.eventDate && (
                      <span className="text-[10px] opacity-80 hidden sm:inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {wl.eventDate}
                      </span>
                    )}
                  </button>
                ))}

                {isViewingOwnWishlist && (
                  <>
                    <button
                      onClick={() => setIsNewWishlistModalOpen(true)}
                      className="inline-flex items-center gap-1 rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 text-white px-3 py-2 text-xs font-bold transition cursor-pointer shrink-0"
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                      <span>{t.createWishlistBtn}</span>
                    </button>
                    {activeWishlist && (
                      <button
                        onClick={() => setIsAddItemModalOpen(true)}
                        className="inline-flex items-center gap-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 text-xs font-bold shadow-sm transition cursor-pointer shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5 text-[#FFB800]" />
                        <span>{t.addGiftBtn}</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>

          {/* ========================================================= */}
          {/* STATUS FILTER + PRICE FILTER BAR                          */}
          {/* ========================================================= */}
          <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {(
                  [
                    { id: "all", label: t.allItems, count: wishlistItems.length },
                    { id: "available", label: t.availableFilter, count: availableCount },
                    { id: "reserved", label: t.reservedFilter, count: reservedCount },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition cursor-pointer shrink-0 ${
                      statusFilter === tab.id
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                        statusFilter === tab.id
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                >
                  <option value="newest">{t.sortDefault}</option>
                  <option value="priceAsc">{t.sortPriceAsc}</option>
                  <option value="priceDesc">{t.sortPriceDesc}</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 mr-1 shrink-0">
                <SlidersHorizontal className="h-3.5 w-3.5 text-rose-500" />
                <span>{t.priceFilterLabel}</span>
              </span>

              {(
                [
                  { id: "all", label: t.priceAll },
                  { id: "under100", label: t.priceUnder100 },
                  { id: "100to300", label: t.price100to300 },
                  { id: "300to700", label: t.price300to700 },
                  { id: "over700", label: t.priceOver700 },
                ] as const
              ).map((pf) => (
                <button
                  key={pf.id}
                  onClick={() => setPriceFilter(pf.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer shrink-0 ${
                    priceFilter === pf.id
                      ? "bg-gradient-to-r from-[#FF5A5F] to-[#FF7A45] text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-orange-50 border border-slate-200"
                  }`}
                >
                  {pf.label}
                </button>
              ))}
            </div>

            {!isViewingOwnWishlist && (
              <div className="text-xs font-semibold text-amber-950 bg-amber-50/95 border border-amber-200/80 rounded-2xl px-3.5 py-2.5 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#FF7A45] shrink-0" />
                <span>{t.guestHintBanner}</span>
              </div>
            )}
          </section>

          {/* Wishlist Items Grid */}
          <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-5">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-88 rounded-3xl bg-white border border-slate-200 p-5 animate-pulse"
                  />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-3xl bg-white border border-slate-200 p-10 text-center">
                <Gift className="h-10 w-10 text-rose-400 mx-auto mb-2.5" />
                <h3 className="text-base font-bold text-slate-800">
                  {t.noItemsInWishlist}
                </h3>
                {(statusFilter !== "all" || priceFilter !== "all") && (
                  <button
                    onClick={() => {
                      setStatusFilter("all");
                      setPriceFilter("all");
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 text-xs font-bold transition cursor-pointer"
                  >
                    {t.clearFiltersBtn}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredItems.map((item) => {
                  const isReserved = Boolean(item.reservation);
                  const canUnreserve = canVisitorUnreserve(item);

                  return (
                    <div
                      key={item.id}
                      className={`group bg-white rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                        isReserved
                          ? "border-indigo-200/90 bg-slate-50/40"
                          : "border-slate-200/90 shadow-xs hover:shadow-xl"
                      }`}
                    >
                      <div>
                        <div className="relative h-52 sm:h-56 w-full bg-slate-100 overflow-hidden">
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className={`h-full w-full object-cover group-hover:scale-105 transition-transform duration-500 ${
                              isReserved ? "opacity-85" : ""
                            }`}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/20" />

                          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur-md shadow-xs ${
                                item.priority === "high"
                                  ? "bg-rose-600/90 text-white"
                                  : item.priority === "medium"
                                  ? "bg-amber-500/90 text-white"
                                  : "bg-slate-800/80 text-white"
                              }`}
                            >
                              {item.priority === "high"
                                ? t.priorityHigh
                                : item.priority === "medium"
                                ? t.priorityMedium
                                : t.priorityLow}
                            </span>

                            {item.storeName && (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/90 text-slate-800 backdrop-blur-md shadow-xs">
                                🛍️ {item.storeName}
                              </span>
                            )}
                          </div>

                          <div className="absolute top-3 right-3 flex items-center gap-1.5">
                            {isReserved && (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500 text-white shadow-sm">
                                {t.reservedBadge}
                              </span>
                            )}
                            {isViewingOwnWishlist && (
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                title={t.deleteItemConfirm}
                                className="h-8 w-8 rounded-full bg-black/50 hover:bg-[#FF5A5F] text-white flex items-center justify-center transition cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          <div className="absolute bottom-3 left-3.5 right-3.5 flex items-end justify-between text-white">
                            <div>
                              <span className="text-[10px] uppercase tracking-wider text-slate-200 font-medium block">
                                {t.giftPriceLabel}
                              </span>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-xl sm:text-2xl font-black">
                                  {item.price} ₾
                                </span>
                                {item.originalCurrency &&
                                  item.originalCurrency !== "GEL" &&
                                  item.originalPrice && (
                                    <span className="text-[11px] text-slate-200 font-medium">
                                      ({item.originalPrice} {item.originalCurrency})
                                    </span>
                                  )}
                              </div>
                            </div>

                            {item.productUrl && (
                              <a
                                href={item.productUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md px-2.5 py-1.5 text-xs font-semibold text-white transition"
                              >
                                <span>{t.viewProductLink}</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="p-4 sm:p-5">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug line-clamp-2">
                            {item.title}
                          </h3>
                          <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                            {item.description}
                          </p>

                          {item.reservation && (
                            <div className="mt-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2 text-xs text-emerald-950 min-w-0">
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                  <div className="min-w-0">
                                    <span className="text-emerald-800 block truncate">
                                      {t.reservedBy}{" "}
                                      <strong className="text-emerald-950">
                                        {getReservationDisplayName(item)}
                                      </strong>
                                    </span>
                                    {item.reservation.note && (
                                      <p className="mt-0.5 text-slate-600 italic line-clamp-2">
                                        “{item.reservation.note}”
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {canUnreserve && (
                                  <button
                                    onClick={() => handleUnreserve(item)}
                                    className="text-[11px] font-bold text-[#FF5A5F] hover:text-rose-800 underline shrink-0 cursor-pointer"
                                  >
                                    {t.unreserveBtn}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1">
                        {!item.reservation ? (
                          <button
                            onClick={() => {
                              setActiveReserveItem(item);
                              setReserveIsAnonymousForAll(false);
                              if (currentUser) {
                                setReserveName(currentUser.name);
                              }
                            }}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF5A5F] to-[#FF7A45] hover:from-[#FF4248] hover:to-[#FF662A] text-white px-4 py-3 text-xs sm:text-sm font-extrabold shadow-sm shadow-[#FF5A5F]/20 transition cursor-pointer"
                          >
                            <Gift className="h-4 w-4" />
                            <span>{t.reserveGiftBtn}</span>
                          </button>
                        ) : (
                          <div className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-100/80 text-emerald-900 px-4 py-2.5 text-xs font-extrabold">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span>{t.reservedBadge}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: USER LOGIN & REGISTRATION                        */}
      {/* ========================================================= */}
      {authModalMode && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-7 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                {authModalMode === "login" ? (
                  <>
                    <LogIn className="h-5 w-5 text-rose-600" />
                    <span>{t.authLoginTitle}</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-5 w-5 text-rose-600" />
                    <span>{t.authRegisterTitle}</span>
                  </>
                )}
              </h2>
              <button
                onClick={() => setAuthModalMode(null)}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl mt-4">
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setAuthModalMode("login");
                }}
                className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  authModalMode === "login"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600"
                }`}
              >
                {t.loginBtn}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setAuthModalMode("register");
                }}
                className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  authModalMode === "register"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600"
                }`}
              >
                {t.registerBtn}
              </button>
            </div>

            {authError && (
              <div className="mt-3.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">
                {authError}
              </div>
            )}

            <div className="mt-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmittingAuth}
                className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 py-2.5 px-4 text-xs sm:text-sm font-bold shadow-2xs transition cursor-pointer"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 20.9 7.4 24 12 24z"
                  />
                </svg>
                <span>
                  {lang === "ka"
                    ? "Google-ით გაგრძელება"
                    : "Continue with Google"}
                </span>
              </button>

              <div className="relative my-3.5 flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-[11px] text-slate-400 font-semibold uppercase">
                  {lang === "ka" ? "ან" : "OR"}
                </span>
                <div className="border-t border-slate-200 w-full" />
              </div>
            </div>

            {authModalMode === "login" ? (
              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.authIdentifierLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={authIdentifier}
                    onChange={(e) => setAuthIdentifier(e.target.value)}
                    placeholder={t.authIdentifierPlaceholder}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      {t.authPasswordLabel}
                    </label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      {lang === "ka" ? "დაგავიწყდათ პაროლი?" : "Forgot password?"}
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingAuth}
                  className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 text-white py-3 text-sm font-bold shadow-md transition cursor-pointer"
                >
                  {isSubmittingAuth ? "..." : t.loginBtn}
                </button>

                <div className="pt-3 border-t border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-500 mb-2">
                    {t.demoQuickLoginTitle}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleLoginSubmit(e, "nini", "demo123")}
                      className="rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-2 text-xs font-bold text-slate-800 transition cursor-pointer"
                    >
                      👩 ნინი (@nini)
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleLoginSubmit(e, "giorgi", "demo123")}
                      className="rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-2 text-xs font-bold text-slate-800 transition cursor-pointer"
                    >
                      👨 გიორგი (@giorgi)
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.authFullNameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder={t.authFullNamePlaceholder}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.authUsernameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder={t.authUsernamePlaceholder}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.authEmailLabel}
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.authPasswordLabel} *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder={
                      lang === "ka" ? "მინიმუმ 6 სიმბოლო" : "Minimum 6 characters"
                    }
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.authBioLabel}
                  </label>
                  <input
                    type="text"
                    value={regBio}
                    onChange={(e) => setRegBio(e.target.value)}
                    placeholder={t.authBioPlaceholder}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingAuth}
                  className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 text-white py-3 text-sm font-bold shadow-md transition cursor-pointer"
                >
                  {isSubmittingAuth ? "..." : t.registerBtn}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: PROFILE SETTINGS (PHOTO, NAME, EMAIL, PASSWORD)  */}
      {/* ========================================================= */}
      {isProfileSettingsOpen && currentUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <Settings className="h-5 w-5 text-rose-600" />
                  <span>{t.profileSettingsTitle}</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.profileSettingsSub}
                </p>
              </div>
              <button
                onClick={() => setIsProfileSettingsOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {settingsError && (
              <div className="mt-3.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">
                {settingsError}
              </div>
            )}

            <form onSubmit={handleSaveProfileSettings} className="mt-4 space-y-4">
              {/* Profile Picture Section */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  {t.profilePhotoLabel}
                </label>
                <div className="flex items-center gap-3.5">
                  <img
                    src={settingsAvatar || PRESET_AVATARS[0]}
                    alt="Avatar Preview"
                    className="h-16 w-16 rounded-2xl object-cover ring-2 ring-rose-500/30 shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 text-xs font-bold cursor-pointer transition">
                        <Upload className="h-3.5 w-3.5" />
                        <span>{t.uploadNewAvatarBtn}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-1">
                        {t.choosePresetAvatarLabel}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {PRESET_AVATARS.map((av, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSettingsAvatar(av)}
                            className={`h-7 w-7 rounded-full overflow-hidden ring-2 transition cursor-pointer ${
                              settingsAvatar === av
                                ? "ring-rose-600 scale-110"
                                : "ring-transparent opacity-75 hover:opacity-100"
                            }`}
                          >
                            <img
                              src={av}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Name & Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.authFullNameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsName}
                    onChange={(e) => setSettingsName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.authUsernameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsUsername}
                    onChange={(e) => setSettingsUsername(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.authEmailLabel}
                </label>
                <input
                  type="email"
                  required
                  value={settingsEmail}
                  onChange={(e) => setSettingsEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.authBioLabel}
                </label>
                <input
                  type="text"
                  value={settingsBio}
                  onChange={(e) => setSettingsBio(e.target.value)}
                  placeholder={t.authBioPlaceholder}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Change Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.newPasswordLabel}
                </label>
                <input
                  type="password"
                  minLength={6}
                  value={settingsNewPassword}
                  onChange={(e) => setSettingsNewPassword(e.target.value)}
                  placeholder={t.newPasswordPlaceholder}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProfileSettingsOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 text-xs sm:text-sm font-bold shadow-md cursor-pointer"
                >
                  {isSavingSettings ? "..." : t.saveProfileBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: CREATE NEW WISHLIST                              */}
      {/* ========================================================= */}
      {isNewWishlistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-7 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <FolderPlus className="h-5 w-5 text-indigo-600" />
                <span>{t.newWishlistModalTitle}</span>
              </h2>
              <button
                onClick={() => setIsNewWishlistModalOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWishlist} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.wishlistTitleLabel}
                </label>
                <input
                  type="text"
                  required
                  value={wlTitle}
                  onChange={(e) => setWlTitle(e.target.value)}
                  placeholder={t.wishlistTitlePlaceholder}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.occasionLabel}
                  </label>
                  <select
                    value={wlOccasion}
                    onChange={(e) =>
                      setWlOccasion(e.target.value as WishlistRecord["occasion"])
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="birthday">{t.occasionBirthday}</option>
                    <option value="wedding">{t.occasionWedding}</option>
                    <option value="housewarming">{t.occasionHousewarming}</option>
                    <option value="baby">{t.occasionBaby}</option>
                    <option value="christmas">{t.occasionChristmas}</option>
                    <option value="other">{t.occasionOther}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.eventDateLabel}
                  </label>
                  <input
                    type="date"
                    value={wlDate}
                    onChange={(e) => setWlDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.wishlistDescLabel}
                </label>
                <textarea
                  rows={2}
                  value={wlDesc}
                  onChange={(e) => setWlDesc(e.target.value)}
                  placeholder={t.wishlistDescPlaceholder}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewWishlistModalOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-sm font-bold shadow-md cursor-pointer"
                >
                  {t.createWishlistSubmit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: ADD WISH ITEM (URL SCRAPER + TBC RATE OR MANUAL) */}
      {/* ========================================================= */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Plus className="h-5 w-5 text-rose-600" />
                <span>{t.addModalTitle}</span>
              </h2>
              <button
                onClick={() => setIsAddItemModalOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl mt-4">
              <button
                type="button"
                onClick={() => setAddTab("link")}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  addTab === "link"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Link2 className="h-3.5 w-3.5 text-rose-600" />
                <span>{t.tabByLink}</span>
              </button>
              <button
                type="button"
                onClick={() => setAddTab("manual")}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  addTab === "manual"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Upload className="h-3.5 w-3.5 text-indigo-600" />
                <span>{t.tabManual}</span>
              </button>
            </div>

            {addTab === "link" && (
              <div className="mt-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/80 p-3.5">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.pasteUrlLabel}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://www.amazon.com/... ან https://veli.store/..."
                    className="flex-1 min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAutoScrape()}
                    disabled={isScraping}
                    className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 text-xs font-bold shrink-0 transition cursor-pointer"
                  >
                    {isScraping ? "..." : t.fetchBtn}
                  </button>
                </div>

                <div className="mt-2.5">
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">
                    {t.presetStoreLinksTitle}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      {
                        label: "Amazon (USD->₾)",
                        url: "https://www.amazon.com/dp/B0CHWRXH8B",
                      },
                      {
                        label: "Zoommer.ge",
                        url: "https://zoommer.ge/airpods-pro-2",
                      },
                      {
                        label: "Veli.store",
                        url: "https://veli.store/stanley-quencher",
                      },
                      {
                        label: "Extra.ge",
                        url: "https://extra.ge/delonghi-dedica",
                      },
                    ].map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => {
                          setUrlInput(preset.url);
                          handleAutoScrape(preset.url);
                        }}
                        className="text-[11px] bg-white hover:bg-rose-100 text-slate-700 border border-slate-200 rounded-lg px-2 py-1 font-medium transition cursor-pointer"
                      >
                        ⚡ {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateWishItem} className="mt-4 space-y-3.5">
              {conversionInfo && (
                <div className="rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-950">
                  🏦{" "}
                  {lang === "ka"
                    ? `თიბისი ბანკის კურსით: ${conversionInfo.originalPrice} ${conversionInfo.originalCurrency} × ${conversionInfo.exchangeRateUsed} = ${newPrice} ₾`
                    : `TBC Bank rate: ${conversionInfo.originalPrice} ${conversionInfo.originalCurrency} × ${conversionInfo.exchangeRateUsed} = ${newPrice} ₾`}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.itemNameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={t.itemNamePlaceholder}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.itemPriceLabel}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="250"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.itemStoreLabel}
                  </label>
                  <input
                    type="text"
                    value={newStore}
                    onChange={(e) => setNewStore(e.target.value)}
                    placeholder={t.itemStorePlaceholder}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.priorityLabel}
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) =>
                      setNewPriority(e.target.value as "high" | "medium" | "low")
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="high">{t.priorityHigh}</option>
                    <option value="medium">{t.priorityMedium}</option>
                    <option value="low">{t.priorityLow}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.itemImageLabel}
                </label>
                <div className="flex gap-2 items-center">
                  {newImage && (
                    <img
                      src={newImage}
                      alt="Preview"
                      className="h-10 w-10 rounded-xl object-contain border border-slate-200 bg-white p-0.5 shrink-0"
                    />
                  )}
                  <input
                    type="text"
                    value={newImage}
                    onChange={(e) => setNewImage(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 min-w-0 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <label className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-2 text-xs font-bold text-slate-700 cursor-pointer shrink-0">
                    <Upload className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t.uploadPhotoBtn}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.itemDescLabel}
                </label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={t.itemDescPlaceholder}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddItemModalOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 text-xs sm:text-sm font-bold shadow-md cursor-pointer"
                >
                  {t.saveWishBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: RESERVE GIFT (NAMED OR ANONYMOUS FOR ALL ONLY)   */}
      {/* ========================================================= */}
      {activeReserveItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-7 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Gift className="h-5 w-5 text-indigo-600" />
                <span>{t.reserveModalTitle}</span>
              </h2>
              <button
                onClick={() => setActiveReserveItem(null)}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3.5 flex items-center gap-3 rounded-2xl bg-slate-50 p-3 border border-slate-200/80">
              <img
                src={activeReserveItem.imageUrl}
                alt={activeReserveItem.title}
                className="h-12 w-12 rounded-xl object-cover shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  {activeReserveItem.title}
                </h4>
                <p className="text-xs font-extrabold text-rose-600 mt-0.5">
                  {activeReserveItem.price} ₾
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              {t.reserveModalDesc}
            </p>

            <div className="mt-3">
              {currentUser ? (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-900 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="truncate">
                    {t.reservingAsLoggedUser}{" "}
                    <strong>
                      {currentUser.name} (@{currentUser.username})
                    </strong>
                  </span>
                </div>
              ) : (
                <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-2 text-xs text-indigo-900 flex items-center justify-between gap-2">
                  <span>✨ {t.reservingAsGuestBadge}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReserveItem(null);
                      setAuthModalMode("login");
                    }}
                    className="font-bold underline text-indigo-700 cursor-pointer shrink-0"
                  >
                    {t.loginBtn}
                  </button>
                </div>
              )}
            </div>

            <form onSubmit={handleReserveSubmit} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setReserveIsAnonymousForAll(false)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    !reserveIsAnonymousForAll
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600"
                  }`}
                >
                  <Eye className="h-3.5 w-3.5 text-indigo-600" />
                  <span>{lang === "ka" ? "სახელით" : "With My Name"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReserveIsAnonymousForAll(true)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    reserveIsAnonymousForAll
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600"
                  }`}
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  <span>
                    {lang === "ka"
                      ? "ანონიმურად (ყველასთვის)"
                      : "Anonymous for All"}
                  </span>
                </button>
              </div>

              {reserveIsAnonymousForAll ? (
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 flex items-start gap-2">
                  <EyeOff className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>{t.anonymousForAllHint}</span>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.yourNameLabel}
                  </label>
                  <input
                    type="text"
                    required={!reserveIsAnonymousForAll}
                    value={reserveName}
                    onChange={(e) => setReserveName(e.target.value)}
                    placeholder={t.yourNamePlaceholder}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.reserveNoteLabel}
                </label>
                <input
                  type="text"
                  value={reserveNote}
                  onChange={(e) => setReserveNote(e.target.value)}
                  placeholder={t.reserveNotePlaceholder}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white py-3 text-sm font-bold shadow-md transition cursor-pointer"
              >
                {t.confirmReserveBtn}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
