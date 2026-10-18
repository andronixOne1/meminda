export type Language = "ka" | "en";

export interface Contribution {
  id: string;
  contributorName: string;
  isAnonymous: boolean;
  amount: number;
  message?: string;
  createdAt: string;
}

export interface Reservation {
  reservedByName: string;
  isAnonymous: boolean;
  reservedAt: string;
}

export interface WithdrawalRecord {
  id: string;
  itemId: string;
  itemTitle: string;
  amount: number;
  iban: string;
  recipientName: string;
  wasGoalMet: boolean;
  createdAt: string;
}

export interface WishItem {
  id: string;
  title: string;
  description: string;
  price: number; // in GEL (₾)
  imageUrl: string;
  productUrl?: string;
  storeName?: string;
  priority: "high" | "medium" | "low";
  allowCrowdfunding: boolean;
  collectedAmount: number;
  withdrawnAmount: number;
  contributions: Contribution[];
  reservation?: Reservation | null;
  createdAt: string;
}

export interface WishlistProfile {
  id: string;
  slug: string;
  ownerName: string;
  ownerBioKa: string;
  ownerBioEn: string;
  avatarUrl: string;
  eventTitleKa: string;
  eventTitleEn: string;
  eventDate: string;
  savedIban: string;
  items: WishItem[];
  withdrawals: WithdrawalRecord[];
}

export const INITIAL_WISHLIST_PROFILE: WishlistProfile = {
  id: "profile-nini-1",
  slug: "nini-shengelia",
  ownerName: "ნინი შენგელია (Nini Shengelia)",
  ownerBioKa: "ჩემი დაბადების დღის და ახალმოსახლეობის სურვილების სია! 🎂🏡 შეგიძლიათ დაჯავშნოთ საჩუქარი ან დადოთ ნებისმიერი თანხა საერთო ყულაბაში.",
  ownerBioEn: "My Birthday & Housewarming Wishlist! 🎂🏡 Feel free to reserve a gift or chip in any amount toward the group fund.",
  avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
  eventTitleKa: "ნინის 25 წლის იუბილე & ახალმოსახლეობა",
  eventTitleEn: "Nini's 25th Birthday & Housewarming",
  eventDate: "2026-11-15",
  savedIban: "GE29TB7777736080100005",
  withdrawals: [],
  items: [
    {
      id: "item-1",
      title: "Sony WH-1000XM5 უსადენო ყურსასმენი (Silver)",
      description: "საუკეთესო ხმაურის ჩამხშობი ყურსასმენი მუშაობისა და მოგზაურობისთვის. იყიდება Zoommer-ში.",
      price: 949,
      imageUrl: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=900&q=80",
      productUrl: "https://zoommer.ge",
      storeName: "Zoommer.ge",
      priority: "high",
      allowCrowdfunding: true,
      collectedAmount: 620,
      withdrawnAmount: 0,
      reservation: null,
      createdAt: "2026-10-10T12:00:00Z",
      contributions: [
        {
          id: "c-1",
          contributorName: "გიორგი კვარაცხელია",
          isAnonymous: false,
          amount: 250,
          message: "გილოცავ წინასწარ ნინი! საუკეთესო სურვილებით 🎉",
          createdAt: "2026-10-14T15:30:00Z",
        },
        {
          id: "c-2",
          contributorName: "საიდუმლო მეგობარი",
          isAnonymous: true,
          amount: 170,
          message: "იმედია მალე შეგროვდება სრული თანხა! 💜",
          createdAt: "2026-10-15T18:10:00Z",
        },
        {
          id: "c-3",
          contributorName: "ანა და ლუკა",
          isAnonymous: false,
          amount: 200,
          message: "ჩვენგან ყულაბაში! 🎧",
          createdAt: "2026-10-16T11:45:00Z",
        },
      ],
    },
    {
      id: "item-2",
      title: "DeLonghi Dedica ესპრესოს აპარატი",
      description: "ახალი სახლის სამზარეულოსთვის! ვერცხლისფერი მოდელი 15 ბარი წნევით.",
      price: 680,
      imageUrl: "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=900&q=80",
      productUrl: "https://extra.ge",
      storeName: "Extra.ge",
      priority: "high",
      allowCrowdfunding: true,
      collectedAmount: 680,
      withdrawnAmount: 0,
      reservation: null,
      createdAt: "2026-10-11T10:00:00Z",
      contributions: [
        {
          id: "c-4",
          contributorName: "თამუნა, სალომე და მარიამი",
          isAnonymous: false,
          amount: 480,
          message: "ყველაზე გემრიელი დილის ყავისთვის ახალ სახლში! ☕",
          createdAt: "2026-10-16T14:20:00Z",
        },
        {
          id: "c-5",
          contributorName: "ანონიმური",
          isAnonymous: true,
          amount: 200,
          message: "გილოცავ ახალმოსახლეობას!",
          createdAt: "2026-10-17T09:15:00Z",
        },
      ],
    },
    {
      id: "item-3",
      title: "Stanley Quencher H2.0 თერმო ჭიქა (Rose Quartz)",
      description: "1.18 ლიტრიანი ვარდისფერი მოდელი Veli.store-დან.",
      price: 159,
      imageUrl: "https://images.unsplash.com/photo-1570831739435-6601aa3fa4fb?auto=format&fit=crop&w=900&q=80",
      productUrl: "https://veli.store",
      storeName: "Veli.store",
      priority: "medium",
      allowCrowdfunding: false,
      collectedAmount: 0,
      withdrawnAmount: 0,
      reservation: {
        reservedByName: "დათო ბერიძე",
        isAnonymous: false,
        reservedAt: "2026-10-16T20:00:00Z",
      },
      createdAt: "2026-10-12T10:00:00Z",
      contributions: [],
    },
    {
      id: "item-4",
      title: "ხელნაკეთი ქართული კერამიკის ლარნაკი",
      description: "ინსტაგრამ ბუტიკ @ceramics.tbilisi-ს ლურჯი თიხის ლარნაკი მისაღები ოთახისთვის.",
      price: 120,
      imageUrl: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=900&q=80",
      productUrl: "https://instagram.com",
      storeName: "Instagram Boutique",
      priority: "medium",
      allowCrowdfunding: true,
      collectedAmount: 45,
      withdrawnAmount: 0,
      reservation: null,
      createdAt: "2026-10-13T10:00:00Z",
      contributions: [
        {
          id: "c-6",
          contributorName: "ელენე",
          isAnonymous: false,
          amount: 45,
          message: "პატარა წვლილი ჩემგან 🌸",
          createdAt: "2026-10-17T12:00:00Z",
        },
      ],
    },
  ],
};

export const TRANSLATIONS = {
  ka: {
    brandSub: "სურვილებისა და საჩუქრების პლატფორმა",
    ownerMode: "მფლობელის რეჟიმი",
    guestMode: "სტუმრის რეჟიმი (მეგობრის ხედი)",
    switchRoleHint: "გადართეთ რეჟიმი, რომ ნახოთ როგორ ხედავენ საიტს თქვენი მეგობრები",
    heroBadge: "✨ #1 ქართული სურვილების პლატფორმა",
    addGiftBtn: "სურვილის დამატება",
    walletBtn: "საფულე & გატანა",
    shareBtn: "სიის გაზიარება",
    copiedLink: "ბმული დაკოპირდა!",
    totalCollected: "სულ შეგროვებული",
    availableBalance: "ხელმისაწვდომი ბალანსი",
    withdrawnTotal: "გატანილი თანხა",
    reservedGiftsCount: "დაჯავშნილი საჩუქრები",
    allItems: "ყველა სურვილი",
    crowdfundingFilter: "საერთო ყულაბა (Crowdfunding)",
    availableFilter: "თავისუფალი",
    completedFilter: "შესრულებული / დაჯავშნილი",
    priorityHigh: "ძალიან მინდა 🔥",
    priorityMedium: "სასურველი ✨",
    priorityLow: "იდეა 💡",
    goalReached: "მიზანი მიღწეულია! 🎉",
    reservedBadge: "დაჯავშნილია 🎁",
    reservedBy: "დაჯავშნა:",
    anonymousFriend: "ანონიმურმა მეგობარმა",
    collectedOf: "შეგროვდა",
    remaining: "დარჩა",
    contributeBtn: "თანხის დადება ₾",
    reserveGiftBtn: "საჩუქრის დაჯავშნა",
    unreserveBtn: "ჯავშნის გაუქმება",
    withdrawItemBtn: "თანხის გატანა IBAN-ზე",
    alreadyWithdrawn: "გატანილია",
    viewProductLink: "მაღაზიაში ნახვა",
    contributorsList: "მონაწილეები",
    noContributorsYet: "ჯერ არავის დაუდია თანხა — იყავი პირველი!",
    // Add Item Modal
    addModalTitle: "ახალი სურვილის დამატება",
    tabByLink: "ბმულით დამატება (Auto-Fetch)",
    tabManual: "ხელით ატვირთვა",
    pasteUrlLabel: "ჩასვით პროდუქტის ბმული (Zoommer, Veli, Extra, Instagram ან ნებისმიერი საიტი)",
    fetchBtn: "წამოღება",
    fetchingText: "მიმდინარეობს მონაცემების წამოღება...",
    itemNameLabel: "ნივთის დასახელება *",
    itemNamePlaceholder: "მაგ: Dyson Airwrap ან ყავის აპარატი",
    itemPriceLabel: "ფასი (₾ - ლარი) *",
    itemStoreLabel: "მაღაზიის სახელი (არასავალდებულო)",
    itemStorePlaceholder: "მაგ: Veli.store, Zoommer, Instagram...",
    itemImageLabel: "სურათის ბმული ან ატვირთვა",
    uploadPhotoBtn: "ფოტოს არჩევა კომპიუტერიდან",
    itemDescLabel: "აღწერა / ზომა / ფერი / კომენტარი",
    itemDescPlaceholder: "მიუთითეთ სასურველი ფერი, ზომა ან დეტალები მეგობრებისთვის...",
    priorityLabel: "პრიორიტეტი",
    allowCrowdfundingLabel: "ჩავრთოთ საერთო ყულაბა (Crowdfunding)?",
    allowCrowdfundingSub: "მეგობრებს შეეძლებათ ნებისმიერი თანხის (მაგ. 20₾, 50₾) დადება ამ საჩუქრისთვის",
    saveWishBtn: "სურვილის სიაში დამატება",
    cancelBtn: "გაუქმება",
    // Contribute Modal
    contributeModalTitle: "საერთო საჩუქარში თანხის დადება",
    chooseAmount: "აირჩიეთ ან ჩაწერეთ თანხა (₾)",
    fillRemainingBtn: "დარჩენილი თანხის სრულად შევსება",
    identitySectionTitle: "თქვენი ვინაობა",
    publicIdentityOption: "სახელის გამოჩენა",
    anonymousIdentityOption: "ანონიმური დონაცია 🕵️",
    anonymousHint: "თქვენი სახელი არავისთან გამოჩნდება (მათ შორის არც სიის მფლობელთან)",
    yourNameLabel: "თქვენი სახელი",
    yourNamePlaceholder: "მაგ: გიორგი და ნინო",
    greetingLabel: "მისალოცი წერილი (არასავალდებულო)",
    greetingPlaceholder: "დაუწერეთ კეთილი სურვილები...",
    paymentMethodLabel: "გადახდის მეთოდი (სიმულაცია)",
    payBtnPrefix: "ჩარიცხვა",
    // Reserve Modal
    reserveModalTitle: "საჩუქრის დაჯავშნა",
    reserveModalDesc: "დაჯავშნის შემდეგ სხვა სტუმრები დაინახავენ, რომ ამ ნივთს უკვე ყიდულობენ, რათა თავიდან აიცილოთ ორმაგი საჩუქარი.",
    confirmReserveBtn: "დაჯავშნის დადასტურება 🎁",
    // Withdraw / IBAN Modal
    withdrawModalTitle: "თანხის გატანა საბანკო ანგარიშზე (IBAN)",
    selectItemToWithdraw: "აირჩიეთ რომელ საჩუქარზე შეგროვებული თანხა გაგაქვთ:",
    warningNotMetTitle: "⚠️ ყურადღება: საჩუქრის სრული თანხა ჯერ არ შეგროვებულა!",
    warningNotMetBody: "ამ ნივთის მიზანია {price} ₾, ხოლო ამჟამად შეგროვებულია {collected} ₾ ({percent}%). დაფიქრდით, ნამდვილად გსურთ თანხის ახლავე გატანა? შესაძლოა მეგობრები კიდევ აპირებენ თანხის დამატებას!",
    warningAcknowledgeLabel: "დიახ, გავითვალისწინე და მაინც მსურს არასრული თანხის ახლავე გატანა",
    goalMetReadyText: "✅ გილოცავთ! ამ საჩუქრის სრული თანხა შეგროვებულია და მზადაა გასატანად.",
    ibanLabel: "ქართული საბანკო ანგარიშის ნომერი (IBAN)",
    ibanPlaceholder: "GE00TB0000000000000000 ან GE00BG0000000000000000",
    recipientNameLabel: "მიმღების სახელი და გვარი",
    withdrawAvailableText: "გასატანი თანხა:",
    confirmWithdrawBtn: "თანხის გადარიცხვა IBAN-ზე",
    withdrawalHistoryTitle: "გატანების ისტორია",
    noWithdrawalsYet: "ჯერ თანხის გატანა არ განხორციელებულა.",
    deleteItemConfirm: "წაშალოთ სურვილი?",
    presetStoreLinksTitle: "სწრაფი ტესტირებისთვის სცადეთ ქართული მაღაზიის ბმულები:",
  },
  en: {
    brandSub: "Georgian Wishlist & Crowdfunding Platform",
    ownerMode: "Owner View (Manage & Withdraw)",
    guestMode: "Guest View (Friend's Perspective)",
    switchRoleHint: "Switch modes anytime to test both the Wishlist Owner and Gift Giver experiences",
    heroBadge: "✨ #1 Wishlist & Group Gifting in Georgia",
    addGiftBtn: "Add Wish Item",
    walletBtn: "Wallet & IBAN Payout",
    shareBtn: "Share Wishlist",
    copiedLink: "Link Copied!",
    totalCollected: "Total Raised",
    availableBalance: "Available to Withdraw",
    withdrawnTotal: "Total Withdrawn",
    reservedGiftsCount: "Reserved Gifts",
    allItems: "All Wishes",
    crowdfundingFilter: "Group Chip-In",
    availableFilter: "Available",
    completedFilter: "Funded / Reserved",
    priorityHigh: "Must Have 🔥",
    priorityMedium: "Would Love ✨",
    priorityLow: "Nice Idea 💡",
    goalReached: "Goal Reached! 🎉",
    reservedBadge: "Reserved 🎁",
    reservedBy: "Reserved by:",
    anonymousFriend: "An Anonymous Friend",
    collectedOf: "raised of",
    remaining: "left",
    contributeBtn: "Chip In ₾",
    reserveGiftBtn: "Reserve Gift",
    unreserveBtn: "Cancel Reservation",
    withdrawItemBtn: "Withdraw to IBAN",
    alreadyWithdrawn: "Withdrawn",
    viewProductLink: "View in Store",
    contributorsList: "Contributors",
    noContributorsYet: "No contributions yet — be the first to chip in!",
    // Add Item Modal
    addModalTitle: "Add a New Wish Item",
    tabByLink: "Paste Product URL (Auto-Fetch)",
    tabManual: "Manual Upload",
    pasteUrlLabel: "Paste a link from Zoommer, Veli, Extra, Instagram, or any online store",
    fetchBtn: "Auto-Fill",
    fetchingText: "Fetching product details...",
    itemNameLabel: "Product Name *",
    itemNamePlaceholder: "e.g., Dyson Airwrap or Espresso Machine",
    itemPriceLabel: "Price (GEL ₾) *",
    itemStoreLabel: "Store Name (Optional)",
    itemStorePlaceholder: "e.g., Veli.store, Zoommer, Instagram...",
    itemImageLabel: "Image URL or Upload Photo",
    uploadPhotoBtn: "Upload Image from Device",
    itemDescLabel: "Description / Size / Color / Notes",
    itemDescPlaceholder: "Add size, color preferences, or helpful details for friends...",
    priorityLabel: "Priority Level",
    allowCrowdfundingLabel: "Enable Group Cash-In (Crowdfunding)?",
    allowCrowdfundingSub: "Allow multiple friends to chip in any GEL amount toward this gift instead of one person buying it all",
    saveWishBtn: "Add to Wishlist",
    cancelBtn: "Cancel",
    // Contribute Modal
    contributeModalTitle: "Chip In Toward This Gift",
    chooseAmount: "Select or enter contribution amount (₾)",
    fillRemainingBtn: "Fund the exact remaining amount",
    identitySectionTitle: "Your Identity",
    publicIdentityOption: "Show My Name",
    anonymousIdentityOption: "Anonymous Donation 🕵️",
    anonymousHint: "Your name will be hidden from everyone, including the wishlist owner",
    yourNameLabel: "Your Name",
    yourNamePlaceholder: "e.g., Giorgi & Nino",
    greetingLabel: "Gift Note / Message (Optional)",
    greetingPlaceholder: "Write a warm note for the wishlist owner...",
    paymentMethodLabel: "Payment Method (Instant Demo)",
    payBtnPrefix: "Contribute",
    // Reserve Modal
    reserveModalTitle: "Reserve This Gift",
    reserveModalDesc: "Reserving marks this item as taken so other friends won't buy the same gift twice.",
    confirmReserveBtn: "Confirm Gift Reservation 🎁",
    // Withdraw / IBAN Modal
    withdrawModalTitle: "Withdraw Funds to Georgian IBAN",
    selectItemToWithdraw: "Select which gift fund you want to withdraw from:",
    warningNotMetTitle: "⚠️ Hold On! Think Twice — The Final Goal Isn't Met Yet!",
    warningNotMetBody: "This gift's goal is {price} ₾, and it currently has {collected} ₾ ({percent}%). Are you sure you want to withdraw the money right now? Your friends might still be planning to chip in the rest!",
    warningAcknowledgeLabel: "I have thought twice and still want to withdraw the partial amount now",
    goalMetReadyText: "✅ Congratulations! This gift has reached 100% of its goal and is ready for payout.",
    ibanLabel: "Georgian Bank IBAN (TBC / BOG / Other)",
    ibanPlaceholder: "GE00TB0000000000000000 or GE00BG0000000000000000",
    recipientNameLabel: "Account Holder Full Name",
    withdrawAvailableText: "Available Payout:",
    confirmWithdrawBtn: "Transfer Funds to IBAN",
    withdrawalHistoryTitle: "IBAN Payout History",
    noWithdrawalsYet: "No withdrawals made yet.",
    deleteItemConfirm: "Remove item",
    presetStoreLinksTitle: "Quick-test with popular Georgian store links:",
  },
};
