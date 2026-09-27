// Lug'at TIPLARI va umumiy yordamchilar.
//
// Matnlarning o'zi til bo'yicha alohida fayllarda: messages.uz.ts / .ru.ts / .en.ts.
// Sabab: uchala til bitta modulda bo'lganda brauzer har bir tashrifchiga
// UCHALA tilni yuklab olardi (~88 KB / 26 KB gzip). Endi faqat kerakligi keladi.
/** Yordam markazi kategoriyalari — faqat savoli bor kategoriya sahifada chiqadi. */
export type SupportCategoryKey = "account" | "resume" | "applications" | "companies" | "payments" | "security" | "technical" | "other";
/** Aloqa formasi mavzulari — backend `CONTACT_SUBJECTS` bilan bir xil. */
export type ContactSubjectKey = "general" | "technical" | "partnership" | "vacancy" | "suggestion" | "other";

export interface BaseMessages {
  // Har sahifa uchun SEO (unikal title/description)
  meta: {
    home: { title: string; description: string };
    searchAll: { title: string; description: string };
    searchQuery: (q: string) => { title: string; description: string };
    companies: { title: string; description: string };
    employer: { title: string; description: string };
    articles: { title: string; description: string };
    login: { title: string; description: string };
    signup: { title: string; description: string };
    support: { title: string; description: string };
    contact: { title: string; description: string };
    pricing: { title: string; description: string };
    profile: { title: string; description: string };
    employerVacancies: { title: string; description: string };
    employerApplications: { title: string; description: string };
    employerCandidates: { title: string; description: string };
    messages: { title: string; description: string };
    notFound: { title: string; description: string };
  };

  nav: {
    vacancies: string;
    companies: string;
    articles: string;
    forEmployers: string;
    login: string;
    signup: string;
    logout: string;
    profile: string;
    menu: string;
    myVacancies: string;
    applications: string;
    candidates: string;
    messages: string;
    companyProfile: string;
  };

  candidatesPage: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    searchButton: string;
    empty: string;
    emptyHint: string;
    selectHint: string;
    message: string;
    resultsCount: (n: number) => string;
    /** Bitta so'rov chegarasiga yetildi — qidiruvni aniqlashtirish taklifi. */
    refineHint: string;
    /** Aloqa ma'lumoti faqat ariza yuborgan nomzodda ko'rinadi. */
    contactHidden: string;
    chatUnavailable: string;
    /** Keyingi sahifa (API `hasMore`). */
    loadMore: string;
    loadMoreError: string;
    /** Kompaniya profili yo'q (API 400 COMPANY_REQUIRED) — tarmoq xatosi emas. */
    needCompanyTitle: string;
    needCompanyText: string;
    needCompanyAction: string;
  };

  ui: {
    theme: { toLight: string; toDark: string };
    language: string;
    loading: string;
    openMenu: string;
    closeMenu: string;
    /** Klaviatura foydalanuvchisi uchun asosiy kontentga o'tish havolasi (audit R3, a11y). */
    skipToContent: string;
  };

  home: {
    heroBadge: string;
    topCompanies: string;
    heroTitle1: string;
    heroTitle2: string;
    heroSubtitle: string;
    searchPlaceholder: string;
    searchButton: string;
    statVacancies: string;
    statCompanies: string;
    statApplicationsToday: string;
    /** Blok ma'lumoti yuklanmaganda (bo'sh ro'yxat o'rniga). */
    loadError: string;
    careerPath: { student: string; intern: string; specialist: string; lead: string };
    categoriesTitle: string;
    viewAll: string;
    latestTitle: string;
    employerCtaTitle: string;
    employerCtaDesc: string;
    employerCtaButton: string;
  };

  search: {
    breadcrumbHome: string;
    breadcrumbVacancies: string;
    titleAll: string;
    titleQuery: (q: string) => string;
    found: (n: number) => string;
    clear: string;
    salaryChip: (v: string) => string;
    emptyTitle: string;
    emptyDesc: string;
    emptyCta: string;
  };

  filters: {
    experience: string;
    jobType: string;
    salary: string;
    from: string;
    to: string;
    apply: string;
    experienceOptions: { none: string; oneToThree: string; threeToSix: string; sixPlus: string };
    scheduleOptions: { full: string; part: string; remote: string; shift: string };
  };

  /**
   * audit R3, D-065 (monetization-4): `premium` — ommaviy neytral yorliq
   * ("Tavsiya etiladi" / "Рекомендуем" / "Featured"); API parametri `premium` bo‘lib qoladi.
   */
  vacancyCard: { premium: string; urgent: string };

  vacancy: {
    posted: string;
    contactsTitle: string;
    descriptionTitle: string;
    requirementsTitle: string;
    conditionsTitle: string;
    apply: string;
    applying: string;
    applyNote: string;
    viewAllVacancies: string;
    reviewLabel: (rating: string, count: number) => string;
    loginToApply: string;
    applied: string;
    applyError: string;
    employerCannotApply: string;
  };

  company: {
    verified: string;
    reviews: (n: number) => string;
    metaIndustry: string;
    metaRegion: string;
    metaEmployees: string;
    metaFounded: string;
    activeVacancies: (n: number) => string;
    noVacancies: string;
  };

  companies: {
    breadcrumb: string;
    title: string;
    subtitle: (n: number) => string;
    searchPlaceholder: string;
    empty: string;
  };

  telegram: {
    title: string;
    subtitle: string;
    linked: string;
    notLinked: string;
    phoneVerified: string;
    phoneNotVerified: string;
    connect: string;
    connecting: string;
    hint: string;
    refresh: string;
    gateTitle: string;
    gateMessage: string;
    gateAction: string;
    /** Rule K (audit R3, D-051): bot ishlamayotganda ko'rsatiladigan yagona matn. */
    unavailable: string;
    /** Tasdiqlagandan so'ng amal boshlangan sahifaga qaytish (audit R3, candidate-flows-14). */
    returnBack: string;
    /** Telefon xavfsizligi bloki — profil Telegram bo'limida (audit R3, D-047, D-048). */
    security: {
      title: string;
      subtitle: string;
      primaryLabel: string;
      primaryNone: string;
      changePhone: string;
      changeHint: string;
      backupLabel: string;
      backupNone: string;
      backupHint: string;
      addBackup: string;
      removeBackup: string;
      unlink: string;
      unlinkHint: string;
      needPrimary: string;
      usePhoneChange: string;
      passwordTitle: string;
      passwordLabel: string;
      passwordPlaceholder: string;
      wrongPassword: string;
      confirm: string;
      cancel: string;
      openTelegram: string;
      linkHint: string;
      removed: string;
      unlinked: string;
    };
  };

  reviews: {
    title: string;
    count: (n: number) => string;
    noReviews: string;
    writeReview: string;
    editReview: string;
    yourRating: string;
    commentPlaceholder: string;
    submit: string;
    submitting: string;
    saved: string;
    loginToReview: string;
    delete: string;
    deleteConfirm: string;
    ratingRequired: string;
    pendingModeration: string;
  };

  employerLanding: {
    heroTitle1: string;
    heroHighlight: string;
    heroTitle2: string;
    heroSubtitle: string;
    heroCta: string;
    statCompanies: string;
    statResumes: string;
    statVacancies: string;
    benefits: { title: string; desc: string }[];
    bottomTitle: string;
    bottomDesc: string;
    bottomCta: string;
  };

  articles: {
    breadcrumb: string;
    title: string;
    subtitle: string;
    count: (n: number) => string;
    searchLabel: string;
    searchPlaceholder: string;
    clearSearch: string;
    categoriesLabel: string;
    all: string;
    categories: { career: string; resume: string; interview: string; salary: string; job_search: string; tips: string };
    sortLabel: string;
    sort: { newest: string; oldest: string; popular: string };
    results: (n: number) => string;
    featured: string;
    readMore: string;
    readMinutes: (n: number) => string;
    pagination: { label: string; prev: string; next: string; page: (n: number) => string };
    loading: string;
    empty: { title: string; text: string };
    noResults: { title: string; text: string; reset: string };
    error: { title: string; text: string; retry: string };
    detail: {
      published: string;
      updated: (date: string) => string;
      by: string;
      share: string;
      shareLabel: (title: string) => string;
      copied: string;
      copyFailed: string;
      toc: string;
      related: string;
      tags: string;
      tagSearch: (tag: string) => string;
      tip: string;
      newTab: string;
      helpful: { title: string; yes: string; no: string; thanks: string; failed: string };
      cta: { title: string; text: string; action: string };
      loading: string;
      error: { title: string; text: string; retry: string; back: string };
      notFound: { title: string; text: string; back: string };
    };
  };

  authPanel: {
    headingLead: string;
    headingAccent: string;
    headingTail: string;
    subtitle: string;
    features: [string, string, string];
    statVacancies: string;
    statCompanies: string;
    statUsers: string;
  };
  login: {
    title: string;
    titleAccent: string;
    subtitle: string;
    backHome: string;
    tabLogin: string;
    tabSignup: string;
    identifier: string;
    identifierPlaceholder: string;
    passwordPlaceholder: string;
    forgot: string;
    showPassword: string;
    hidePassword: string;
    withGoogle: string;
    withApple: string;
    socialSoon: string;
    email: string;
    password: string;
    submit: string;
    submitting: string;
    noAccount: string;
    signupLink: string;
    connError: string;
    orDivider: string;
    /** Forma xatosi ekran o'quvchiga e'lon qilinadi (audit R3, a11y-ui-3). */
    errorLabel: string;
  };

  /**
   * Parolni tiklash — `/login` sahifasining query rejimlari (audit R3, D-045, D-049, D-063).
   * Yangi sahifa yaratilmaydi: `?recover=1`, `?recover=manual`, `?recover=status`, `?reset=<token>`.
   */
  recovery: {
    back: string;
    title: string;
    subtitle: string;
    /* 1 — telefon raqami orqali */
    phoneTitle: string;
    phoneHint: string;
    phoneLabel: string;
    phonePlaceholder: string;
    phoneInvalid: string;
    submit: string;
    submitting: string;
    linkTitle: string;
    linkHint: string;
    openTelegram: string;
    expiresIn: (minutes: number) => string;
    restart: string;
    /* umumiy holatlar */
    unavailable: string;
    tooMany: string;
    genericError: string;
    /* 2 — qo'lda tiklash so'rovi */
    manualLink: string;
    manualTitle: string;
    manualHint: string;
    manualEmail: string;
    manualFullName: string;
    manualFullNamePlaceholder: string;
    manualDetails: string;
    manualDetailsHint: string;
    manualContact: string;
    manualContactHint: string;
    manualSubmit: string;
    manualSubmitting: string;
    manualDoneTitle: string;
    manualDoneHint: string;
    codeLabel: string;
    copy: string;
    copied: string;
    copyFailed: string;
    toStatus: string;
    /* 3 — so'rov holati */
    statusTitle: string;
    statusHint: string;
    statusCodeLabel: string;
    statusCodePlaceholder: string;
    statusCheck: string;
    statusChecking: string;
    statusValue: {
      pending: string;
      approved: string;
      rejected: string;
      completed: string;
      expired: string;
      not_found: string;
    };
    continueTelegram: string;
    notApproved: string;
    /* 4 — yangi parol */
    resetTitle: string;
    resetHint: string;
    checking: string;
    /** Havolani tekshirib bo'lmadi (tarmoq yoki server xatosi) — «yaroqsiz» degani emas. */
    checkError: string;
    newPassword: string;
    newPasswordPlaceholder: string;
    confirmPassword: string;
    confirmPlaceholder: string;
    mismatch: string;
    tooShort: string;
    /** Server 400 `WEAK_PASSWORD` — parol juda oson yoki emailga o'xshash. */
    weakPassword: string;
    resetSubmit: string;
    resetSubmitting: string;
    tokenInvalidTitle: string;
    tokenInvalidText: string;
    successTitle: string;
    successText: string;
    toLogin: string;
  };

  signup: {
    title: string;
    titleAccent: string;
    subtitle: string;
    roleSeeker: string;
    roleEmployer: string;
    firstName: string;
    lastName: string;
    companyName: string;
    companyNamePlaceholder: string;
    email: string;
    password: string;
    passwordHint: string;
    submit: string;
    submitting: string;
    haveAccount: string;
    loginLink: string;
    connError: string;
  };

  error: {
    title404: string;
    title500: string;
    desc404: string;
    desc500: string;
    /** API vaqtincha javob bermaganda (HTTP 503) — sahifa indeksdan chiqmasin (audit R3, SEO). */
    title503: string;
    desc503: string;
    retry: string;
    backHome: string;
    viewVacancies: string;
  };

  footer: {
    tagline: string;
    seekersTitle: string;
    seekersVacancies: string;
    seekersResume: string;
    seekersSalary: string;
    seekersArticles: string;
    employersTitle: string;
    employersPost: string;
    employersBase: string;
    employersPricing: string;
    companyTitle: string;
    companyCompanies: string;
    companyContact: string;
    companySupport: string;
    rights: (year: number) => string;
  };

  support: {
    breadcrumb: string;
    title: string;
    subtitle: string;
    searchLabel: string;
    searchPlaceholder: string;
    searchButton: string;
    clearSearch: string;
    suggestionsLabel: string;
    /** Tezkor so'zlar — faqat savollar ichida natija beradiganlari chiqadi. */
    suggestions: string[];
    categoriesTitle: string;
    categoriesSubtitle: string;
    categoryCount: (n: number) => string;
    showAll: string;
    categories: Record<SupportCategoryKey, { title: string; description: string }>;
    faqTitle: string;
    faqInCategory: (category: string) => string;
    /**
     * Savollar ro'yxati (mavjud arxitektura: kontent lug'atda). Javobda `[matn](/yo'l)`
     * — ichki havola. `keywords` — qidiruv uchun qo'shimcha so'zlar.
     */
    faq: { id: string; category: SupportCategoryKey; q: string; a: string; keywords: string[] }[];
    results: (n: number) => string;
    articlesTitle: string;
    articlesAll: string;
    searchingArticles: string;
    emptyTitle: string;
    emptyText: string;
    noFaqTitle: string;
    noFaqText: string;
    errorTitle: string;
    errorText: string;
    retry: string;
    stillTitle: string;
    stillDesc: string;
    contactButton: string;
  };

  contact: {
    breadcrumb: string;
    title: string;
    subtitle: string;
    formTitle: string;
    required: string;
    nameLabel: string;
    namePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    subjectLabel: string;
    subjectPlaceholder: string;
    subjects: Record<ContactSubjectKey, string>;
    messageLabel: string;
    messagePlaceholder: string;
    submit: string;
    submitting: string;
    errors: {
      nameRequired: string;
      emailRequired: string;
      emailInvalid: string;
      subjectRequired: string;
      messageRequired: string;
      messageShort: (min: number) => string;
      messageLong: (max: number) => string;
    };
    errorSummary: string;
    prefilled: string;
    sendErrorTitle: string;
    sendErrorText: string;
    resend: string;
    rateLimited: string;
    successTitle: string;
    successText: string;
    sendAnother: string;
    offlineTitle: string;
    offlineWithChannels: string;
    offlineNoChannels: string;
    channelsTitle: string;
    channelsText: string;
    channels: {
      email: string;
      telegram: string;
      telegramBot: string;
      telegramBotHint: string;
      phone: string;
      address: string;
      newTab: string;
    };
    channelsError: string;
    channelsRetry: string;
    partnership: { title: string; text: string; cta: string };
    features: { responseTitle: string; responseText: (hours: number) => string; hoursTitle: string };
    loading: string;
  };

  pricing: {
    breadcrumb: string;
    title: string;
    subtitle: string;
    perMonth: string;
    popular: string;
    choose: string;
    plans: { name: string; price: string; features: string[] }[];
  };

  profile: {
    title: string;
    subtitle: string;
    personalSection: string;
    firstName: string;
    lastName: string;
    phone: string;
    phonePlaceholder: string;
    headline: string;
    headlinePlaceholder: string;
    region: string;
    regionPlaceholder: string;
    email: string;
    emailHint: string;
    openToWork: string;
    openToWorkHint: string;
    save: string;
    saving: string;
    saved: string;
    phoneInvalid: string;
    phoneVerified: string;
    phoneVerifyHint: string;
    additionalPhone: string;
    additionalPhonePlaceholder: string;
    resumeSection: string;
    resumeHint: string;
    upload: string;
    uploading: string;
    view: string;
    replace: string;
    remove: string;
    onlyPdf: string;
    uploadError: string;
    noResume: string;
  };

  resume: {
    sectionTitle: string;
    sectionHint: string;
    jobTitle: string;
    jobTitlePlaceholder: string;
    summary: string;
    summaryPlaceholder: string;
    desiredSalary: string;
    skills: string;
    skillsPlaceholder: string;
    experience: string;
    addExperience: string;
    position: string;
    companyName: string;
    startDate: string;
    endDate: string;
    current: string;
    descriptionLabel: string;
    education: string;
    addEducation: string;
    institution: string;
    degree: string;
    field: string;
    startYear: string;
    endYear: string;
    remove: string;
    save: string;
    saving: string;
    saved: string;
    emptyExperience: string;
    emptyEducation: string;
  };

  employerProfile: {
    verification: {
      title: string;
      intro: string;
      verified: string;
      verifiedHint: string;
      pending: string;
      pendingHint: (date: string) => string;
      rejected: string;
      legalName: string;
      legalNamePlaceholder: string;
      stir: string;
      stirHint: string;
      stirInvalid: string;
      submit: string;
      resubmit: string;
      sent: string;
      needCompany: string;
    };
    title: string;
    subtitle: string;
    createHint: string;
    name: string;
    namePlaceholder: string;
    description: string;
    descriptionPlaceholder: string;
    website: string;
    region: string;
    regionPlaceholder: string;
    industry: string;
    industryPlaceholder: string;
    employeeCount: string;
    foundedYear: string;
    save: string;
    saving: string;
    saved: string;
    view: string;
    logo: string;
    logoHint: string;
    logoUpload: string;
    logoUploading: string;
    logoRemove: string;
    logoSaveFirst: string;
  };

  empVacancies: {
    title: string;
    subtitle: string;
    newButton: string;
    empty: string;
    applicationsCount: (n: number) => string;
    statusActive: string;
    statusArchived: string;
    statusDraft: string;
    statusModeration: string;
    statusRejected: string;
    rejectionReason: (reason: string) => string;
    close: string;
    reopen: string;
    delete: string;
    deleteConfirm: string;
    viewApplications: string;
    formTitle: string;
    fTitle: string;
    fTitlePlaceholder: string;
    fDescription: string;
    fDescriptionPlaceholder: string;
    fRequirements: string;
    fRequirementsPlaceholder: string;
    fConditions: string;
    fConditionsPlaceholder: string;
    fCategory: string;
    fRegion: string;
    fEmployment: string;
    fExperience: string;
    fSalaryMin: string;
    fSalaryMax: string;
    fContactPhone: string;
    fContacts: string;
    fContactsHint: string;
    fContactPhonePlaceholder: string;
    fApplyWithoutResume: string;
    select: string;
    submit: string;
    submitting: string;
    cancel: string;
    needCompanyTitle: string;
    needCompanyDesc: string;
    needCompanyButton: string;
  };

  empApplications: {
    title: string;
    subtitle: string;
    empty: string;
    forVacancy: string;
    viewResume: string;
    hideResume: string;
    noResume: string;
    chat: string;
    desiredSalary: string;
    resumeSummary: string;
    resumeSkills: string;
    resumeExperience: string;
    resumeEducation: string;
    statusLabel: Record<string, string>;
    actionViewed: string;
    actionInvite: string;
    actionReject: string;
    actionAccept: string;
    selectApplicant: string;
    applicantProfile: string;
    contactInfo: string;
    openToWork: string;
    regionLabel: string;
    appliedAt: string;
    newCount: (n: number) => string;
    reasonOptional: string;
    reasonHint: string;
    reasonPlaceholder: string;
    confirm: string;
    cancel: string;
    back: string;
  };

  chat: {
    title: string;
    conversations: string;
    empty: string;
    emptyHint: string;
    selectConversation: string;
    placeholder: string;
    send: string;
    noMessages: string;
    vacancyLabel: string;
    rate: string;
    rateTitle: string;
    rateLocked: string;
    rateOnce: string;
    rateCommentPlaceholder: string;
    rateSubmit: string;
    rateSaving: string;
    rateSaved: string;
    ratingOf: (avg: string, count: number) => string;
    partnerInfo: string;
    openToWorkYes: string;
  };

  enums: {
    employment: Record<"full_time" | "part_time" | "remote" | "shift", string>;
    experience: Record<"none" | "one_to_three" | "three_to_six" | "six_plus", string>;
    workplace: Record<"office" | "hybrid" | "remote", string>;
  };

  fmt: {
    salaryHidden: string;
    currency: string;
    salaryFrom: (v: string) => string;
    salaryTo: (v: string) => string;
    salaryRange: (min: string, max: string) => string;
    today: string;
    yesterday: string;
    daysAgo: (n: number) => string;
    vacanciesCount: (n: number) => string;
  };
}

/** Bitta bildirishnoma shabloni: `{param}` o'rinlari bilan (audit R3, D-059). */
export interface NotificationTemplate {
  title: string;
  body: string;
}

/**
 * Server `payload.i18n.key` da yuboradigan kalitlar (audit R3, D-059).
 * Ro'yxatda yo'q kalit — bazadagi matn ko'rsatiladi, xato chiqmaydi.
 */
export type NotificationTemplateKey =
  | "application.new"
  | "application.statusChanged"
  | "alerts.newMatches"
  | "vacancy.rejected"
  | "vacancy.approved"
  | "vacancy.archivedByAdmin"
  | "company.verified"
  | "company.verificationRemoved"
  | "company.verificationRejected"
  | "vacancy.incomplete"
  | "payment.confirmed"
  | "security.phone_changed"
  | "security.recovery_completed"
  | "security.sessions_invalidated";

/**
 * API javobidagi `error` kodlari (audit R3, i18n-3). Faqat shu kodlar tarjima qilinadi;
 * qolganida umumiy matn ko'rsatiladi — serverning o'zbekcha xabari ru/en da chiqmasin.
 * `NETWORK`/`BAD_RESPONSE` — klient tomonidagi kodlar (`ApiError`).
 */
export type ApiErrorCode =
  | "INVALID_CREDENTIALS"
  | "EMAIL_TAKEN"
  | "WEAK_PASSWORD"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "TOO_MANY_ATTEMPTS"
  | "PHONE_NOT_VERIFIED"
  | "TELEGRAM_UNAVAILABLE"
  | "USE_PHONE_CHANGE"
  | "VACANCY_LOCKED"
  | "VACANCY_HAS_APPLICATIONS"
  | "WRITE_CONFLICT"
  | "SERVICE_UNAVAILABLE"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "NETWORK"
  | "BAD_RESPONSE";

export interface ExtraMessages {
  metaExtra: {
    favorites: { title: string; description: string };
    notifications: { title: string; description: string };
    alerts: { title: string; description: string };
    salaries: { title: string; description: string };
    admin: { title: string; description: string };
  };

  navExtra: {
    favorites: string;
    notifications: string;
    alerts: string;
    salaries: string;
    admin: string;
    applications: string;
    settings: string;
    accountMenu: string;
  };

  favorites: {
    title: string;
    subtitle: string;
    empty: string;
    emptyHint: string;
    browse: string;
    closed: string;
    remove: string;
    add: string;
    count: (n: number) => string;
  };

  notifications: {
    title: string;
    subtitle: string;
    empty: string;
    emptyHint: string;
    markAllRead: string;
    allRead: string;
    unreadOnly: string;
    showAll: string;
    delete: string;
    viewAll: string;
    /** Ro'yxat yuklanmadi — "bildirishnoma yo'q" deb ko'rsatilmaydi. */
    loadError: string;
    /** Amal (o'qildi / hammasi o'qildi) serverda bajarilmadi — soxta muvaffaqiyat ko'rsatilmaydi (audit R3, api-errors-4). */
    actionError: string;
    retry: string;
    settings: string;
    settingsTitle: string;
    settingsHint: string;
    channelUnavailable: string;
    saved: string;
    save: string;
    types: {
      new_application: string;
      application_status_changed: string;
      new_vacancy_match: string;
      system: string;
    };
    channels: { in_app: string; email: string; push: string; telegram: string };
    push: {
      title: string;
      hint: string;
      enable: string;
      disable: string;
      enabled: string;
      blocked: string;
      unsupported: string;
      notConfigured: string;
    };
  };

  alerts: {
    title: string;
    subtitle: string;
    empty: string;
    emptyHint: string;
    saveCurrent: string;
    dialogTitle: string;
    nameLabel: string;
    namePlaceholder: string;
    frequencyLabel: string;
    instant: string;
    daily: string;
    create: string;
    cancel: string;
    created: string;
    delete: string;
    deleted: string;
    active: string;
    paused: string;
    pause: string;
    resume: string;
    lastChecked: string;
    never: string;
    loginRequired: string;
  };

  salaries: {
    breadcrumb: string;
    title: string;
    subtitle: string;
    marketStat: { label: string; caption: string };
    /** `title` ichida `\n` — ikki qatorga bo'linadi. */
    promo: { title: string; text: string };
    search: {
      label: string;
      placeholder: string;
      clear: string;
      submit: string;
      searching: string;
      region: string;
      allRegions: string;
      experience: string;
      allLevels: string;
    };
    popular: { label: string; more: string };
    roles: Record<
      | "frontend-developer"
      | "backend-developer"
      | "ui-ux-designer"
      | "marketer"
      | "accountant"
      | "sales-manager"
      | "hr"
      | "data-analyst",
      { label: string; meta: string }
    >;
    levels: Record<"junior" | "middle" | "senior" | "lead", { label: string; years: string }>;
    selected: {
      all: string;
      allMeta: string;
      categoryMeta: string;
      query: (text: string) => string;
      wholeCountry: string;
      save: string;
      viewVacancies: string;
      vacancies: (n: number) => string;
      clear: string;
    };
    cards: {
      median: string;
      medianHint: string;
      average: string;
      averageHint: string;
      range: string;
      rangeHint: string;
      vsMarket: string;
      basedOn: (n: number) => string;
      scale: (min: string, max: string) => string;
    };
    distribution: {
      title: string;
      subtitle: string;
      /** Millionlar qisqartmasi: mln / млн / M */
      unit: string;
      medianBucket: string;
      colRange: string;
      colCount: string;
    };
    experience: {
      title: string;
      subtitle: string;
      noData: string;
      empty: string;
      colLevel: string;
      colMedian: string;
      colCount: string;
    };
    tables: {
      byCategory: string;
      byRegion: string;
      colName: string;
      colRegion: string;
      colMedian: string;
      colAverage: string;
      colCount: string;
      showAll: (n: number) => string;
      showLess: string;
      select: (name: string) => string;
      unselect: (name: string) => string;
      empty: string;
    };
    insights: {
      title: string;
      subtitle: string;
      experienceTitle: string;
      experienceText: (top: string, base: string, diff: string) => string;
      experienceFallback: string;
      regionTitle: string;
      regionText: (top: string, bottom: string, diff: string) => string;
      regionFallback: string;
      industryTitle: string;
      industryText: (name: string, value: string) => string;
      industryFallback: string;
      /** Farq: "2,1 baravar" / "в 2,1 раза" / "2.1×" */
      times: (x: string) => string;
      /** Farq: "45%" / "на 45%" / "45%" */
      percent: (p: number) => string;
    };
    cta: {
      title: string;
      text: (from: string, to: string) => string;
      textAll: string;
      primary: string;
      secondary: string;
    };
    states: {
      emptyTitle: string;
      emptyText: string;
      reset: string;
      errorTitle: string;
      errorText: string;
      retry: string;
      loading: string;
    };
  };

  /** `/vacancies` — vakansiyalar qidiruvi va ro'yxati. */
  vacanciesPage: {
    subtitle: string;
    listLabel: string;
    /** `title` ichida `\n` — ikki qatorga bo'linadi. */
    promo: { title: string; text: string };
    search: {
      label: string;
      placeholder: string;
      clear: string;
      submit: string;
      searching: string;
      region: string;
      allRegions: string;
      workType: string;
      allWorkTypes: string;
      multiple: (n: number) => string;
    };
    popular: { label: string; more: string };
    workTypes: Record<"full-time" | "part-time" | "remote" | "shift", string>;
    experience: Record<"junior" | "middle" | "senior" | "lead", string>;
    schedule: Record<"five_two" | "two_two" | "vahta" | "gibkiy" | "smenniy", string>;
    filters: {
      title: string;
      clearAll: string;
      open: string;
      close: string;
      apply: string;
      region: string;
      showMore: (n: number) => string;
      showLess: string;
      workType: string;
      experience: string;
      salary: string;
      salaryFrom: string;
      salaryTo: string;
      salaryApply: string;
      category: string;
      allCategories: string;
      company: string;
      companySearch: string;
      companyEmpty: string;
      verified: string;
      premium: string;
    };
    toolbar: {
      count: (n: number) => string;
      sort: string;
      sorts: Record<"relevant" | "salary" | "newest" | "popular" | "salary-asc", string>;
    };
    chips: {
      remove: (label: string) => string;
      salary: (from: string | null, to: string | null) => string;
      verified: string;
      premium: string;
    };
    card: {
      details: string;
      save: string;
      unsave: string;
      verified: string;
      skills: string;
      premium: string;
      urgent: string;
    };
    pagination: {
      label: string;
      prev: string;
      next: string;
      page: (n: number) => string;
      perPage: string;
      range: (from: number, to: number, total: number) => string;
    };
    states: {
      emptyTitle: string;
      emptyText: string;
      reset: string;
      errorTitle: string;
      errorText: string;
      retry: string;
      loading: string;
    };
  };

  /** `/companies/:slug` — ochiq kompaniya profili. */
  companyDetail: {
    breadcrumb: string;
    verified: string;
    rating: (value: string) => string;
    reviewsCount: (n: number) => string;
    employees: (range: string) => string;
    founded: (year: number) => string;
    country: string;
    actions: {
      follow: string;
      following: string;
      followLabel: (name: string) => string;
      unfollowLabel: (name: string) => string;
      share: string;
      message: string;
      copied: string;
      copyFailed: string;
    };
    tabs: {
      label: string;
      overview: string;
      vacancies: (n: number) => string;
      reviews: (n: number) => string;
      photos: (n: number) => string;
    };
    about: { title: string; more: string; less: string };
    stats: { label: string; employees: string; founded: string; industry: string; country: string };
    gallery: { title: string; all: (n: number) => string; label: string };
    vacancies: {
      title: (n: number) => string;
      all: string;
      emptyTitle: string;
      emptyText: string;
      browse: string;
      /** Sahifadagi ro'yxat cheklangan — barcha faol vakansiyalar qidiruvda. */
      viewAllCount: (n: number) => string;
    };
    reviews: {
      title: string;
      all: string;
      summary: (n: number) => string;
      distribution: string;
      starsRow: (stars: number, count: number) => string;
      emptyTitle: string;
      emptyText: string;
      anonymous: string;
      writeHint: string;
      loginToWrite: string;
      mine: string;
    };
    links: { title: string };
    location: { title: string };
    industries: { title: string };
    similar: { title: string; all: string };
    states: {
      loading: string;
      errorTitle: string;
      errorText: string;
      retry: string;
      notFoundTitle: string;
      notFoundText: string;
      back: string;
    };
    meta: { description: (name: string) => string };
  };

  /** `/vacancies/:slug` — vakansiya detail sahifasi. */
  vacancyDetail: {
    breadcrumb: string;
    /** `relative` — formatRelativeDays natijasi ("3 kun oldin"). */
    postedAgo: (relative: string) => string;
    views: (n: number) => string;
    salaryType: { gross: string; net: string };
    metaLabel: string;
    location: string;
    experience: string;
    employment: string;
    schedule: string;
    workplace: string;
    skills: { title: string; more: (n: number) => string; less: string };
    actions: {
      save: string;
      saved: string;
      saveLabel: string;
      unsaveLabel: string;
      share: string;
      copied: string;
      copyFailed: string;
    };
    apply: {
      title: string;
      subtitle: string;
      open: string;
      until: (date: string) => string;
      resume: string;
      noResume: string;
      noResumeHint: string;
      fillResume: string;
      withoutResume: string;
      cta: string;
      submitting: string;
      guestCta: string;
      guestHint: string;
      signupPrompt: string;
      signup: string;
      employer: string;
      appliedTitle: string;
      appliedOn: (date: string) => string;
      status: string;
      myApplications: string;
      error: string;
      loading: string;
      contacts: string;
    };
    sticky: { label: string };
    gallery: {
      label: string;
      all: (n: number) => string;
      prev: string;
      next: string;
      open: (i: number, n: number) => string;
      counter: (i: number, n: number) => string;
      close: string;
      alt: (name: string, i: number) => string;
      dialog: string;
    };
    tabs: { label: string; about: string; company: string; reviews: (n: number) => string };
    sections: { requirements: string; conditions: string };
    company: {
      title: string;
      view: string;
      vacancies: (n: number) => string;
      employees: (range: string) => string;
      founded: (year: number) => string;
      reviews: (n: number) => string;
      rating: (value: string) => string;
      about: string;
      industry: string;
      region: string;
      website: string;
      employeesLabel: string;
      foundedLabel: string;
      gallery: string;
      galleryAll: (n: number) => string;
      verified: string;
    };
    reviews: { title: string; loading: string; error: string; retry: string; all: string; empty: string };
    similar: { title: string; all: string };
    share: { label: string; telegram: string; facebook: string; linkedin: string; x: string; copy: string; copied: string };
    report: {
      link: string;
      title: string;
      subtitle: string;
      reason: string;
      reasons: Record<"outdated" | "wrong" | "fraud" | "other", string>;
      comment: string;
      commentPlaceholder: string;
      email: string;
      submit: string;
      sending: string;
      cancel: string;
      close: string;
      done: string;
      offline: string;
      error: string;
      support: string;
      invalidEmail: string;
    };
    states: {
      loading: string;
      errorTitle: string;
      errorText: string;
      retry: string;
      notFoundTitle: string;
      notFoundText: string;
      back: string;
    };
  };

  /** `/applications` — nomzodning arizalari (akkaunt bo'limi). */
  applicationsPage: {
    breadcrumb: string;
    title: string;
    subtitle: string;
    /** Backend enum'i: sent / viewed / invited / accepted / rejected. */
    status: { sent: string; viewed: string; invited: string; accepted: string; rejected: string };
    timeline: { sent: string; viewed: string; invited: string; accepted: string; rejected: string };
    summary: {
      label: string;
      total: string;
      totalHint: string;
      /** Holatlar ko'p bo'lsa oxirgilari bitta kartada: "Yana 2 ta holat". */
      more: (n: number) => string;
    };
    tabs: { label: string; all: string };
    filters: {
      label: string;
      search: string;
      searchLabel: string;
      clear: string;
      status: string;
      allStatuses: string;
      date: string;
      dates: { all: string; "7d": string; "30d": string; "90d": string };
      sort: string;
      sorts: { newest: string; oldest: string; status: string };
    };
    list: { label: string; results: (n: number) => string };
    card: {
      verified: string;
      closed: string;
      viewVacancy: string;
      viewApplication: string;
      openVacancy: string;
      companyPage: string;
      actions: (title: string) => string;
      viewDetails: string;
      /** Holatga mos "keyingi qadam" satri (faqat haqiqiy holat uchun). */
      next: { sent: string; viewed: string; invited: string; accepted: string; rejected: string };
    };
    detail: {
      label: string;
      close: string;
      facts: string;
      appliedAt: string;
      salary: string;
      location: string;
      employment: string;
      experience: string;
      source: string;
      sourceSite: string;
      sourceTelegram: string;
      resume: string;
      resumeOpen: string;
      coverLetter: string;
      timeline: string;
      current: string;
      responseHint: string;
      messages: string;
      closedHint: string;
    };
    pagination: {
      label: string;
      prev: string;
      next: string;
      page: (n: number) => string;
      range: (from: number, to: number, total: number) => string;
      perPage: string;
      perPageOption: (n: number) => string;
    };
    sidebar: {
      statsTitle: string;
      totalLabel: string;
      reviewed: string;
      reviewedHint: (reviewed: number, total: number) => string;
      distribution: string;
      lastApplied: (relative: string) => string;
      tipsTitle: string;
      tipsAll: string;
      tips: {
        profile: { title: string; text: string };
        resume: { title: string; text: string };
        resumeFill: { title: string; text: string };
        interview: { title: string; text: string };
        alerts: { title: string; text: string };
      };
      help: { title: string; text: string; cta: string };
    };
    /** "Faol bo'ling!" — profil to'liqligi < 100% bo'lganda. */
    prompt: {
      title: string;
      /** 0–49, 50–79, 80–99% (100% — karta chizilmaydi). */
      levels: { low: string; mid: string; high: string };
      text: string;
      progress: (percent: number) => string;
      cta: string;
      loading: string;
    };
    empty: { title: string; text: string; cta: string };
    filterEmpty: { title: string; text: string; clear: string };
    error: { title: string; text: string; retry: string };
    loading: string;
    meta: { title: string; description: string };
  };

  /** `/favorites` — saqlangan vakansiyalar paneli. Ish turi nomlari — `enums.employment`. */
  favoritesPage: {
    breadcrumb: string;
    title: string;
    subtitle: string;
    count: (n: number) => string;
    tabs: { label: string; all: string };
    filters: {
      label: string;
      search: string;
      searchLabel: string;
      clear: string;
      region: string;
      allRegions: string;
      type: string;
      allTypes: string;
      sort: string;
      sorts: { newest: string; oldest: string; salary: string; published: string };
    };
    list: { label: string; results: (n: number) => string };
    card: {
      verified: string;
      closed: string;
      viewVacancy: string;
      findSimilar: string;
      openVacancy: string;
      companyPage: string;
      savedAgo: (relative: string) => string;
      remove: (title: string) => string;
      removeShort: string;
      actions: (title: string) => string;
    };
    removed: { text: (title: string) => string; undo: string; error: string; restoreError: string };
    pagination: {
      label: string;
      prev: string;
      next: string;
      page: (n: number) => string;
      range: (from: number, to: number, total: number) => string;
      perPage: string;
      perPageOption: (n: number) => string;
    };
    sidebar: {
      statsTitle: string;
      totalLabel: string;
      open: string;
      closed: string;
      hint: string;
      closedHint: (n: number) => string;
      quickTitle: string;
      tipsTitle: string;
      tipsAll: string;
      tips: {
        alerts: { title: string; text: string };
        resume: { title: string; text: string };
        resumeFill: { title: string; text: string };
        profile: { title: string; text: string };
      };
      help: { title: string; text: string; cta: string };
    };
    empty: { title: string; text: string; cta: string };
    filterEmpty: { title: string; text: string; clear: string };
    error: { title: string; text: string; retry: string };
    loading: string;
  };

  /**
   * Server yaratgan bildirishnomalarning tarjima shablonlari (audit R3, D-059).
   * Server `payload.i18n = { key, params }` yuboradi; matn shu yerdan olinadi,
   * `{param}` o'rniga qiymat qo'yiladi. Kalit noma'lum yoki parametr yetishmasa —
   * bazadagi o'zbekcha `title`/`body` ko'rsatiladi (eski yozuvlar shunday qoladi).
   * Admin ommaviy xabari tarjima qilinmaydi (matnni admin yozadi).
   */
  notificationTemplates: Record<NotificationTemplateKey, NotificationTemplate>;

  /**
   * API xatolarining tarjimasi (audit R3, i18n-3). `apiErrorText(error, locale, { fallback, network, byCode })`
   * `codes` ni `byCode` sifatida oladi: kod ma'lum bo'lsa shu matn, aks holda `generic`
   * (uz tilida serverning o'z xabari). Tarmoq va buzilgan javob uchun — `network`.
   */
  errors: {
    generic: string;
    network: string;
    codes: Record<ApiErrorCode, string>;
  };

  /** `/notifications` — bildirishnomalar markazi. Tur/kanal/push nomlari — `notifications`. */
  notificationsPage: {
    breadcrumb: string;
    title: string;
    subtitle: string;
    unreadChip: (n: number) => string;
    allRead: string;
    tabs: { label: string; list: string; settings: string };
    actions: { label: string; unreadOnly: string; category: string; allCategories: string; markAllRead: string; allReadDone: string };
    categories: { application: string; vacancy: string; system: string; applicant: string; other: string };
    card: {
      unread: string;
      markRead: string;
      deleteShort: string;
      open: {
        applications: string;
        vacancy: string;
        vacancies: string;
        company: string;
        companies: string;
        profile: string;
        article: string;
        messages: string;
        alerts: string;
        pricing: string;
        employer: string;
        admin: string;
        page: string;
      };
    };
    time: { justNow: string; minutes: (n: number) => string; hours: (n: number) => string };
    notices: { markReadError: string; markAllError: string; deleteError: string; deleted: string; allMarked: string; dismiss: string };
    list: {
      label: string;
      results: (n: number) => string;
      truncated: (n: number) => string;
      /** Cursor sahifalash (audit R3, D-078): "yana yuklash" holatlari. */
      loadMore: string;
      loadingMore: string;
      loadMoreError: string;
      end: string;
    };
    pagination: {
      label: string;
      prev: string;
      next: string;
      page: (n: number) => string;
      range: (from: number, to: number, total: number) => string;
      perPage: string;
      perPageOption: (n: number) => string;
    };
    sidebar: {
      statsTitle: string;
      unreadLabel: string;
      totalLabel: (count: string) => string;
      readShare: (read: number, total: number) => string;
      categoriesTitle: string;
      settingsTitle: string;
      settingsText: string;
      settingsCta: string;
      tipTitle: string;
      tipHeading: string;
      tipText: string;
      help: { title: string; text: string; cta: string };
    };
    settings: {
      title: string;
      hint: string;
      saved: string;
      saveError: string;
      loadError: string;
      retry: string;
      unavailable: string;
      typeHints: { new_application: string; application_status_changed: string; new_vacancy_match: string; system: string };
    };
    empty: { title: string; text: string; cta: string };
    filterEmpty: { title: string; text: string; clear: string };
    error: { title: string; text: string; retry: string };
    loading: string;
  };

  messagesPage: {
    breadcrumb: string;
    title: string;
    subtitle: string;
    subtitleEmployer: string;
    loading: string;
    roles: { employer: string; job_seeker: string; admin: string };
    supportName: string;
    time: {
      today: string;
      yesterday: string;
      daysAgo: (n: number) => string;
      /** Kun ajratgichi: oy — 0..11 indeks. */
      day: (day: number, month: number, year: number) => string;
    };
    list: {
      title: string;
      searchLabel: string;
      searchPlaceholder: string;
      filtersLabel: string;
      all: (n: number) => string;
      unread: (n: number) => string;
      results: (n: number) => string;
      you: string;
      noMessages: string;
      unreadBadge: (n: number) => string;
      emptyTitle: string;
      emptyText: string;
      clear: string;
      /** Cursor sahifalash (audit R3, D-078): suhbatlar ro'yxatining davomi. */
      loadMore: string;
      loadingMore: string;
      loadMoreError: string;
      end: string;
    };
    chat: {
      back: string;
      details: string;
      verified: string;
      rating: (avg: string, count: number) => string;
      logLabel: (name: string) => string;
      newMessages: string;
      mine: string;
      sent: string;
      read: string;
      sending: string;
      failed: string;
      resend: string;
      discard: string;
      emptyTitle: string;
      emptyText: string;
      loading: string;
      errorTitle: string;
      errorText: string;
      retry: string;
      notFoundTitle: string;
      notFoundText: string;
      backToList: string;
      offline: string;
      /** Eskiroq xabarlar (audit R3, D-078). */
      loadOlder: string;
      loadingOlder: string;
      loadOlderError: string;
      historyStart: string;
    };
    vacancy: { label: string; about: string; closed: string };
    composer: { label: string; placeholder: string; send: string; hint: string };
    actions: { menu: string; details: string; rate: string; company: string; vacancy: string };
    details: {
      dialogTitle: string;
      close: string;
      companyPage: string;
      about: string;
      vacancyLink: string;
      links: string;
      newTab: string;
      openToWork: string;
      resume: string;
      skills: string;
      supportText: string;
      supportCta: string;
      myRating: (score: number) => string;
      profileError: string;
      retry: string;
    };
    rating: { dialogTitle: string; cancel: string };
    select: { title: string; text: string };
    empty: { title: string; text: string; textEmployer: string; cta: string };
    error: { title: string; text: string; retry: string };
  };

  pricingExtra: {
    currentPlan: string;
    activeUntil: string;
    unlimited: string;
    usage: (used: number, max: number) => string;
    activate: string;
    current: string;
    free: string;
    perMonthShort: string;
    payWith: string;
    payme: string;
    click: string;
    manualNotice: string;
    checkoutError: string;
    loginToBuy: string;
    employersOnly: string;
    paymentsTitle: string;
    noPayments: string;
    statusPending: string;
    statusPaid: string;
    statusFailed: string;
    statusRefunded: string;
    featureCandidates: string;
    featureVacancies: (n: number) => string;
    featureFeatured: (n: number) => string;
  };

  admin: {
    title: string;
    nav: {
      overview: string;
      users: string;
      vacancies: string;
      companies: string;
      reviews: string;
      payments: string;
      support: string;
      log: string;
    };
    overview: {
      supportOpen: string;
      verificationRequests: string;
      autoApprovedUnreviewed: string;
      users: string;
      seekers: string;
      employers: string;
      blocked: string;
      newThisWeek: string;
      companies: string;
      verified: string;
      activeVacancies: string;
      onModeration: string;
      applications: string;
      today: string;
      pendingReviews: string;
      revenue: string;
      searchEngine: string;
      chartTitle: string;
      chartUsers: string;
      chartApplications: string;
      actions: string;
      reindex: string;
      reindexDone: (n: number) => string;
      runAlerts: string;
      alertsDone: (n: number) => string;
      broadcast: string;
      broadcastTitle: string;
      broadcastBody: string;
      broadcastAudience: string;
      audienceAll: string;
      audienceSeekers: string;
      audienceEmployers: string;
      send: string;
      broadcastSent: (n: number) => string;
    };
    users: {
      searchPlaceholder: string;
      role: string;
      allRoles: string;
      block: string;
      unblock: string;
      blocked: string;
      makeAdmin: string;
      makeEmployer: string;
      makeSeeker: string;
      applications: string;
      registered: string;
      telegram: string;
      phoneVerified: string;
      empty: string;
    };
    /** Qo'lda tiklash so'rovlari — /admin/users ichidagi ko'rinish (audit R3, D-049, D-063). */
    recovery: {
      viewLabel: string;
      viewUsers: string;
      viewRequests: string;
      title: string;
      subtitle: string;
      statusLabel: string;
      allStatuses: string;
      status: {
        pending: string;
        approved: string;
        rejected: string;
        completed: string;
        expired: string;
      };
      requester: string;
      details: string;
      contact: string;
      created: string;
      account: string;
      accountMissing: string;
      accountRole: string;
      accountCreated: string;
      accountBlocked: string;
      phone: string;
      backupPhone: string;
      telegram: string;
      telegramLinked: string;
      telegramNotLinked: string;
      none: string;
      note: string;
      notePlaceholder: string;
      approve: string;
      reject: string;
      approveHint: string;
      reviewed: string;
      reviewNote: string;
      events: string;
      eventsShow: string;
      eventsHide: string;
      eventsEmpty: string;
      eventsError: string;
      eventsLoading: string;
      eventType: Record<string, string>;
      empty: string;
    };
    statuses: {
      vacancy: { draft: string; moderation: string; active: string; archived: string; rejected: string };
      review: { pending: string; approved: string; rejected: string };
    };
    roleNames: Record<"job_seeker" | "employer" | "admin" | "content_editor" | "content_author" | "moderator", string>;
    placementIssue: { categoryId: string; workplaceType: string; regionId: string };
    flags: { ownerBlocked: string; unverifiedCompany: string; reports: (n: number) => string };
    detail: {
      open: string;
      close: string;
      loadError: string;
      description: string;
      requirements: string;
      conditions: string;
      contacts: string;
      company: string;
      owner: string;
      phone: string;
      website: string;
      companyVacancies: string;
      salary: string;
      salaryHidden: string;
      category: string;
      region: string;
      workplace: string;
      employment: string;
      submitted: string;
      published: string;
      created: string;
      history: string;
      noHistory: string;
      reports: string;
      noReports: string;
      openPublic: string;
      ownerProfile: string;
    };
    reject: {
      title: string;
      templatesLabel: string;
      templates: string[];
      placeholder: string;
      submit: string;
      cancel: string;
      required: string;
    };
    bulk: {
      selectAll: string;
      select: (title: string) => string;
      selected: (n: number) => string;
      approve: string;
      reject: string;
      archive: string;
      remove: string;
      clear: string;
      result: (done: number, failed: number) => string;
    };
    companiesExtra: {
      filterLabel: string;
      filterAll: string;
      filterRequested: string;
      filterVerified: string;
      filterUnverified: string;
      requested: string;
      legalName: string;
      stir: string;
      rejectRequest: string;
      rejectPrompt: string;
      lastNote: string;
    };
    support: {
      kindLabel: string;
      allKinds: string;
      kinds: { contact: string; vacancy_report: string };
      statusLabel: string;
      allStatuses: string;
      statuses: { open: string; in_progress: string; resolved: string; dismissed: string };
      reportReasons: { outdated: string; wrong: string; fraud: string; other: string };
      subjects: Record<"general" | "technical" | "partnership" | "vacancy" | "suggestion" | "other", string>;
      from: string;
      anonymous: string;
      vacancy: string;
      note: string;
      notePlaceholder: string;
      saveNote: string;
      markInProgress: string;
      resolve: string;
      dismiss: string;
      reopen: string;
      reply: string;
      replyPlaceholder: string;
      send: string;
      cancel: string;
      replyUnavailable: string;
      noEmail: string;
      replied: string;
      archiveVacancy: string;
      empty: string;
    };
    log: {
      entityLabel: string;
      allEntities: string;
      entities: { vacancy: string; review: string; company: string; ticket: string };
      actorLabel: string;
      allActors: string;
      systemOnly: string;
      system: string;
      when: string;
      what: string;
      object: string;
      actions: Record<string, string>;
      empty: string;
    };
    userDetail: {
      back: string;
      open: string;
      notFound: string;
      account: string;
      emailVerified: string;
      phone: string;
      telegram: string;
      registered: string;
      companies: string;
      vacancies: string;
      applications: string;
      reviews: string;
      tickets: string;
      security: string;
      none: string;
      showing: (shown: number, total: number) => string;
    };
    broadcasts: {
      title: string;
      empty: string;
      status: { running: string; done: string; failed: string };
      delivered: (delivered: number, total: number) => string;
    };
    /** Moderatsiya navbati va 24 soatlik avto-tasdiq. */
    moderation: {
      queue: string;
      queueDetails: (vacancies: number, reviews: number) => string;
      autoApproveHours: (hours: number) => string;
      autoApproveOff: string;
      autoApproveIn: (time: string) => string;
      autoApproveDue: string;
      duration: (hours: number, minutes: number) => string;
      autoApproved: string;
      autoApprovedHint: string;
      filterAutoApproved: string;
      markReviewed: string;
      runNow: string;
      runDone: (vacancies: number, reviews: number) => string;
    };
    vacancies: {
      searchPlaceholder: string;
      status: string;
      allStatuses: string;
      approve: string;
      reject: string;
      archive: string;
      rejectReason: string;
      makePremium: string;
      removePremium: string;
      views: string;
      applications: string;
      empty: string;
    };
    companies: {
      searchPlaceholder: string;
      verify: string;
      unverify: string;
      verified: string;
      owner: string;
      plan: string;
      vacancies: string;
      reviews: string;
      empty: string;
    };
    reviews: {
      status: string;
      approve: string;
      reject: string;
      delete: string;
      author: string;
      company: string;
      empty: string;
    };
    payments: {
      status: string;
      confirm: string;
      confirmed: string;
      transaction: string;
      company: string;
      plan: string;
      amount: string;
      provider: string;
      empty: string;
    };
    common: {
      total: (n: number) => string;
      page: (a: number, b: number) => string;
      prev: string;
      next: string;
      confirmAction: string;
      done: string;
      failed: string;
      accessDenied: string;
      loadErrorTitle: string;
      loadErrorText: string;
      retry: string;
    };
  };

  /** Kontent boshqaruvi: /admin/articles, /admin/team, /admin/invite. */
  contentAdmin: {
    nav: { articles: string; team: string };
    roles: { admin: string; content_editor: string; content_author: string; moderator: string };
    accessDenied: string;
    toArticles: string;
    articles: {
      title: string;
      subtitle: string;
      subtitleAuthor: string;
      newArticle: string;
      searchLabel: string;
      searchPlaceholder: string;
      filtersLabel: string;
      all: string;
      status: { draft: string; in_review: string; published: string; archived: string };
      columns: { title: string; author: string; category: string; status: string; updated: string; published: string; actions: string };
      noAuthor: string;
      noCategory: string;
      notPublished: string;
      reviewNote: string;
      actions: {
        menu: (title: string) => string;
        edit: string;
        preview: string;
        view: string;
        submit: string;
        return: string;
        withdraw: string;
        publish: string;
        unpublish: string;
        archive: string;
        restore: string;
        delete: string;
      };
      confirm: { delete: (title: string) => string; unpublish: (title: string) => string; archive: (title: string) => string };
      returnNotePrompt: string;
      done: {
        saved: string;
        submitted: string;
        returned: string;
        published: string;
        unpublished: string;
        archived: string;
        restored: string;
        deleted: string;
      };
      failed: string;
      loading: string;
      empty: { title: string; text: string };
      emptyFilter: { title: string; text: string; reset: string };
      error: { title: string; text: string; retry: string };
      results: (n: number) => string;
    };
    editor: {
      newTitle: string;
      editTitle: string;
      back: string;
      fields: {
        title: string;
        titlePlaceholder: string;
        slug: string;
        slugHint: string;
        slugRedirectHint: string;
        excerpt: string;
        excerptHint: string;
        content: string;
        contentHint: string;
        cover: string;
        coverHint: string;
        coverUpload: string;
        coverReplace: string;
        coverRemove: string;
        coverUploading: string;
        category: string;
        categoryNone: string;
        author: string;
        authorNone: string;
        tags: string;
        tagsHint: string;
        tagsPlaceholder: string;
        tagRemove: (tag: string) => string;
        seoTitle: string;
        seoTitleHint: string;
        seoDescription: string;
        seoDescriptionHint: string;
      };
      sections: { status: string; cover: string; details: string; seo: string };
      toolbar: {
        label: string;
        h2: string;
        h3: string;
        bold: string;
        italic: string;
        ul: string;
        ol: string;
        link: string;
        quote: string;
        tip: string;
        image: string;
        divider: string;
        linkText: string;
        imageAlt: string;
      };
      tabs: { write: string; preview: string };
      buttons: { saveDraft: string; save: string; preview: string; submit: string; publish: string; saving: string };
      statusLabel: string;
      publishedAt: (date: string) => string;
      updatedAt: (date: string) => string;
      stats: { views: string; helpful: string };
      readOnly: { in_review: string; published: string; archived: string; foreign: string };
      unsaved: string;
      counter: (n: number, max: number) => string;
      previewEmpty: string;
      previewNote: string;
      errors: { title: string; contentShort: (min: number) => string; coverType: string; coverSize: string; generic: string };
      loading: string;
      notFound: { title: string; text: string };
      loadError: { title: string; text: string; retry: string };
    };
    preview: { banner: string; edit: string; back: string };
    team: {
      title: string;
      subtitle: string;
      invite: {
        title: string;
        text: string;
        email: string;
        emailPlaceholder: string;
        role: string;
        submit: string;
        sending: string;
        created: (email: string) => string;
        link: string;
        copy: string;
        copied: string;
        emailSent: string;
        emailNotSent: string;
        roleHints: { admin: string; content_editor: string; content_author: string; moderator: string };
      };
      members: {
        title: string;
        you: string;
        active: string;
        blocked: string;
        articles: (n: number) => string;
        joined: (date: string) => string;
        deactivate: string;
        activate: string;
        role: (name: string) => string;
        edit: string;
        noName: string;
      };
      invites: {
        title: string;
        expires: (date: string) => string;
        expired: string;
        invitedBy: (name: string) => string;
        revoke: string;
        empty: string;
      };
      profile: { title: string; fullName: string; position: string; save: string; cancel: string };
      confirm: { deactivate: (name: string) => string; revoke: (email: string) => string; role: (name: string, role: string) => string };
      done: { role: string; blocked: string; unblocked: string; revoked: string; profile: string };
      failed: string;
      loading: string;
      error: { title: string; text: string; retry: string };
    };
    invite: {
      title: string;
      text: (role: string) => string;
      email: string;
      fullName: string;
      position: string;
      positionHint: string;
      password: string;
      passwordHint: string;
      showPassword: string;
      hidePassword: string;
      submit: string;
      submitting: string;
      loading: string;
      invalid: { title: string; text: string };
      used: { title: string; text: string; login: string };
      expired: { title: string; text: string };
      signedIn: { title: string; text: (email: string) => string; logout: string };
      home: string;
      failed: string;
    };
  };

  sortLabels: {
    label: string;
    relevance: string;
    date: string;
    salaryDesc: string;
    salaryAsc: string;
  };

  empVacanciesExtra: {
    edit: string;
    editTitle: string;
    saveChanges: string;
  };

  /** `/employer/vacancies` — ish beruvchining "Vakansiyalarim" dashboard'i (+ forma sahifalari). */
  employerVacanciesPage: {
    loading: string;
    statsLabel: string;
    stats: { total: string; active: string; moderation: string; draft: string; rejected: string };
    searchLabel: string;
    searchPlaceholder: string;
    clearSearch: string;
    filters: {
      status: string;
      allStatuses: string;
      region: string;
      allRegions: string;
      category: string;
      allCategories: string;
      sort: string;
      reset: string;
    };
    optionCount: (label: string, n: number) => string;
    sort: { newest: string; oldest: string; applications: string; title: string };
    summary: (vacancies: number, applications: number) => string;
    listLabel: string;
    status: { active: string; moderation: string; draft: string; rejected: string; archived: string };
    created: (date: string) => string;
    published: (date: string) => string;
    actions: {
      applications: string;
      edit: string;
      close: string;
      activate: string;
      view: string;
      delete: string;
      menu: (title: string) => string;
    };
    empty: { title: string; text: string };
    noResults: { title: string; text: string; reset: string };
    error: { title: string; text: string; retry: string };
    deleteDialog: { title: string; text: (title: string) => string; confirm: string; cancel: string };
    notices: { created: string; submitted: string; updated: string; draft: string; closed: string; activated: string; deleted: string; dismiss: string };
    errors: { generic: string; transition: string; hasApplications: string; incomplete: string; phoneGate: string };
    pagination: {
      label: string;
      prev: string;
      next: string;
      page: (n: number) => string;
      range: (from: number, to: number, total: number) => string;
      perPage: string;
      perPageOption: (n: number) => string;
    };
    form: {
      back: string;
      newTitle: string;
      newSubtitle: string;
      editTitle: string;
      editSubtitle: string;
      notFoundTitle: string;
      notFoundText: string;
      cancel: string;
      metaNew: string;
      metaEdit: string;
    };
    applicationsFilter: { label: (title: string) => string; showAll: string; none: string };
  };

  /** `/employer/vacancies/new` va `/:id/edit` — vakansiya formasi (bosqichlar, preview, ko'rib chiqish). */
  vacancyForm: {
    breadcrumbNew: string;
    breadcrumbEdit: string;
    stepsLabel: string;
    steps: { basic: string; details: string; extra: string; review: string };
    stepProgress: (current: number, total: number, label: string) => string;
    stepDone: string;
    stepHasErrors: string;
    required: string;
    optional: string;
    sections: Record<"basic" | "description" | "requirements" | "conditions" | "extra" | "contacts", { title: string; subtitle: string }>;
    fields: {
      title: string;
      titlePlaceholder: string;
      category: string;
      categoryPlaceholder: string;
      schedule: string;
      schedulePlaceholder: string;
      region: string;
      regionPlaceholder: string;
      employment: string;
      employmentPlaceholder: string;
      experience: string;
      workplace: string;
      workplaceRemoteHint: string;
      salary: string;
      salaryFrom: string;
      salaryTo: string;
      currency: string;
      salaryHidden: string;
      salaryHiddenHint: string;
      description: string;
      descriptionPlaceholder: string;
      requirements: string;
      requirementsPlaceholder: string;
      conditions: string;
      conditionsPlaceholder: string;
      listHint: string;
      itemCount: (n: number) => string;
      applyWithoutResume: string;
      applyWithoutResumeHint: string;
      email: string;
      emailPlaceholder: string;
      telegram: string;
      telegramPlaceholder: string;
      phone: string;
      phonePlaceholder: string;
    };
    editor: { toolbar: string; bullet: string; numbered: string; heading: string; hint: string; count: (n: number) => string; min: (n: number) => string };
    errors: {
      titleRequired: string;
      titleShort: (min: number) => string;
      descriptionRequired: string;
      descriptionShort: (min: number) => string;
      employmentRequired: string;
      categoryRequired: string;
      regionRequired: string;
      workplaceRequired: string;
      salaryInvalid: string;
      salaryRange: string;
      emailInvalid: string;
      telegramLong: (max: number) => string;
      phoneLong: (max: number) => string;
      summary: (n: number) => string;
      saveTitle: string;
      saveText: string;
      retry: string;
      server: (message: string) => string;
    };
    tips: { title: string; items: { title: string; text: string }[] };
    preview: { title: string; open: string; label: string; hint: string; noTitle: string; noDescription: string };
    actions: {
      title: string;
      review: string;
      draft: string;
      cancel: string;
      publish: string;
      saveChanges: string;
      publishing: string;
      savingDraft: string;
      saving: string;
      backToEdit: string;
      publishNote: string;
      draftNote: string;
      editNote: string;
    };
    review: {
      title: string;
      subtitle: string;
      subtitleEdit: string;
      edit: string;
      about: string;
      requirements: string;
      conditions: string;
      contacts: string;
      withoutResume: string;
      details: string;
    };
    leave: { title: string; text: string; confirm: string; cancel: string };
  };

  /** `/employer/applications` — ish beruvchining "Murojaatlar" ish maydoni (ro'yxat + ariza + amallar). */
  employerApplicationsPage: {
    title: string;
    subtitle: string;
    loading: string;
    searchLabel: string;
    searchPlaceholder: string;
    clearSearch: string;
    filters: {
      open: string;
      title: string;
      vacancy: string;
      allVacancies: string;
      region: string;
      allRegions: string;
      period: string;
      periodAll: string;
      period7: string;
      period30: string;
      sort: string;
      sortNewest: string;
      sortOldest: string;
      reset: string;
      close: string;
      optionCount: (label: string, n: number) => string;
    };
    tabsLabel: string;
    tabs: Record<"all" | "sent" | "viewed" | "invited" | "accepted" | "rejected", string>;
    status: Record<"sent" | "viewed" | "invited" | "accepted" | "rejected", string>;
    listLabel: string;
    newMark: string;
    pagination: { label: string; prev: string; next: string; page: (n: number) => string; range: (from: number, to: number, total: number) => string };
    select: { title: string; text: string };
    back: string;
    detail: {
      label: string;
      menu: (name: string) => string;
      appliedBanner: (vacancy: string) => string;
      appliedOn: (date: string) => string;
      appliedAgo: (relative: string) => string;
      viaTelegram: string;
      openToWork: string;
      tabsLabel: string;
      tabs: { resume: string; letter: string; activity: string };
      noResume: string;
      summary: string;
      desiredSalary: string;
      skills: string;
      experience: string;
      education: string;
      present: string;
      letterTitle: string;
      activityApplied: string;
      activityStatus: (status: string) => string;
      infoTitle: string;
      email: string;
      phone: string;
      region: string;
    };
    sidebar: {
      label: string;
      statusTitle: string;
      statusLabel: string;
      statusPlaceholder: string;
      reasonLabel: string;
      reasonHint: string;
      reasonPlaceholder: string;
      update: string;
      updating: string;
      sameStatus: string;
      quickTitle: string;
      invite: string;
      accept: string;
      reject: string;
      message: string;
      messageOpening: string;
      vacancyTitle: string;
      openVacancy: string;
      editVacancy: string;
      onlyThisVacancy: string;
      applications: (n: number) => string;
    };
    dialog: {
      invite: { title: string; text: (name: string, vacancy: string) => string; confirm: string };
      accept: { title: string; text: (name: string, vacancy: string) => string; confirm: string };
      reject: { title: string; text: (name: string, vacancy: string) => string; confirm: string };
      cancel: string;
      busy: string;
    };
    notices: {
      updated: string;
      failed: string;
      failedWithReason: (message: string) => string;
      chatFailed: string;
      /** API ro'yxati cheklangan (eng yangi N ta) — umumiy son bilan. */
      capped: (shown: number, total: number) => string;
    };
    empty: { title: string; text: string; cta: string };
    noResults: { title: string; text: string; reset: string };
    error: { title: string; text: string; retry: string };
  };

  /** `/profile` — nomzodning karyera markazi (dashboard). */
  profileHub: {
    navLabel: string;
    /** Admin va kontent jamoasi uchun hisob sahifasi (StaffAccount) */
    staff: {
      title: string;
      subtitle: string;
      role: string;
    };
    nav: {
      overview: string;
      personal: string;
      resume: string;
      experience: string;
      education: string;
      skills: string;
      applications: string;
      saved: string;
      telegram: string;
      settings: string;
    };
    header: {
      nameMissing: string;
      headlineMissing: string;
      regionMissing: string;
      editProfile: string;
      viewResume: string;
      phoneVerified: string;
      openToWork: string;
      notOpenToWork: string;
      completion: string;
      completionHint: string;
      completionDone: string;
    };
    summary: {
      completion: string;
      resume: string;
      resumeReady: string;
      resumeIncomplete: string;
      applications: string;
      saved: string;
      count: (n: number) => string;
    };
    completion: {
      title: (percent: number) => string;
      subtitle: string;
      subtitleDone: string;
      progress: (done: number, total: number) => string;
      add: string;
      items: {
        name: string;
        phone: string;
        region: string;
        headline: string;
        skills: string;
        experience: string;
        education: string;
        resume: string;
      };
      skillsHint: (current: number, target: number) => string;
    };
    applications: {
      recentTitle: string;
      title: string;
      subtitle: string;
      viewAll: string;
      details: string;
      empty: string;
      emptyHint: string;
      browse: string;
      filterAll: string;
      filteredEmpty: string;
      closed: string;
      status: {
        sent: string;
        viewed: string;
        invited: string;
        accepted: string;
        rejected: string;
      };
    };
    saved: {
      title: string;
      subtitle: string;
      viewAll: string;
      empty: string;
      emptyHint: string;
      browse: string;
      closed: string;
    };
    states: {
      loadError: string;
      loadErrorHint: string;
      retry: string;
      saved: string;
      saveError: string;
      unsaved: string;
      cancel: string;
      required: string;
    };
    personal: {
      subtitle: string;
      basicGroup: string;
      contactGroup: string;
      statusGroup: string;
      phoneVerifyLink: string;
    };
    resume: {
      title: string;
      subtitle: string;
      stepOf: (step: number, total: number) => string;
      stepLabel: (step: number) => string;
      steps: {
        personal: string;
        professional: string;
        experience: string;
        education: string;
        skills: string;
        review: string;
      };
      next: string;
      back: string;
      personalStepHint: string;
      openPersonal: string;
      professionalHint: string;
      reviewHint: string;
      notFilled: string;
      present: string;
      perMonth: string;
      fileTitle: string;
      fileEmpty: string;
      fileTooBig: string;
    };
    experience: {
      subtitle: string;
      emptyHint: string;
      newTitle: string;
      editTitle: string;
      edit: string;
      delete: string;
      confirmDelete: string;
      invalidDates: string;
    };
    education: {
      subtitle: string;
      emptyHint: string;
      newTitle: string;
      editTitle: string;
      invalidYear: string;
      invalidYears: string;
    };
    skills: {
      subtitle: string;
      empty: string;
      suggested: string;
      duplicate: string;
      tooLong: string;
      removeLabel: (skill: string) => string;
      count: (n: number) => string;
      suggestions: string[];
    };
    telegram: {
      title: string;
      subtitle: string;
      connectedTitle: string;
      connectedHint: string;
      benefits: string[];
      compactHint: string;
      open: string;
    };
    settings: {
      subtitle: string;
      account: string;
      emailHint: string;
      phoneStatus: string;
      verify: string;
      preferences: string;
      language: string;
      languageHint: string;
      theme: string;
      themeHint: string;
      notifications: string;
      notificationsHint: string;
      manage: string;
      security: string;
      password: string;
      passwordHint: string;
      /** Parolni Telegram orqali tiklash oqimiga havola (audit R3, D-045). */
      resetPassword: string;
      contactSupport: string;
      logout: string;
      logoutHint: string;
      danger: string;
      deleteAccount: string;
      deleteHint: string;
    };
    footer: {
      help: string;
    };
  };

  // /companies — ish beruvchilar katalogi
  companiesPage: {
    subtitle: string;
    search: {
      label: string;
      placeholder: string;
      submit: string;
      clear: string;
      searching: string;
    };
    quick: {
      label: string;
      all: string;
      remote: string;
      more: string;
      less: string;
    };
    industries: Record<
      "it" | "finance" | "education" | "trade" | "marketing" | "government" | "manufacturing" | "construction" | "tourism" | "logistics",
      string
    >;
    featured: {
      title: string;
      subtitle: string;
      prev: string;
      next: string;
    };
    banner: {
      title: string;
      text: string;
      cta: string;
    };
    filters: {
      title: string;
      clear: string;
      industry: string;
      region: string;
      regionAll: string;
      size: string;
      sizeOption: (range: string) => string;
      rating: string;
      ratingAny: string;
      ratingOption: (value: string) => string;
      work: string;
      workOffice: string;
      workRemote: string;
      workHint: string;
      verified: string;
      hiring: string;
      saved: string;
      apply: string;
      showMore: (n: number) => string;
      showLess: string;
      open: string;
      close: string;
    };
    toolbar: {
      count: (n: number) => string;
      sortLabel: string;
      sorts: Record<"popular" | "rating" | "vacancies" | "newest", string>;
      view: string;
      viewGrid: string;
      viewList: string;
      activeFilters: string;
      removeFilter: (label: string) => string;
      clearAll: string;
    };
    card: {
      /** `formatted` — ixcham ko'rinish ("1.2K"), `count` — ko'plik shakli uchun. */
      reviews: (count: number, formatted: string) => string;
      noReviews: string;
      vacancies: (n: number) => string;
      noVacancies: string;
      employees: (range: string) => string;
      view: string;
      save: (name: string) => string;
      unsave: (name: string) => string;
      loginToSave: string;
      rating: (value: string) => string;
    };
    states: {
      resultsLabel: string;
      emptyTitle: string;
      emptyText: string;
      emptyCta: string;
      errorTitle: string;
      errorText: string;
      retry: string;
      loadingMore: string;
      loadMoreError: string;
      end: string;
      savedLoginTitle: string;
      savedLoginText: string;
      savedLoginCta: string;
      savedEmptyTitle: string;
      savedEmptyText: string;
    };
  };
}

/**
 * To'liq lug'at = asosiy bo'limlar + yangi bo'limlar.
 * Ikkisi ham `useT()` orqali bir xil ishlatiladi: `t.nav.vacancies`, `t.favorites.title`.
 */
export type Messages = BaseMessages & ExtraMessages;

/* Til fayllari uchun umumiy yordamchilar — bir nusxada, har tilda takrorlanmasin. */

/** Raqamlarni bo'sh joy bilan guruhlaydi (1 207). */
export const grp = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

/** Rus tilida son shaklini to'g'ri tanlaydi: 1 вакансия / 2 вакансии / 5 вакансий. */
export function ruPlural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
