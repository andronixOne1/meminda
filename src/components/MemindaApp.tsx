"use client";

import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import {
  Gift,
  Plus,
  Wallet,
  Share2,
  Globe,
  ExternalLink,
  Check,
  Sparkles,
  Users,
  Eye,
  EyeOff,
  AlertTriangle,
  Building2,
  CreditCard,
  Upload,
  Link2,
  Trash2,
  Heart,
  Lock,
  CheckCircle2,
  ArrowUpRight,
  Calendar,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  INITIAL_WISHLIST_PROFILE,
  TRANSLATIONS,
  Language,
  WishlistProfile,
  WishItem,
} from "@/lib/meminda-data";

const STORAGE_KEY = "meminda_wishlist_v1";

export default function MemindaApp() {
  const [lang, setLang] = useState<Language>("ka");
  const [viewMode, setViewMode] = useState<"owner" | "guest">("owner");
  const [profile, setProfile] = useState<WishlistProfile>(INITIAL_WISHLIST_PROFILE);
  const [filter, setFilter] = useState<"all" | "crowdfunding" | "available" | "completed">("all");
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeContributeItem, setActiveContributeItem] = useState<WishItem | null>(null);
  const [activeReserveItem, setActiveReserveItem] = useState<WishItem | null>(null);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [selectedWithdrawItemId, setSelectedWithdrawItemId] = useState<string>("");

  // Add Item Form State
  const [addTab, setAddTab] = useState<"link" | "manual">("link");
  const [urlInput, setUrlInput] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newStore, setNewStore] = useState("");
  const [newImage, setNewImage] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("high");
  const [newAllowCrowdfunding, setNewAllowCrowdfunding] = useState(true);
  const [conversionInfo, setConversionInfo] = useState<{
    originalPrice: number;
    originalCurrency: string;
    exchangeRateUsed: number;
    rateSource: string;
  } | null>(null);

  // Contribute Form State
  const [contribAmount, setContribAmount] = useState<string>("50");
  const [contribIsAnonymous, setContribIsAnonymous] = useState<boolean>(false);
  const [contribName, setContribName] = useState<string>("");
  const [contribMessage, setContribMessage] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"tbc" | "bog" | "apple">("tbc");

  // Reserve Form State
  const [reserveName, setReserveName] = useState<string>("");
  const [reserveIsAnonymous, setReserveIsAnonymous] = useState<boolean>(false);

  // Withdraw Form State
  const [ibanInput, setIbanInput] = useState<string>(INITIAL_WISHLIST_PROFILE.savedIban);
  const [recipientNameInput, setRecipientNameInput] = useState<string>("ნინი შენგელია");
  const [acknowledgePartialWarning, setAcknowledgePartialWarning] = useState<boolean>(false);

  const t = TRANSLATIONS[lang];

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.items) {
          setProfile(parsed);
          setIbanInput(parsed.savedIban || INITIAL_WISHLIST_PROFILE.savedIban);
        }
      }
    } catch {
      // Ignore storage error
    }
  }, []);

  const saveProfile = (updated: WishlistProfile) => {
    setProfile(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage error
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 70,
        spread: 65,
        origin: { y: 0.6 },
      });
    } catch {
      // Ignore confetti error
    }
  };

  // Computed Wallet Metrics
  const totalRaised = profile.items.reduce((sum, item) => sum + item.collectedAmount, 0);
  const totalWithdrawn = profile.items.reduce((sum, item) => sum + item.withdrawnAmount, 0);
  const totalAvailableToWithdraw = profile.items.reduce(
    (sum, item) => sum + Math.max(0, item.collectedAmount - item.withdrawnAmount),
    0
  );
  const reservedCount = profile.items.filter((item) => Boolean(item.reservation)).length;

  // Filtered Items
  const filteredItems = profile.items.filter((item) => {
    const isCompleted = item.collectedAmount >= item.price || Boolean(item.reservation);
    if (filter === "crowdfunding") return item.allowCrowdfunding;
    if (filter === "available") return !isCompleted;
    if (filter === "completed") return isCompleted;
    return true;
  });

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

  // Image File Upload (converts to Data URL for instant local preview)
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

  // Add New Wish Item
  const handleCreateWishItem = (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = Math.max(1, Math.round(Number(newPrice) || 100));
    if (!newTitle.trim()) return;

    const newItem: WishItem = {
      id: `item-${Date.now()}`,
      title: newTitle.trim(),
      description:
        newDesc.trim() ||
        (lang === "ka" ? "სასურველი საჩუქარი ჩემი სიიდან" : "A wished item from my list"),
      price: numericPrice,
      imageUrl:
        newImage.trim() ||
        "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=900&q=80",
      productUrl: urlInput.trim() || undefined,
      storeName: newStore.trim() || undefined,
      priority: newPriority,
      allowCrowdfunding: newAllowCrowdfunding,
      collectedAmount: 0,
      withdrawnAmount: 0,
      contributions: [],
      reservation: null,
      createdAt: new Date().toISOString(),
    };

    const updated: WishlistProfile = {
      ...profile,
      items: [newItem, ...profile.items],
    };
    saveProfile(updated);
    setIsAddModalOpen(false);
    setUrlInput("");
    setNewTitle("");
    setNewPrice("");
    setNewStore("");
    setNewImage("");
    setNewDesc("");
    showToast(
      lang === "ka"
        ? "✨ ახალი სურვილი წარმატებით დაემატა თქვენს სიას!"
        : "✨ New wish item added to your wishlist!"
    );
  };

  // Handle Contribution
  const handleContributeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContributeItem) return;
    const amountNum = Math.max(1, Math.round(Number(contribAmount) || 0));
    if (amountNum <= 0) return;

    const displayName = contribIsAnonymous
      ? lang === "ka"
        ? "ანონიმური"
        : "Anonymous"
      : contribName.trim() || (lang === "ka" ? "მეგობარი" : "A Friend");

    const newContribution = {
      id: `contrib-${Date.now()}`,
      contributorName: displayName,
      isAnonymous: contribIsAnonymous,
      amount: amountNum,
      message: contribMessage.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const updatedItems = profile.items.map((item) => {
      if (item.id !== activeContributeItem.id) return item;
      return {
        ...item,
        collectedAmount: item.collectedAmount + amountNum,
        contributions: [newContribution, ...item.contributions],
      };
    });

    saveProfile({ ...profile, items: updatedItems });
    setActiveContributeItem(null);
    setContribAmount("50");
    setContribName("");
    setContribMessage("");
    setContribIsAnonymous(false);
    triggerConfetti();
    showToast(
      lang === "ka"
        ? `🎉 მადლობა! ${amountNum} ₾ წარმატებით ჩაირიცხა ყულაბაში!`
        : `🎉 Thank you! ${amountNum} ₾ has been added to the gift fund!`
    );
  };

  // Handle Gift Reservation
  const handleReserveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReserveItem) return;

    const displayName = reserveIsAnonymous
      ? lang === "ka"
        ? "ანონიმური მეგობარი"
        : "Anonymous Friend"
      : reserveName.trim() || (lang === "ka" ? "მეგობარი" : "A Friend");

    const updatedItems = profile.items.map((item) => {
      if (item.id !== activeReserveItem.id) return item;
      return {
        ...item,
        reservation: {
          reservedByName: displayName,
          isAnonymous: reserveIsAnonymous,
          reservedAt: new Date().toISOString(),
        },
      };
    });

    saveProfile({ ...profile, items: updatedItems });
    setActiveReserveItem(null);
    setReserveName("");
    setReserveIsAnonymous(false);
    triggerConfetti();
    showToast(
      lang === "ka"
        ? "🎁 საჩუქარი წარმატებით დაიჯავშნა!"
        : "🎁 Gift reserved! Other guests will see it is already taken."
    );
  };

  // Cancel Reservation
  const handleUnreserve = (itemId: string) => {
    const updatedItems = profile.items.map((item) =>
      item.id === itemId ? { ...item, reservation: null } : item
    );
    saveProfile({ ...profile, items: updatedItems });
    showToast(lang === "ka" ? "ჯავშანი გაუქმდა" : "Reservation cancelled");
  };

  // Delete Item (Owner)
  const handleDeleteItem = (itemId: string) => {
    const updatedItems = profile.items.filter((i) => i.id !== itemId);
    saveProfile({ ...profile, items: updatedItems });
    showToast(lang === "ka" ? "სურვილი წაიშალა" : "Wish item removed");
  };

  // Open Withdraw Modal for a specific item or general wallet
  const openWithdrawForItem = (itemId?: string) => {
    const itemsWithFunds = profile.items.filter(
      (i) => i.collectedAmount - i.withdrawnAmount > 0
    );
    const defaultId = itemId || itemsWithFunds[0]?.id || profile.items[0]?.id || "";
    setSelectedWithdrawItemId(defaultId);
    setAcknowledgePartialWarning(false);
    setIsWithdrawModalOpen(true);
  };

  const selectedWithdrawItem = profile.items.find((i) => i.id === selectedWithdrawItemId);
  const withdrawableForSelected = selectedWithdrawItem
    ? Math.max(0, selectedWithdrawItem.collectedAmount - selectedWithdrawItem.withdrawnAmount)
    : 0;
  const isGoalMetForSelected = selectedWithdrawItem
    ? selectedWithdrawItem.collectedAmount >= selectedWithdrawItem.price
    : false;

  // Handle IBAN Withdrawal Submit
  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWithdrawItem || withdrawableForSelected <= 0) return;
    if (!isGoalMetForSelected && !acknowledgePartialWarning) return;
    if (!ibanInput.trim() || ibanInput.trim().length < 15) return;

    const newWithdrawal = {
      id: `wd-${Date.now()}`,
      itemId: selectedWithdrawItem.id,
      itemTitle: selectedWithdrawItem.title,
      amount: withdrawableForSelected,
      iban: ibanInput.trim().toUpperCase(),
      recipientName: recipientNameInput.trim(),
      wasGoalMet: isGoalMetForSelected,
      createdAt: new Date().toISOString(),
    };

    const updatedItems = profile.items.map((item) => {
      if (item.id !== selectedWithdrawItem.id) return item;
      return {
        ...item,
        withdrawnAmount: item.collectedAmount,
      };
    });

    saveProfile({
      ...profile,
      savedIban: ibanInput.trim().toUpperCase(),
      items: updatedItems,
      withdrawals: [newWithdrawal, ...profile.withdrawals],
    });

    setAcknowledgePartialWarning(false);
    triggerConfetti();
    showToast(
      lang === "ka"
        ? `💸 ${withdrawableForSelected} ₾ წარმატებით გადაირიცხა ანგარიშზე ${ibanInput.toUpperCase()}!`
        : `💸 ${withdrawableForSelected} ₾ successfully transferred to IBAN ${ibanInput.toUpperCase()}!`
    );
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

      {/* Top Interactive Role & Language Bar */}
      <div className="bg-slate-900 text-white text-xs py-2.5 px-4 border-b border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 hidden sm:inline">{t.switchRoleHint}:</span>
            <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
              <button
                onClick={() => setViewMode("owner")}
                className={`px-3 py-1 rounded-md font-medium transition ${
                  viewMode === "owner"
                    ? "bg-rose-600 text-white shadow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                👑 {t.ownerMode}
              </button>
              <button
                onClick={() => setViewMode("guest")}
                className={`px-3 py-1 rounded-md font-medium transition ${
                  viewMode === "guest"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                🎁 {t.guestMode}
              </button>
            </div>
          </div>

          {/* Language Switcher */}
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-slate-400" />
            <button
              onClick={() => setLang("ka")}
              className={`px-2.5 py-1 rounded font-semibold transition ${
                lang === "ka"
                  ? "bg-white text-slate-900"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🇬🇪 ქართული
            </button>
            <button
              onClick={() => setLang("en")}
              className={`px-2.5 py-1 rounded font-semibold transition ${
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
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/85 border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
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

          <div className="flex items-center gap-2.5">
            {viewMode === "owner" && (
              <>
                <button
                  onClick={() => openWithdrawForItem()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3.5 py-2.5 text-sm font-semibold transition cursor-pointer"
                >
                  <Wallet className="h-4 w-4 text-emerald-600" />
                  <span className="hidden md:inline">{t.walletBtn}</span>
                  <span className="rounded-lg bg-emerald-600 text-white px-2 py-0.5 text-xs font-bold">
                    {totalAvailableToWithdraw} ₾
                  </span>
                </button>

                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 text-sm font-semibold shadow-md shadow-rose-600/20 transition cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t.addGiftBtn}</span>
                </button>
              </>
            )}

            <button
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-2.5 text-sm font-medium transition cursor-pointer"
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

      {/* Hero Profile Banner */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-rose-950 text-white p-6 sm:p-10 shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <img
                src={profile.avatarUrl}
                alt={profile.ownerName}
                className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl object-cover ring-4 ring-white/20 shadow-lg"
              />
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1 text-xs font-medium text-amber-300 mb-2">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {lang === "ka" ? profile.eventTitleKa : profile.eventTitleEn} •{" "}
                    {profile.eventDate}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {profile.ownerName}
                </h1>
                <p className="mt-2 text-sm sm:text-base text-slate-200 max-w-2xl leading-relaxed">
                  {lang === "ka" ? profile.ownerBioKa : profile.ownerBioEn}
                </p>
              </div>
            </div>

            {/* Wallet / Stats Summary Cards */}
            <div className="grid grid-cols-2 gap-3 w-full md:w-auto shrink-0">
              <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-4">
                <p className="text-xs text-slate-300">{t.totalCollected}</p>
                <p className="text-2xl font-black text-amber-300 mt-0.5">
                  {totalRaised} ₾
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-4">
                <p className="text-xs text-slate-300">
                  {viewMode === "owner" ? t.availableBalance : t.reservedGiftsCount}
                </p>
                <p className="text-2xl font-black text-emerald-300 mt-0.5">
                  {viewMode === "owner"
                    ? `${totalAvailableToWithdraw} ₾`
                    : `${reservedCount} / ${profile.items.length}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filter Tabs */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: "all", label: t.allItems, count: profile.items.length },
                {
                  id: "crowdfunding",
                  label: t.crowdfundingFilter,
                  count: profile.items.filter((i) => i.allowCrowdfunding).length,
                },
                {
                  id: "available",
                  label: t.availableFilter,
                  count: profile.items.filter(
                    (i) => i.collectedAmount < i.price && !i.reservation
                  ).length,
                },
                {
                  id: "completed",
                  label: t.completedFilter,
                  count: profile.items.filter(
                    (i) => i.collectedAmount >= i.price || Boolean(i.reservation)
                  ).length,
                },
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

          {viewMode === "guest" && (
            <div className="text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl px-3.5 py-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
              <span>
                {lang === "ka"
                  ? "თქვენ უყურებთ სიას როგორც სტუმარი — შეგიძლიათ დადოთ თანხა (სახელით ან ანონიმურად) ან დაჯავშნოთ საჩუქარი"
                  : "Viewing as Guest — You can chip in any amount (named or anonymous) or reserve a gift"}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Wishlist Grid */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {filteredItems.map((item) => {
            const percent = Math.min(
              100,
              Math.round((item.collectedAmount / item.price) * 100)
            );
            const remaining = Math.max(0, item.price - item.collectedAmount);
            const isGoalReached = item.collectedAmount >= item.price;
            const isReserved = Boolean(item.reservation);
            const availableItemPayout = Math.max(
              0,
              item.collectedAmount - item.withdrawnAmount
            );

            return (
              <div
                key={item.id}
                className="group bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-200 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Image Header */}
                  <div className="relative h-60 w-full bg-slate-100 overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

                    {/* Top Left Badges */}
                    <div className="absolute top-3.5 left-3.5 flex flex-wrap gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md shadow-sm ${
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
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/90 text-slate-800 backdrop-blur-md shadow-sm">
                          🛍️ {item.storeName}
                        </span>
                      )}
                    </div>

                    {/* Top Right Status / Owner Delete */}
                    <div className="absolute top-3.5 right-3.5 flex items-center gap-2">
                      {isGoalReached && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-md">
                          {t.goalReached}
                        </span>
                      )}
                      {isReserved && !isGoalReached && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-md">
                          {t.reservedBadge}
                        </span>
                      )}
                      {viewMode === "owner" && (
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          title={t.deleteItemConfirm}
                          className="h-8 w-8 rounded-full bg-black/50 hover:bg-rose-600 text-white flex items-center justify-center transition cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Bottom Price Tag on Image */}
                    <div className="absolute bottom-3.5 left-4 right-4 flex items-end justify-between text-white">
                      <div>
                        <span className="text-xs uppercase tracking-wider text-slate-200 font-medium">
                          {lang === "ka" ? "ღირებულება" : "Gift Price"}
                        </span>
                        <div className="text-2xl font-black">{item.price} ₾</div>
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

                  {/* Body Content */}
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-slate-900 leading-snug">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-sm text-slate-600 line-clamp-2">
                      {item.description}
                    </p>

                    {/* Crowdfunding Progress Box */}
                    {item.allowCrowdfunding && (
                      <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-200/80 p-4">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <div>
                            <span className="font-extrabold text-slate-900 text-base">
                              {item.collectedAmount} ₾
                            </span>{" "}
                            <span className="text-slate-500 text-xs">
                              {t.collectedOf} {item.price} ₾ ({percent}%)
                            </span>
                          </div>
                          {remaining > 0 ? (
                            <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg">
                              {t.remaining}: {remaining} ₾
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                              100% 🎉
                            </span>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isGoalReached
                                ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                                : "bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500"
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        {/* Contributors Feed */}
                        <div className="mt-3.5 pt-3 border-t border-slate-200/70">
                          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                            <span className="font-semibold flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-slate-400" />
                              {t.contributorsList} ({item.contributions.length})
                            </span>
                            {item.withdrawnAmount > 0 && (
                              <span className="text-emerald-700 font-semibold">
                                ✓ {t.alreadyWithdrawn}: {item.withdrawnAmount} ₾
                              </span>
                            )}
                          </div>

                          {item.contributions.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">
                              {t.noContributorsYet}
                            </p>
                          ) : (
                            <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                              {item.contributions.map((c) => (
                                <div
                                  key={c.id}
                                  className="flex items-start justify-between gap-2 text-xs bg-white rounded-xl px-3 py-2 border border-slate-100"
                                >
                                  <div>
                                    <span className="font-bold text-slate-800 flex items-center gap-1">
                                      {c.isAnonymous ? (
                                        <>
                                          <EyeOff className="h-3 w-3 text-slate-400" />
                                          <span>
                                            {lang === "ka"
                                              ? "ანონიმური დონორი"
                                              : "Anonymous"}
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <Heart className="h-3 w-3 text-rose-500 fill-rose-500" />
                                          <span>{c.contributorName}</span>
                                        </>
                                      )}
                                    </span>
                                    {c.message && (
                                      <p className="text-slate-500 mt-0.5">
                                        “{c.message}”
                                      </p>
                                    )}
                                  </div>
                                  <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md shrink-0">
                                    +{c.amount} ₾
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Reservation Status Banner */}
                    {item.reservation && (
                      <div className="mt-4 rounded-2xl bg-indigo-50 border border-indigo-200 p-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-xs text-indigo-950">
                          <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0" />
                          <div>
                            <span className="font-bold block">{t.reservedBadge}</span>
                            <span className="text-indigo-700">
                              {t.reservedBy}{" "}
                              <strong>
                                {item.reservation.isAnonymous
                                  ? t.anonymousFriend
                                  : item.reservation.reservedByName}
                              </strong>
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnreserve(item.id)}
                          className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
                        >
                          {t.unreserveBtn}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Footer Buttons */}
                <div className="px-6 pb-6 pt-2 flex flex-wrap items-center gap-2.5">
                  {/* Guest Actions (Also usable in Owner mode if they want to test, or clearly shown) */}
                  {item.allowCrowdfunding && !item.reservation && (
                    <button
                      onClick={() => {
                        setActiveContributeItem(item);
                        const rem = Math.max(10, item.price - item.collectedAmount);
                        setContribAmount(String(Math.min(50, rem)));
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-3 text-sm font-bold shadow-md shadow-rose-600/15 transition cursor-pointer"
                    >
                      <Heart className="h-4 w-4 fill-white" />
                      <span>{t.contributeBtn}</span>
                    </button>
                  )}

                  {!item.reservation && item.collectedAmount === 0 && (
                    <button
                      onClick={() => setActiveReserveItem(item)}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 text-sm font-bold transition cursor-pointer"
                    >
                      <Gift className="h-4 w-4" />
                      <span>{t.reserveGiftBtn}</span>
                    </button>
                  )}

                  {/* Owner IBAN Withdraw Button right on the card */}
                  {viewMode === "owner" && item.allowCrowdfunding && (
                    <button
                      onClick={() => openWithdrawForItem(item.id)}
                      disabled={availableItemPayout <= 0}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-2xl px-4 py-3 text-xs font-bold transition cursor-pointer ${
                        availableItemPayout > 0
                          ? isGoalReached
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                            : "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300"
                          : "bg-slate-100 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      <Wallet className="h-4 w-4" />
                      <span>
                        {availableItemPayout > 0
                          ? `${t.withdrawItemBtn} (${availableItemPayout} ₾)`
                          : t.alreadyWithdrawn}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* ========================================================= */}
      {/* MODAL 1: ADD WISH ITEM (URL AUTO-SCRAPER OR MANUAL)       */}
      {/* ========================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <Plus className="h-5 w-5 text-rose-600" />
                <span>{t.addModalTitle}</span>
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mode Switch Tabs */}
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

            {/* URL Scraper Box */}
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
                    placeholder="https://veli.store/... ან https://zoommer.ge/..."
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

                {/* Quick Test Presets for Georgian Stores & Amazon */}
                <div className="mt-3">
                  <p className="text-[11px] font-semibold text-slate-500 mb-1.5">
                    {t.presetStoreLinksTitle}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "Amazon.com (USD -> ₾ TBC)", url: "https://www.amazon.com/dp/B0CHWRXH8B" },
                      { label: "Zoommer.ge (AirPods)", url: "https://zoommer.ge/airpods-pro-2" },
                      { label: "Veli.store (Stanley)", url: "https://veli.store/stanley-quencher" },
                      { label: "Extra.ge (DeLonghi)", url: "https://extra.ge/delonghi-dedica" },
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

            {/* Item Details Form */}
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

              {/* Image URL or File Upload */}
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

              {/* Enable Crowdfunding Toggle */}
              <label className="flex items-start gap-3 rounded-2xl bg-slate-50 border border-slate-200 p-3.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newAllowCrowdfunding}
                  onChange={(e) => setNewAllowCrowdfunding(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="text-sm font-bold text-slate-900 block">
                    {t.allowCrowdfundingLabel}
                  </span>
                  <span className="text-xs text-slate-500">
                    {t.allowCrowdfundingSub}
                  </span>
                </div>
              </label>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
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
      {/* MODAL 2: CHIP IN / CONTRIBUTE (NAMED OR ANONYMOUS)        */}
      {/* ========================================================= */}
      {activeContributeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <Heart className="h-5 w-5 text-rose-600 fill-rose-600" />
                <span>{t.contributeModalTitle}</span>
              </h2>
              <button
                onClick={() => setActiveContributeItem(null)}
                className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mini Item Preview */}
            <div className="mt-4 flex items-center gap-3.5 rounded-2xl bg-slate-50 p-3 border border-slate-200/80">
              <img
                src={activeContributeItem.imageUrl}
                alt={activeContributeItem.title}
                className="h-14 w-14 rounded-xl object-cover shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-slate-900 truncate">
                  {activeContributeItem.title}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.collectedOf}:{" "}
                  <strong className="text-slate-800">
                    {activeContributeItem.collectedAmount} ₾ / {activeContributeItem.price} ₾
                  </strong>
                </p>
              </div>
            </div>

            <form onSubmit={handleContributeSubmit} className="mt-5 space-y-4">
              {/* Amount Presets */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  {t.chooseAmount}
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2.5">
                  {[20, 50, 100, 200].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setContribAmount(String(amt))}
                      className={`py-2 rounded-xl text-sm font-bold border transition cursor-pointer ${
                        Number(contribAmount) === amt
                          ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {amt} ₾
                    </button>
                  ))}
                </div>

                {activeContributeItem.price > activeContributeItem.collectedAmount && (
                  <button
                    type="button"
                    onClick={() =>
                      setContribAmount(
                        String(
                          activeContributeItem.price -
                            activeContributeItem.collectedAmount
                        )
                      )
                    }
                    className="w-full mb-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition cursor-pointer"
                  >
                    ✨ {t.fillRemainingBtn} (
                    {activeContributeItem.price - activeContributeItem.collectedAmount} ₾)
                  </button>
                )}

                <div className="relative">
                  <input
                    type="number"
                    required
                    min={1}
                    value={contribAmount}
                    onChange={(e) => setContribAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">
                    ₾ GEL
                  </span>
                </div>
              </div>

              {/* Identity Selection: Named vs Anonymous */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  {t.identitySectionTitle}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setContribIsAnonymous(false)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      !contribIsAnonymous
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <Eye className="h-4 w-4" />
                    <span>{t.publicIdentityOption}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setContribIsAnonymous(true)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      contribIsAnonymous
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <EyeOff className="h-4 w-4" />
                    <span>{t.anonymousIdentityOption}</span>
                  </button>
                </div>

                {contribIsAnonymous ? (
                  <p className="mt-2 text-xs text-slate-500 bg-slate-100 rounded-xl px-3 py-2 flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span>{t.anonymousHint}</span>
                  </p>
                ) : (
                  <div className="mt-3">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.yourNameLabel} *
                    </label>
                    <input
                      type="text"
                      required={!contribIsAnonymous}
                      value={contribName}
                      onChange={(e) => setContribName(e.target.value)}
                      placeholder={t.yourNamePlaceholder}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                )}
              </div>

              {/* Greeting Message */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.greetingLabel}
                </label>
                <textarea
                  rows={2}
                  value={contribMessage}
                  onChange={(e) => setContribMessage(e.target.value)}
                  placeholder={t.greetingPlaceholder}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Georgian Payment Gateway Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.paymentMethodLabel}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "tbc", label: "TBC Pay / Card" },
                    { id: "bog", label: "BOG iPay / sCool" },
                    { id: "apple", label: "Apple / Google Pay" },
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id as "tbc" | "bog" | "apple")}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        paymentMethod === pm.id
                          ? "bg-indigo-50 border-indigo-600 text-indigo-900"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-rose-600 hover:bg-rose-700 text-white py-3.5 text-sm font-extrabold shadow-lg shadow-rose-600/25 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <CreditCard className="h-4 w-4" />
                <span>
                  {t.payBtnPrefix} {contribAmount || 0} ₾
                </span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: RESERVE GIFT MODAL                               */}
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

            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              {t.reserveModalDesc}
            </p>

            <form onSubmit={handleReserveSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReserveIsAnonymous(false)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    !reserveIsAnonymous
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  {t.publicIdentityOption}
                </button>
                <button
                  type="button"
                  onClick={() => setReserveIsAnonymous(true)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    reserveIsAnonymous
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  {t.anonymousIdentityOption}
                </button>
              </div>

              {!reserveIsAnonymous && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.yourNameLabel} *
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
              )}

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

      {/* ========================================================= */}
      {/* MODAL 4: VIRTUAL WALLET & IBAN WITHDRAWAL WITH WARNING    */}
      {/* ========================================================= */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {t.withdrawModalTitle}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {t.availableBalance}:{" "}
                    <strong className="text-emerald-700">
                      {totalAvailableToWithdraw} ₾
                    </strong>{" "}
                    • {t.withdrawnTotal}: {totalWithdrawn} ₾
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Select Gift Fund to Withdraw */}
            <form onSubmit={handleWithdrawSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.selectItemToWithdraw}
                </label>
                <select
                  value={selectedWithdrawItemId}
                  onChange={(e) => {
                    setSelectedWithdrawItemId(e.target.value);
                    setAcknowledgePartialWarning(false);
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {profile.items
                    .filter((i) => i.allowCrowdfunding)
                    .map((item) => {
                      const avail = Math.max(
                        0,
                        item.collectedAmount - item.withdrawnAmount
                      );
                      const met = item.collectedAmount >= item.price;
                      return (
                        <option key={item.id} value={item.id}>
                          {item.title} — {avail} ₾{" "}
                          {met
                            ? lang === "ka"
                              ? "(100% შეგროვდა ✅)"
                              : "(100% Goal Met ✅)"
                            : lang === "ka"
                            ? `(${item.collectedAmount}/${item.price} ₾ - არასრული ⚠️)`
                            : `(${item.collectedAmount}/${item.price} ₾ - Goal Not Met ⚠️)`}
                        </option>
                      );
                    })}
                </select>
              </div>

              {/* THINK TWICE WARNING IF GOAL IS NOT MET YET */}
              {selectedWithdrawItem && !isGoalMetForSelected && (
                <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 text-amber-950">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs leading-relaxed">
                      <h4 className="font-extrabold text-sm text-amber-950 mb-1">
                        {t.warningNotMetTitle}
                      </h4>
                      <p>
                        {t.warningNotMetBody
                          .replace("{price}", String(selectedWithdrawItem.price))
                          .replace(
                            "{collected}",
                            String(selectedWithdrawItem.collectedAmount)
                          )
                          .replace(
                            "{percent}",
                            String(
                              Math.round(
                                (selectedWithdrawItem.collectedAmount /
                                  selectedWithdrawItem.price) *
                                  100
                              )
                            )
                          )}
                      </p>

                      {withdrawableForSelected > 0 && (
                        <label className="mt-3 flex items-start gap-2.5 bg-white/80 rounded-xl p-2.5 border border-amber-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={acknowledgePartialWarning}
                            onChange={(e) =>
                              setAcknowledgePartialWarning(e.target.checked)
                            }
                            className="mt-0.5 h-4 w-4 rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span className="font-bold text-amber-950">
                            {t.warningAcknowledgeLabel}
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Goal Met Confirmation Banner */}
              {selectedWithdrawItem && isGoalMetForSelected && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs font-bold text-emerald-900 flex items-center gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span>{t.goalMetReadyText}</span>
                </div>
              )}

              {/* Georgian IBAN & Recipient Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.ibanLabel} *
                  </label>
                  <input
                    type="text"
                    required
                    value={ibanInput}
                    onChange={(e) => setIbanInput(e.target.value)}
                    placeholder={t.ibanPlaceholder}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.recipientNameLabel} *
                  </label>
                  <input
                    type="text"
                    required
                    value={recipientNameInput}
                    onChange={(e) => setRecipientNameInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900 text-white p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">
                    {t.withdrawAvailableText}
                  </span>
                  <span className="text-2xl font-black text-emerald-400">
                    {withdrawableForSelected} ₾
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={
                    withdrawableForSelected <= 0 ||
                    (!isGoalMetForSelected && !acknowledgePartialWarning)
                  }
                  className={`rounded-xl px-5 py-3 text-sm font-extrabold flex items-center gap-2 transition ${
                    withdrawableForSelected > 0 &&
                    (isGoalMetForSelected || acknowledgePartialWarning)
                      ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer shadow-lg"
                      : "bg-slate-700 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <span>{t.confirmWithdrawBtn}</span>
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </form>

            {/* Payout History */}
            <div className="mt-6 pt-5 border-t border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                {t.withdrawalHistoryTitle}
              </h4>
              {profile.withdrawals.length === 0 ? (
                <p className="text-xs text-slate-400 italic">{t.noWithdrawalsYet}</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {profile.withdrawals.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200/80 rounded-xl p-3"
                    >
                      <div>
                        <span className="font-bold text-slate-800 block">
                          {w.itemTitle}
                        </span>
                        <span className="text-slate-500 font-mono">
                          IBAN: {w.iban} • {w.recipientName}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-emerald-700 text-sm block">
                          {w.amount} ₾
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {w.wasGoalMet ? "100% Goal" : "Partial Payout"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
