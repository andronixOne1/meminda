"use client";

import React, { useState, useEffect, useCallback } from "react";
import confetti from "canvas-confetti";
import {
  Gift,
  Plus,
  Share2,
  Globe,
  ExternalLink,
  Check,
  Sparkles,
  Users,
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
} from "lucide-react";
import { TRANSLATIONS, Language } from "@/lib/meminda-data";
import type { PublicUser } from "@/lib/auth";
import type { WishlistRecord, WishItemRecord } from "@/lib/db";

const GUEST_TOKENS_STORAGE_KEY = "meminda_guest_cancel_tokens_v1";

export default function MemindaApp() {
  const [lang, setLang] = useState<Language>("ka");
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [wishlists, setWishlists] = useState<WishlistRecord[]>([]);
  const [items, setItems] = useState<WishItemRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Navigation & Active Selection State
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedWishlistId, setSelectedWishlistId] = useState<string>("");
  const [filter, setFilter] = useState<"all" | "available" | "reserved">("all");
  const [spoilerFreeForOwner, setSpoilerFreeForOwner] = useState<boolean>(false);

  // Guest cancel tokens stored in browser localStorage so unauthenticated guests can cancel their own reservations
  const [guestCancelTokens, setGuestCancelTokens] = useState<Record<string, string>>({});

  // UI Feedback
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals State
  const [authModalMode, setAuthModalMode] = useState<"login" | "register" | null>(null);
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

  // Reserve Gift Form State
  const [reserveName, setReserveName] = useState("");
  const [reserveNote, setReserveNote] = useState("");
  const [reserveHidePublic, setReserveHidePublic] = useState(false);
  const [reserveHideOwner, setReserveHideOwner] = useState(false);

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

  // Load guest cancel tokens from localStorage
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

  const fetchAllData = useCallback(async (preferredUserId?: string, preferredWishlistId?: string) => {
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

      // Check URL query parameters (?u=username&wl=slug)
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
    } catch (e) {
      console.error("Failed to fetch wishlists:", e);
    } finally {
      setIsLoading(false);
    }
  }, [selectedUserId, selectedWishlistId]);

  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const filteredItems = wishlistItems.filter((item) => {
    if (filter === "available") return !item.reservation;
    if (filter === "reserved") return Boolean(item.reservation);
    return true;
  });

  // Switch active user profile
  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    const userWls = wishlists.filter((w) => w.ownerId === userId);
    setSelectedWishlistId(userWls[0]?.id || "");
    setFilter("all");
  };

  // Auth Handlers
  const handleLoginSubmit = async (e: React.FormEvent, quickIdent?: string, quickPass?: string) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmittingAuth(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: quickIdent ?? authIdentifier,
          password: quickPass ?? authPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Login error");
        return;
      }
      setAuthModalMode(null);
      setAuthIdentifier("");
      setAuthPassword("");
      await fetchAllData(data.user.id);
      showToast(
        lang === "ka"
          ? `👋 მოგესალმებით, ${data.user.name}!`
          : `👋 Welcome back, ${data.user.name}!`
      );
    } catch {
      setAuthError("Network error");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmittingAuth(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName,
          username: regUsername,
          email: regEmail,
          password: authPassword,
          bio: regBio,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Registration error");
        return;
      }
      setAuthModalMode(null);
      setRegName("");
      setRegUsername("");
      setRegEmail("");
      setRegBio("");
      setAuthPassword("");
      await fetchAllData(data.user.id, data.defaultWishlistId);
      triggerConfetti();
      showToast(
        lang === "ka"
          ? `🎉 ანგარიში შეიქმნა! კეთილი იყოს თქვენი მობრძანება, ${data.user.name}!`
          : `🎉 Account created! Welcome to Meminda, ${data.user.name}!`
      );
    } catch {
      setAuthError("Network error");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = async () => {
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
      await fetchAllData(currentUser?.id, data.wishlist.id);
      showToast(
        lang === "ka"
          ? "✨ ახალი სურვილების სია შეიქმნა!"
          : "✨ New wishlist created!"
      );
    }
  };

  // URL Auto-Scrape Handler (with TBC Bank currency conversion)
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
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setNewImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
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
      await fetchAllData(activeProfileUser?.id, activeWishlist.id);
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
      await fetchAllData(activeProfileUser?.id, activeWishlist?.id);
      showToast(lang === "ka" ? "სურვილი წაიშალა" : "Wish item removed");
    }
  };

  // Reserve Gift Submit (Works for BOTH Logged-in Users AND Unregistered Guests)
  const handleReserveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReserveItem) return;

    const finalName = currentUser
      ? reserveName.trim() || currentUser.name
      : reserveName.trim();

    if (!finalName) return;

    const res = await fetch("/api/items/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reserve",
        itemId: activeReserveItem.id,
        reservedByName: finalName,
        isAnonymousToPublic: reserveHidePublic,
        hideFromOwnerSpoilerFree: reserveHideOwner,
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
      setReserveHidePublic(false);
      setReserveHideOwner(false);
      await fetchAllData(activeProfileUser?.id, activeWishlist?.id);
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
      await fetchAllData(activeProfileUser?.id, activeWishlist?.id);
      showToast(lang === "ka" ? "ჯავშანი გაუქმდა" : "Reservation cancelled");
    } else {
      showToast(data.error || "Cannot unreserve");
    }
  };

  // Determine if the current visitor can cancel a specific reservation
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

  // Format reservation display name respecting privacy & owner spoiler settings
  const getReservationDisplayName = (item: WishItemRecord): string => {
    const r = item.reservation;
    if (!r) return "";
    if (
      (currentUser && r.reservedByUserId === currentUser.id) ||
      guestCancelTokens[item.id]
    ) {
      return `${r.reservedByName} (${lang === "ka" ? "თქვენ" : "You"})`;
    }
    if (isViewingOwnWishlist && (r.hideFromOwnerSpoilerFree || spoilerFreeForOwner)) {
      return t.spoilerHiddenForOwner;
    }
    if (!isViewingOwnWishlist && r.isAnonymousToPublic) {
      return t.anonymousFriend;
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
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 pb-24">
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-slate-900 px-5 py-4 text-sm font-medium text-white shadow-2xl border border-slate-700 animate-bounce">
          <Sparkles className="h-5 w-5 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Community & Language Switcher Bar */}
      <div className="bg-slate-900 text-white text-xs py-2.5 px-4 border-b border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Directory of Users to Browse */}
          <div className="flex items-center gap-2 overflow-x-auto py-0.5">
            <span className="text-slate-400 font-medium flex items-center gap-1.5 shrink-0">
              <Users className="h-3.5 w-3.5 text-rose-400" />
              <span>{t.exploreUsersTitle}:</span>
            </span>
            <div className="flex items-center gap-1.5">
              {users.map((u) => {
                const isSelected = u.id === activeProfileUser?.id;
                const isMe = currentUser?.id === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => handleSelectUser(u.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer shrink-0 ${
                      isSelected
                        ? "bg-rose-600 text-white shadow"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                    }`}
                  >
                    <img
                      src={u.avatarUrl}
                      alt={u.name}
                      className="h-4 w-4 rounded-full object-cover"
                    />
                    <span>{u.name}</span>
                    {isMe && (
                      <span className="text-[10px] bg-white/20 px-1.5 rounded">
                        {lang === "ka" ? "მე" : "Me"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Language Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            <Globe className="h-3.5 w-3.5 text-slate-400" />
            <button
              onClick={() => setLang("ka")}
              className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer ${
                lang === "ka"
                  ? "bg-white text-slate-900"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🇬🇪 ქართული
            </button>
            <button
              onClick={() => setLang("en")}
              className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer ${
                lang === "en"
                  ? "bg-white text-slate-900"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🇬🇧 English
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Header */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/90 border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4 py-3.5">
          <div
            onClick={() => {
              if (currentUser) handleSelectUser(currentUser.id);
            }}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-rose-600 via-pink-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
              <Gift className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight bg-gradient-to-r from-rose-600 to-indigo-700 bg-clip-text text-transparent">
                  meminda
                </span>
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                  მემინდა
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">{t.brandSub}</p>
            </div>
          </div>

          {/* Right Auth & Action Controls */}
          <div className="flex items-center gap-2.5">
            {currentUser ? (
              <>
                <button
                  onClick={() => handleSelectUser(currentUser.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition cursor-pointer ${
                    isViewingOwnWishlist
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                  }`}
                >
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="h-5 w-5 rounded-full object-cover"
                  />
                  <span className="hidden sm:inline">{currentUser.name}</span>
                </button>

                <button
                  onClick={() => {
                    handleSelectUser(currentUser.id);
                    setIsNewWishlistModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 px-3.5 py-2 text-xs sm:text-sm font-bold transition cursor-pointer"
                >
                  <FolderPlus className="h-4 w-4 text-indigo-600" />
                  <span className="hidden md:inline">{t.createWishlistBtn}</span>
                </button>

                {isViewingOwnWishlist && activeWishlist && (
                  <button
                    onClick={() => setIsAddItemModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs sm:text-sm font-bold shadow-md shadow-rose-600/20 transition cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t.addGiftBtn}</span>
                  </button>
                )}

                <button
                  onClick={handleLogout}
                  title={t.logoutBtn}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 px-3 py-2 text-xs font-semibold transition cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden lg:inline">{t.logoutBtn}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setAuthError(null);
                    setAuthModalMode("login");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-2 text-xs sm:text-sm font-bold transition cursor-pointer"
                >
                  <LogIn className="h-4 w-4" />
                  <span>{t.loginBtn}</span>
                </button>

                <button
                  onClick={() => {
                    setAuthError(null);
                    setAuthModalMode("register");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs sm:text-sm font-bold shadow-md shadow-rose-600/20 transition cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>{t.registerBtn}</span>
                </button>
              </>
            )}

            <button
              onClick={() => {
                const shareUrl = activeProfileUser
                  ? `${window.location.origin}/?u=${activeProfileUser.username}`
                  : window.location.href;
                navigator.clipboard?.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-2 text-xs sm:text-sm font-medium transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">{t.copiedLink}</span>
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.shareBtn}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Profile & Wishlists Switcher Banner */}
      {activeProfileUser && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-rose-950 text-white p-6 sm:p-10 shadow-xl">
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <img
                  src={activeProfileUser.avatarUrl}
                  alt={activeProfileUser.name}
                  className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl object-cover ring-4 ring-white/20 shadow-lg"
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="rounded-full bg-white/15 backdrop-blur px-3 py-0.5 text-xs font-semibold text-rose-200">
                      @{activeProfileUser.username}
                    </span>
                    {isViewingOwnWishlist && (
                      <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-0.5 text-xs font-bold text-emerald-300">
                        👑 {t.ownerBadge}
                      </span>
                    )}
                    {activeWishlist && (
                      <span className="rounded-full bg-amber-400/20 px-3 py-0.5 text-xs font-semibold text-amber-200">
                        {occasionBadge(activeWishlist.occasion)}
                      </span>
                    )}
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    {activeWishlist ? activeWishlist.title : activeProfileUser.name}
                  </h1>
                  <p className="mt-1.5 text-sm sm:text-base text-slate-200 max-w-2xl leading-relaxed">
                    {activeWishlist
                      ? activeWishlist.description
                      : lang === "ka"
                      ? activeProfileUser.bioKa
                      : activeProfileUser.bioEn}
                  </p>
                </div>
              </div>

              {/* Wishlist Counters */}
              <div className="grid grid-cols-3 gap-2.5 w-full md:w-auto shrink-0">
                <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 px-4 py-3 text-center">
                  <p className="text-[11px] text-slate-300">{t.totalWishes}</p>
                  <p className="text-2xl font-black text-white mt-0.5">
                    {wishlistItems.length}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 px-4 py-3 text-center">
                  <p className="text-[11px] text-slate-300">{t.availableWishes}</p>
                  <p className="text-2xl font-black text-amber-300 mt-0.5">
                    {availableCount}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 px-4 py-3 text-center">
                  <p className="text-[11px] text-slate-300">{t.reservedGiftsCount}</p>
                  <p className="text-2xl font-black text-emerald-300 mt-0.5">
                    {reservedCount}
                  </p>
                </div>
              </div>
            </div>

            {/* Multiple Wishlists Tabs for This User */}
            <div className="mt-6 pt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {profileWishlists.map((wl) => (
                  <button
                    key={wl.id}
                    onClick={() => setSelectedWishlistId(wl.id)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition cursor-pointer ${
                      wl.id === activeWishlist?.id
                        ? "bg-white text-slate-900 shadow-md"
                        : "bg-white/10 text-slate-200 hover:bg-white/20"
                    }`}
                  >
                    <span>{wl.title}</span>
                    {wl.eventDate && (
                      <span className="text-[11px] opacity-75 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {wl.eventDate}
                      </span>
                    )}
                  </button>
                ))}

                {isViewingOwnWishlist && (
                  <button
                    onClick={() => setIsNewWishlistModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 px-3.5 py-2 text-xs font-bold transition cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{t.createWishlistBtn}</span>
                  </button>
                )}
              </div>

              {isViewingOwnWishlist && (
                <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={spoilerFreeForOwner}
                    onChange={(e) => setSpoilerFreeForOwner(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>🤫 {t.spoilerModeToggle}</span>
                </label>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Filter Bar & Guest Friendly Reservation Hint */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: "all", label: t.allItems, count: wishlistItems.length },
                { id: "available", label: t.availableFilter, count: availableCount },
                { id: "reserved", label: t.reservedFilter, count: reservedCount },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition cursor-pointer ${
                  filter === tab.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    filter === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {!isViewingOwnWishlist && (
            <div className="text-xs font-medium text-indigo-900 bg-indigo-50 border border-indigo-200 rounded-xl px-3.5 py-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
              <span>{t.guestHintBanner}</span>
            </div>
          )}
        </div>
      </section>

      {/* Wishlist Items Grid */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-96 rounded-3xl bg-white border border-slate-200 p-6 animate-pulse"
              />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-3xl bg-white border border-slate-200 p-12 text-center">
            <Gift className="h-12 w-12 text-rose-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800">{t.noItemsInWishlist}</h3>
            {isViewingOwnWishlist && (
              <button
                onClick={() => setIsAddItemModalOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 text-sm font-bold shadow-md transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>{t.addGiftBtn}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => {
              const isReserved = Boolean(item.reservation);
              const canUnreserve = canVisitorUnreserve(item);

              return (
                <div
                  key={item.id}
                  className={`group bg-white rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                    isReserved
                      ? "border-indigo-200/90 bg-slate-50/40"
                      : "border-slate-200/90 shadow-sm hover:shadow-xl"
                  }`}
                >
                  <div>
                    {/* Product Image Header */}
                    <div className="relative h-56 w-full bg-slate-100 overflow-hidden">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className={`h-full w-full object-cover group-hover:scale-105 transition-transform duration-500 ${
                          isReserved ? "opacity-85" : ""
                        }`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/20" />

                      {/* Priority & Store Badges */}
                      <div className="absolute top-3.5 left-3.5 flex flex-wrap gap-1.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur-md shadow-sm ${
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
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/90 text-slate-800 backdrop-blur-md shadow-sm">
                            🛍️ {item.storeName}
                          </span>
                        )}
                      </div>

                      {/* Reserved Badge & Owner Delete */}
                      <div className="absolute top-3.5 right-3.5 flex items-center gap-2">
                        {isReserved && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-md">
                            {t.reservedBadge}
                          </span>
                        )}
                        {isViewingOwnWishlist && (
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            title={t.deleteItemConfirm}
                            className="h-8 w-8 rounded-full bg-black/50 hover:bg-rose-600 text-white flex items-center justify-center transition cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Price & Store Link on Image Bottom */}
                      <div className="absolute bottom-3.5 left-4 right-4 flex items-end justify-between text-white">
                        <div>
                          <span className="text-[11px] uppercase tracking-wider text-slate-200 font-medium block">
                            {t.giftPriceLabel}
                          </span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black">{item.price} ₾</span>
                            {item.originalCurrency &&
                              item.originalCurrency !== "GEL" &&
                              item.originalPrice && (
                                <span className="text-xs text-slate-200 font-medium">
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
                            className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-white transition"
                          >
                            <span>{t.viewProductLink}</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Item Title & Description */}
                    <div className="p-5">
                      <h3 className="text-base font-bold text-slate-900 leading-snug line-clamp-2">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 text-xs sm:text-sm text-slate-600 line-clamp-3">
                        {item.description}
                      </p>

                      {/* Reservation Details Box */}
                      {item.reservation && (
                        <div className="mt-4 rounded-2xl bg-indigo-50/90 border border-indigo-200 p-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 text-xs text-indigo-950">
                              <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="text-indigo-700 block">
                                  {t.reservedBy}{" "}
                                  <strong className="text-indigo-950">
                                    {getReservationDisplayName(item)}
                                  </strong>
                                </span>
                                {item.reservation.note &&
                                  !(
                                    isViewingOwnWishlist &&
                                    (item.reservation.hideFromOwnerSpoilerFree ||
                                      spoilerFreeForOwner)
                                  ) && (
                                    <p className="mt-1 text-slate-600 italic">
                                      “{item.reservation.note}”
                                    </p>
                                  )}
                              </div>
                            </div>

                            {canUnreserve && (
                              <button
                                onClick={() => handleUnreserve(item)}
                                className="text-[11px] font-bold text-rose-600 hover:text-rose-800 underline shrink-0 cursor-pointer"
                              >
                                {t.unreserveBtn}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Action Button */}
                  <div className="px-5 pb-5 pt-1">
                    {!item.reservation ? (
                      <button
                        onClick={() => {
                          setActiveReserveItem(item);
                          if (currentUser) {
                            setReserveName(currentUser.name);
                          }
                        }}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 hover:bg-rose-600 text-white px-4 py-3 text-sm font-bold shadow-sm transition cursor-pointer"
                      >
                        <Gift className="h-4 w-4" />
                        <span>{t.reserveGiftBtn}</span>
                      </button>
                    ) : (
                      <div className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-100/80 text-indigo-900 px-4 py-2.5 text-xs font-bold">
                        <Lock className="h-3.5 w-3.5 text-indigo-600" />
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

      {/* ========================================================= */}
      {/* MODAL 1: USER LOGIN & REGISTRATION                        */}
      {/* ========================================================= */}
      {authModalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
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
                className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Switch Login / Register Tab */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl mt-4">
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setAuthModalMode("login");
                }}
                className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  authModalMode === "login"
                    ? "bg-white text-slate-900 shadow-sm"
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
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                {t.registerBtn}
              </button>
            </div>

            {authError && (
              <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
                {authError}
              </div>
            )}

            {authModalMode === "login" ? (
              <form onSubmit={handleLoginSubmit} className="mt-5 space-y-4">
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.authPasswordLabel}
                  </label>
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

                {/* Quick Demo Account Logins */}
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
              <form onSubmit={handleRegisterSubmit} className="mt-5 space-y-3.5">
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
                    minLength={4}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="მინიმუმ 4 სიმბოლო"
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
      {/* MODAL 2: CREATE NEW WISHLIST                              */}
      {/* ========================================================= */}
      {isNewWishlistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
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

            <form onSubmit={handleCreateWishlist} className="mt-5 space-y-4">
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
      {/* MODAL 3: ADD WISH ITEM (URL SCRAPER + TBC RATE OR MANUAL) */}
      {/* ========================================================= */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <Plus className="h-5 w-5 text-rose-600" />
                <span>{t.addModalTitle}</span>
              </h2>
              <button
                onClick={() => setIsAddItemModalOpen(false)}
                className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl mt-5">
              <button
                type="button"
                onClick={() => setAddTab("link")}
                className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  addTab === "link"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Link2 className="h-4 w-4 text-rose-600" />
                <span>{t.tabByLink}</span>
              </button>
              <button
                type="button"
                onClick={() => setAddTab("manual")}
                className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  addTab === "manual"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Upload className="h-4 w-4 text-indigo-600" />
                <span>{t.tabManual}</span>
              </button>
            </div>

            {addTab === "link" && (
              <div className="mt-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 p-4">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  {t.pasteUrlLabel}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://www.amazon.com/... ან https://veli.store/..."
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAutoScrape()}
                    disabled={isScraping}
                    className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 text-xs font-bold shrink-0 transition cursor-pointer"
                  >
                    {isScraping ? "..." : t.fetchBtn}
                  </button>
                </div>

                <div className="mt-3">
                  <p className="text-[11px] font-semibold text-slate-500 mb-1.5">
                    {t.presetStoreLinksTitle}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      {
                        label: "Amazon.com (USD -> ₾ TBC)",
                        url: "https://www.amazon.com/dp/B0CHWRXH8B",
                      },
                      {
                        label: "Zoommer.ge (AirPods)",
                        url: "https://zoommer.ge/airpods-pro-2",
                      },
                      {
                        label: "Veli.store (Stanley)",
                        url: "https://veli.store/stanley-quencher",
                      },
                      {
                        label: "Extra.ge (DeLonghi)",
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
                        className="text-[11px] bg-white hover:bg-rose-100 text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1 font-medium transition cursor-pointer"
                      >
                        ⚡ {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateWishItem} className="mt-5 space-y-4">
              {conversionInfo && (
                <div className="rounded-xl bg-sky-50 border border-sky-200 px-3.5 py-2.5 text-xs text-sky-950 flex items-center justify-between gap-2">
                  <span>
                    🏦{" "}
                    {lang === "ka"
                      ? `ფასი კონვერტირებულია თიბისი ბანკის კურსით: ${conversionInfo.originalPrice} ${conversionInfo.originalCurrency} × ${conversionInfo.exchangeRateUsed} = ${newPrice} ₾`
                      : `Converted via TBC Bank rate: ${conversionInfo.originalPrice} ${conversionInfo.originalCurrency} × ${conversionInfo.exchangeRateUsed} = ${newPrice} ₾`}
                  </span>
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
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
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
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.itemStoreLabel}
                  </label>
                  <input
                    type="text"
                    value={newStore}
                    onChange={(e) => setNewStore(e.target.value)}
                    placeholder={t.itemStorePlaceholder}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
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
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
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
                <div className="flex flex-col sm:flex-row gap-2 items-center">
                  {newImage && (
                    <img
                      src={newImage}
                      alt="Preview"
                      className="h-11 w-11 rounded-xl object-contain border border-slate-200 bg-white p-0.5 shrink-0"
                    />
                  )}
                  <input
                    type="text"
                    value={newImage}
                    onChange={(e) => setNewImage(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <label className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 cursor-pointer shrink-0">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{t.uploadPhotoBtn}</span>
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
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddItemModalOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-6 py-2.5 text-sm font-bold shadow-md shadow-rose-600/20 cursor-pointer"
                >
                  {t.saveWishBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: RESERVE GIFT (ACCOUNT OR GUEST WITHOUT REG)      */}
      {/* ========================================================= */}
      {activeReserveItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
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

            {/* Mini Item Preview */}
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-3 border border-slate-200/80">
              <img
                src={activeReserveItem.imageUrl}
                alt={activeReserveItem.title}
                className="h-14 w-14 rounded-xl object-cover shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-slate-900 truncate">
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

            {/* Badge showing whether reserving as registered user or guest */}
            <div className="mt-3">
              {currentUser ? (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-900 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
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
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.yourNameLabel}
                </label>
                <input
                  type="text"
                  required
                  value={reserveName}
                  onChange={(e) => setReserveName(e.target.value)}
                  placeholder={t.yourNamePlaceholder}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

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

              {/* Privacy & Surprise Options */}
              <div className="space-y-2 rounded-2xl bg-slate-50 border border-slate-200 p-3">
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reserveHideOwner}
                    onChange={(e) => setReserveHideOwner(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold">🤫 {t.hideFromOwnerLabel}</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reserveHidePublic}
                    onChange={(e) => setReserveHidePublic(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="flex items-center gap-1">
                    <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                    {t.hideNameFromOthersLabel}
                  </span>
                </label>
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
