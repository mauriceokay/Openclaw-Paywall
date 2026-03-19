import en from "./en";

const it = {
  ...en,
  nav: {
    ...en.nav,
    home: "Home",
    blog: "Blog",
    pricing: "Prezzi",
    dashboard: "Dashboard",
    getStarted: "Inizia ora",
    signOut: "Esci",
  },
  blog: {
    ...en.blog,
    title: "Guide, Confronti e Consigli",
    description:
      "Tutto quello che devi sapere su OpenClaw, openclawd, ClawdBot, MoltBot e su come creare il tuo assistente AI.",
    featured: "In evidenza",
    readArticle: "Leggi l'articolo",
    read: "Leggi",
    topicsLabel: "Argomenti",
    categories: { Guides: "Guide", Technical: "Tecnico", Comparisons: "Confronti" },
  },
  blogPost: {
    ...en.blogPost,
    back: "Blog",
    related: "Articoli correlati",
    ctaTitle: "Pronto a usare la tua AI?",
    ctaDesc:
      "Avvia la tua istanza OpenClaw personale in pochi minuti, senza server e senza configurazioni complesse.",
    ctaBtn: "Avvia OpenClaw ora",
    ctaMoreInfo: "Inizia con OpenClaw Cloud",
    faqTitle: "Domande frequenti",
  },
  footer: {
    ...en.footer,
    tagline:
      "Il tuo assistente AI personale. Ogni OS. Ogni piattaforma. In stile aragosta.",
    terms: "Termini",
    privacy: "Privacy",
  },
  dashboard: {
    ...en.dashboard,
    loadingWorkspace: "Caricamento workspace...",
    accessError: "Errore di accesso",
    accessErrorDesc: "Impossibile verificare lo stato del tuo abbonamento.",
    tryAgain: "Riprova",
    premiumTitle: "Workspace Premium",
    premiumDesc:
      "Questa dashboard è bloccata. Fai l'upgrade dell'account per gestire il gateway OpenClaw, vedere analytics e configurare routing avanzato.",
    billingBlockedDesc:
      "Il tuo account è temporaneamente bloccato perché l'uso non pagato ha raggiunto $15. Completa il pagamento per sbloccare l'accesso.",
    viewPlans: "Vedi piani di abbonamento",
    title: "Dashboard Workspace",
    welcomeBack: "Bentornato",
    gatewayOnline: "Il tuo gateway è online.",
    manageSubscription: "Gestisci abbonamento",
    portalError: "Impossibile aprire il portale di fatturazione. Riprova.",
    instanceTitle: "La tua istanza OpenClaw",
    instanceStatus: "Gateway online · Porta 3001 · Pronto per chattare",
    openInstance: "Apri OpenClaw",
    currentPlan: "Piano attuale",
    defaultPlan: "Piano Pro",
    statusLabel: "Stato",
    defaultStatus: "Attivo",
    renewsLabel: "Rinnovo",
    gatewayStatus: "Stato gateway",
    gatewayOnlineLabel: "Online",
    listeningOn: "In ascolto sulla porta 3001",
    aiProvider: "Provider AI",
    modeNotSet: "non impostato",
    changeSetup: "Modifica setup →",
  },
  setup: {
    ...en.setup,
    step1Label: "Connetti canali",
    step2Label: "Fatturazione AI",
    step1Badge: "Passo 1 di 2",
    step2Badge: "Passo 2 di 2",
    step1Title: "Connetti i tuoi canali",
    step1Desc:
      "Collega le tue piattaforme di messaggistica così OpenClaw può gestire le conversazioni per te.",
    connected: "Connesso",
    disconnect: "Disconnetti",
    connect: "Connetti",
    cancel: "Annulla",
    saveConnection: "Salva connessione",
    continue: "Continua",
    skipForNow: "Salta per ora",
    step2Title: "Come vuoi alimentare la tua AI?",
    step2Desc:
      "Scegli come OpenClaw usa i modelli AI. Puoi cambiare questa scelta in qualsiasi momento dal dashboard.",
    byokTitle: "Usa la tua API key",
    byokDesc:
      "Collega la tua chiave OpenAI, Anthropic o Gemini. Paghi direttamente il provider senza ricarichi.",
    byokFeatures: ["Controllo completo del modello", "Paghi il provider al costo reale"],
    paygTitle: "Pay As You Go",
    paygDesc:
      "Pensiamo noi a tutto. Usa OpenClaw subito: l'uso viene addebitato automaticamente all'abbonamento.",
    paygFeatures: ["Zero configurazione", "Funziona subito", "Uso tracciato nel dashboard"],
    selected: "Selezionato",
    apiKeyTitle: "Inserisci la tua API key",
    apiKeyDesc:
      "La tua chiave viene salvata localmente nel browser e non viene inviata ai nostri server.",
    providerLabel: "Provider",
    modelLabel: "Modello",
    apiKeyLabel: "API key",
    apiKeyNote: "Le chiavi sono salvate solo nel local storage del browser.",
    saveAndContinue: "Salva e continua",
    savedTitle: "È tutto pronto!",
    savedDesc: "Ti stiamo portando al dashboard…",
    telegramDesc: "Connetti il bot Telegram per ricevere e rispondere automaticamente ai messaggi.",
    whatsappDesc: "Connetti WhatsApp Business API per automatizzare le conversazioni.",
    slackDesc: "Aggiungi il bot Slack ai canali e rispondi ai messaggi nel tuo workspace.",
    botTokenLabel: "Bot Token",
    apiTokenLabel: "API Token",
    phoneIdLabel: "Phone Number ID",
  },
  langSwitcher: "Lingua",
  seo: {
    ...en.seo,
    homeTitle: "OpenClaw Cloud — Il tuo assistente AI personale, gestito",
    homeDesc:
      "Esegui il tuo assistente AI OpenClaw su WhatsApp, Telegram, Discord e oltre 20 piattaforme. Nessun server, nessun setup.",
    pricingTitle: "Prezzi — OpenClaw Cloud",
    pricingDesc:
      "Prezzi semplici e trasparenti per OpenClaw Cloud. Scegli il piano giusto e inizia subito.",
    blogTitle: "Blog — Guide, Confronti e Consigli | OpenClaw Cloud",
    blogDesc:
      "Tutto quello che devi sapere su OpenClaw, openclawd, ClawdBot, MoltBot e assistenti AI personali.",
    dashboardTitle: "Dashboard — OpenClaw Cloud",
    dashboardDesc:
      "Gestisci il tuo assistente AI OpenClaw, controlla l'abbonamento e accedi al tuo workspace AI personale.",
    signupTitle: "Inizia — OpenClaw Cloud",
    signupDesc:
      "Crea il tuo account OpenClaw Cloud e avvia il tuo assistente AI personale in pochi minuti.",
  },
} as const;

export default it;
