export interface BlogPost {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  publishedAt: string;
  readingTime: string;
  category: string;
  excerpt: string;
  content: BlogSection[];
  relatedSlugs: string[];
  keywords: string[];
}

export interface BlogSection {
  type: "h2" | "h3" | "p" | "ul" | "ol" | "callout" | "table" | "faq";
  heading?: string;
  content?: string;
  items?: string[];
  rows?: { cells: string[] }[];
  headers?: string[];
  faqs?: { q: string; a: string }[];
  faqTitle?: string;
}

export const blogPosts: BlogPost[] = [
  {
    slug: "what-is-openclaw",
    title: "What is OpenClaw? The Open-Source Personal AI Assistant You Actually Own",
    metaTitle: "What is OpenClaw? Open-Source Personal AI Assistant | OpenClaw Cloud",
    metaDescription:
      "OpenClaw is a free, open-source personal AI assistant that runs on any device, connects to WhatsApp, Telegram, Discord, and 20+ platforms. Learn everything about OpenClaw in 2025.",
    publishedAt: "2025-03-01",
    readingTime: "9 min read",
    category: "Guides",
    excerpt:
      "OpenClaw is the open-source personal AI assistant that gives you full control over your data, your channels, and your AI model — without subscription lock-in.",
    keywords: ["openclaw", "openclaw ai", "open source ai assistant", "personal ai assistant", "self-hosted ai"],
    relatedSlugs: ["what-is-openclawd", "openclaw-integrations", "setup-openclaw-beginners"],
    content: [
      {
        type: "p",
        content:
          "OpenClaw is a free, open-source personal AI assistant designed to run anywhere — on your laptop, VPS, Raspberry Pi, or in the cloud. Unlike proprietary AI assistants such as ChatGPT or Google Gemini, OpenClaw is a self-hosted solution: you control the data, you choose the AI model, and nobody else has access to your conversations.",
      },
      {
        type: "p",
        content:
          "The name comes from the iconic claws of a lobster — a symbol of strength, adaptability, and the ability to grab information from any direction. The OpenClaw mascot is a lobster, and the community rallying cry is 'EXFOLIATE! EXFOLIATE!' — a reference to how lobsters shed their shells to grow. In the same way, OpenClaw helps you break free from closed AI ecosystems and grow your own AI infrastructure.",
      },
      {
        type: "h2",
        heading: "What Does OpenClaw Actually Do?",
        content:
          "At its core, OpenClaw is a gateway between you and your AI model. It sits on a server (or your computer), connects to the messaging platforms you already use, and lets you talk to your AI through any of them — without switching apps or going to a website.",
      },
      {
        type: "ul",
        items: [
          "Connects to WhatsApp, Telegram, Discord, Slack, iMessage, Signal, and 20+ other platforms",
          "Works with any AI model: Claude (Anthropic), GPT-4 (OpenAI), Gemini, Mistral, and local models via Ollama",
          "Runs in the background as a persistent daemon (openclawd) — always ready, never sleeping",
          "Supports voice and talk mode via iOS, Android, and macOS native apps",
          "Includes a full CLI wizard for setting up workspaces, channels, and skills",
          "Extensible via a Skills platform — add new capabilities like web search, code execution, and more",
          "Supports cron jobs, webhooks, and Gmail Pub/Sub for powerful automations",
        ],
      },
      {
        type: "h2",
        heading: "Why Do People Choose OpenClaw Over ChatGPT or Claude?",
        content:
          "The most common reason is privacy. When you use ChatGPT or Claude directly, your conversations are sent to OpenAI's or Anthropic's servers. OpenClaw is different — it runs on infrastructure you control, and your messages never touch a third-party server (unless you choose to use a cloud AI model, in which case only the AI query goes to that provider, not your entire conversation history).",
      },
      {
        type: "p",
        content:
          "The second reason is platform freedom. You can talk to your OpenClaw assistant on WhatsApp, Telegram, Discord — wherever you already spend your time. There's no need to open yet another app. Your AI lives in your existing communication stack.",
      },
      {
        type: "p",
        content:
          "The third reason is extensibility. OpenClaw has a Skills platform that lets you extend your assistant with new capabilities. Want your AI to check your calendar, run shell commands, or search the web? There's a skill for that — or you can write your own.",
      },
      {
        type: "h2",
        heading: "OpenClaw Architecture: How It Works",
        content:
          "OpenClaw is built around a central Gateway that handles connections to messaging platforms and routes messages to the AI model. The gateway runs as a background daemon called openclawd. On top of the gateway, OpenClaw provides a control UI and a CLI wizard for configuration.",
      },
      {
        type: "ol",
        items: [
          "You send a message on WhatsApp, Telegram, or Discord",
          "The message arrives at your OpenClaw Gateway via the platform's API",
          "OpenClaw processes the message, applies any active Skills, and sends it to your chosen AI model",
          "The AI model's response is returned to OpenClaw",
          "OpenClaw sends the response back to you on the same platform you used",
        ],
      },
      {
        type: "h2",
        heading: "OpenClaw vs ClawdBot vs MoltBot: What's the Difference?",
        content:
          "OpenClaw is the core open-source project. ClawdBot is the name often used for the bot instances that OpenClaw creates in platforms like Discord — it's the 'face' of your assistant on that platform. MoltBot is a related project in the self-hosted AI ecosystem that takes a slightly different approach to multi-platform AI deployment.",
      },
      {
        type: "p",
        content:
          "Think of it this way: OpenClaw is the engine, ClawdBot is how the engine appears in Discord, and MoltBot is a competing engine with different design principles. We cover this comparison in depth in our MoltBot vs OpenClaw article.",
      },
      {
        type: "h2",
        heading: "The OpenClaw Cloud: OpenClaw Without the Setup",
        content:
          "While OpenClaw is free to self-host, setting it up requires technical knowledge: you need a server, the right Node.js version, Docker (sometimes), and about four hours of troubleshooting if something goes wrong. OpenClaw Cloud solves this by hosting the entire OpenClaw stack for you. You get your own isolated OpenClaw instance, connected to Claude, ready to pair with your messaging platforms — in about two minutes.",
      },
      {
        type: "callout",
        content:
          "OpenClaw Cloud includes a hosted openclawd daemon, persistent memory, all 20+ channel integrations, and priority AI model routing. Starting at $49/month, it's the fastest way to get your personal AI assistant running without touching the command line.",
      },
      {
        type: "h2",
        heading: "Frequently Asked Questions About OpenClaw",
      },
      {
        type: "faq",
        faqs: [
          {
            q: "Is OpenClaw free?",
            a: "Yes, OpenClaw is 100% free and open-source. You can self-host it on any server at no cost. OpenClaw Cloud is a paid service that removes the need to manage your own server.",
          },
          {
            q: "What AI models does OpenClaw support?",
            a: "OpenClaw supports Claude (Anthropic), GPT-4o and GPT-4 (OpenAI), Gemini (Google), Mistral, and any model running locally via Ollama. You can switch models at any time.",
          },
          {
            q: "Can OpenClaw run on a Raspberry Pi?",
            a: "Yes, OpenClaw is lightweight enough to run on a Raspberry Pi 4 or newer. For AI model calls, it connects to a remote API, so the Pi only needs to handle routing logic.",
          },
          {
            q: "Does OpenClaw support voice?",
            a: "Yes, OpenClaw has native voice and talk mode support via iOS, Android, and macOS apps. You can speak to your assistant directly.",
          },
          {
            q: "What is the difference between OpenClaw and openclawd?",
            a: "OpenClaw is the full project. Openclawd is the background daemon process that keeps the gateway running. Think of openclawd as the always-on background service that OpenClaw runs on.",
          },
        ],
      },
    ],
  },

  {
    slug: "what-is-openclawd",
    title: "What is OpenClawd? Understanding the Daemon That Powers OpenClaw",
    metaTitle: "What is OpenClawd? The OpenClaw Daemon Explained | OpenClaw Cloud",
    metaDescription:
      "OpenClawd is the background daemon that keeps your OpenClaw AI gateway running 24/7. Learn what openclawd does, how it works, and how to manage it on any system.",
    publishedAt: "2025-03-05",
    readingTime: "7 min read",
    category: "Technical",
    excerpt:
      "Openclawd is the persistent background process at the heart of OpenClaw — learn how this daemon architecture makes your AI available 24/7 on every platform.",
    keywords: ["openclawd", "openclaw daemon", "openclaw gateway", "openclaw background service"],
    relatedSlugs: ["what-is-openclaw", "setup-openclaw-beginners", "openclaw-integrations"],
    content: [
      {
        type: "p",
        content:
          "If you've used or researched OpenClaw, you've probably come across the term 'openclawd'. The 'd' stands for daemon — a background process that runs silently on your server or computer, always ready to receive and respond to messages, even when you're not actively using your computer.",
      },
      {
        type: "p",
        content:
          "Openclawd is to OpenClaw what nginx is to a website — it's the always-running service layer that makes everything else possible. Without openclawd, OpenClaw would only work when you manually start it. With openclawd, your AI assistant is always online, always connected, and always ready to respond.",
      },
      {
        type: "h2",
        heading: "What Does Openclawd Do?",
        content:
          "Openclawd maintains persistent connections to all of your configured messaging platforms (WhatsApp, Telegram, Discord, Slack, etc.) and routes incoming messages to your AI model. It handles:",
      },
      {
        type: "ul",
        items: [
          "Persistent WebSocket connections to messaging platform APIs",
          "Message queuing when the AI model is slow to respond",
          "Session management — keeping track of conversation context across multiple users",
          "Auto-reconnection when network connections drop",
          "Health monitoring — restarting failed connections automatically",
          "Workspace isolation — keeping multiple user agents separated",
          "Config hot-reloading — applying changes without restarting the daemon",
        ],
      },
      {
        type: "h2",
        heading: "How Openclawd Differs from the OpenClaw CLI",
        content:
          "OpenClaw ships with two main components: the CLI wizard (used for setup and configuration) and openclawd (the runtime daemon). The CLI is used interactively — you run it to configure channels, add skills, or check status. Openclawd runs in the background and handles the actual message processing.",
      },
      {
        type: "p",
        content:
          "When you run 'openclaw onboard', the CLI sets up your workspace and configures your channels. When you run 'openclawd start', the daemon process begins and takes over from there — maintaining your connections and routing your messages 24/7.",
      },
      {
        type: "h2",
        heading: "Openclawd Architecture: WebSockets and the Gateway",
        content:
          "Openclawd listens on a local WebSocket port (default: 18789) that acts as the communication backbone between the OpenClaw control UI, the messaging platform adapters, and the AI model. This WebSocket-based architecture allows the control UI to display real-time status updates and lets multiple platform adapters share a single AI connection.",
      },
      {
        type: "h2",
        heading: "Managing Openclawd: Start, Stop, Restart",
        content:
          "On a standard Linux server, openclawd can be managed as a systemd service. The OpenClaw CLI provides shortcut commands for common operations:",
      },
      {
        type: "ul",
        items: [
          "openclawd start — starts the daemon in the background",
          "openclawd stop — gracefully stops the daemon, closing all connections",
          "openclawd restart — restarts the daemon, applying any config changes",
          "openclawd status — shows the current state of all connections",
          "openclawd logs — streams live log output from the daemon",
        ],
      },
      {
        type: "h2",
        heading: "Openclawd on OpenClaw Cloud",
        content:
          "When you use OpenClaw Cloud, you get a managed openclawd instance running on cloud infrastructure. You never have to start, stop, or troubleshoot the daemon — it's always running, always monitored, and automatically restarted if it ever fails. Each user gets their own isolated openclawd workspace, so your conversations and configuration stay completely separate from other users.",
      },
      {
        type: "callout",
        content:
          "OpenClaw Cloud runs your openclawd daemon 24/7 on managed infrastructure. No server required, no configuration headaches, no 3am 'my bot went offline' moments. Just a personal AI that's always there when you need it.",
      },
      {
        type: "faq",
        faqs: [
          {
            q: "What port does openclawd use?",
            a: "Openclawd listens on WebSocket port 18789 by default. This can be configured in your openclaw.config.yaml file.",
          },
          {
            q: "Can openclawd run as a systemd service?",
            a: "Yes, the OpenClaw CLI includes a command to install openclawd as a systemd service on Linux: 'openclaw install-service'. This ensures openclawd starts automatically on boot.",
          },
          {
            q: "Does openclawd support multiple users?",
            a: "Yes, openclawd supports per-user agent workspaces. Each user gets their own isolated context, conversation history, and configuration.",
          },
          {
            q: "How much RAM does openclawd use?",
            a: "Openclawd typically uses between 50-150MB of RAM depending on the number of active connections and conversation history size. It's lightweight enough to run on a Raspberry Pi.",
          },
        ],
      },
    ],
  },

  {
    slug: "clawdbot-guide",
    title: "ClawdBot: The AI Bot for Discord, Telegram & WhatsApp Powered by OpenClaw",
    metaTitle: "ClawdBot Guide: AI Bot for Discord & Telegram | OpenClaw Cloud",
    metaDescription:
      "ClawdBot is the bot identity that OpenClaw creates on Discord, Telegram, and WhatsApp. Learn how ClawdBot works, how to set it up, and what makes it different from other AI bots.",
    publishedAt: "2025-03-08",
    readingTime: "8 min read",
    category: "Guides",
    excerpt:
      "ClawdBot is your personal AI bot, powered by OpenClaw, that lives inside Discord, Telegram, WhatsApp, and more. Here's everything you need to know about setting it up.",
    keywords: ["clawdbot", "clawdbot discord", "clawdbot telegram", "openclaw bot", "ai discord bot"],
    relatedSlugs: ["what-is-openclaw", "openclaw-integrations", "moltbot-vs-openclaw"],
    content: [
      {
        type: "p",
        content:
          "When you install OpenClaw and connect it to Discord, Telegram, or WhatsApp, the bot that appears on those platforms is commonly called ClawdBot. The name combines 'claw' (from OpenClaw) with 'bot' — and it has become the informal name for the bot identity that OpenClaw creates on messaging platforms.",
      },
      {
        type: "p",
        content:
          "ClawdBot isn't a separate product — it's OpenClaw's presence on your chosen platforms. When you message @ClawdBot on Discord or send a WhatsApp message to your bot number, you're talking to your personal OpenClaw instance through that platform's interface.",
      },
      {
        type: "h2",
        heading: "What Can ClawdBot Do?",
        content:
          "Because ClawdBot is powered by OpenClaw, it inherits the full capabilities of the OpenClaw platform — including your choice of AI model, your configured Skills, and your automations. On Discord specifically, ClawdBot supports:",
      },
      {
        type: "ul",
        items: [
          "Direct message conversations with context persistence across sessions",
          "Slash commands for quick actions (e.g., /summarize, /search, /remind)",
          "Server-wide integration — ClawdBot can be invited to multiple Discord servers",
          "Voice channel support (with Talk Mode enabled)",
          "Role-based access — restrict ClawdBot to specific channels or roles",
          "Thread support — ClawdBot can respond in threads to keep conversations organized",
          "File and image understanding (with vision-capable models)",
        ],
      },
      {
        type: "h2",
        heading: "ClawdBot on Telegram",
        content:
          "Telegram is arguably the best platform for ClawdBot. Telegram's Bot API is robust, fast, and supports rich message formatting. With OpenClaw's Telegram integration, your ClawdBot can:",
      },
      {
        type: "ul",
        items: [
          "Respond to direct messages and group chat mentions",
          "Send formatted responses with Markdown and HTML",
          "Use Telegram's inline keyboard buttons for interactive menus",
          "Handle voice messages (transcription via Whisper)",
          "Process photos and documents sent by users",
          "Send scheduled messages and reminders",
        ],
      },
      {
        type: "h2",
        heading: "ClawdBot on WhatsApp",
        content:
          "WhatsApp integration works through the WhatsApp Business API or a WhatsApp-compatible connection library. Your ClawdBot on WhatsApp operates just like a regular WhatsApp contact — you send it a message and it responds. This is particularly useful because WhatsApp is the most widely used messaging platform globally, meaning you can access your AI assistant from almost any smartphone.",
      },
      {
        type: "h2",
        heading: "Setting Up ClawdBot",
        content:
          "To set up ClawdBot on any platform, you need to have OpenClaw installed and running. The setup process through the OpenClaw CLI wizard takes about 5-10 minutes per platform:",
      },
      {
        type: "ol",
        items: [
          "Run 'openclaw onboard' to start the setup wizard",
          "Select which platform you want to connect (Discord, Telegram, WhatsApp, etc.)",
          "Follow the platform-specific instructions (creating a bot token, scanning a QR code, etc.)",
          "The wizard configures openclawd to maintain the connection automatically",
          "Your ClawdBot is now live on the platform",
        ],
      },
      {
        type: "h2",
        heading: "ClawdBot vs Other AI Discord Bots",
        content:
          "There are dozens of AI Discord bots — Midjourney, ChatGPT bots, Poe bots, and more. What makes ClawdBot different is that it's yours. When you use a public AI bot on Discord, your messages go to that service's servers, subject to their privacy policy and usage limits. ClawdBot runs on your own OpenClaw instance — your messages only go to the AI model you chose, nothing else.",
      },
      {
        type: "table",
        headers: ["Feature", "ClawdBot (OpenClaw)", "Public AI Bots"],
        rows: [
          { cells: ["Data Privacy", "Your server only", "Third-party servers"] },
          { cells: ["AI Model Choice", "Claude, GPT-4, Gemini, Mistral", "Fixed model"] },
          { cells: ["Rate Limits", "Your API limits", "Shared limits"] },
          { cells: ["Custom Skills", "Yes, fully extensible", "No"] },
          { cells: ["Automations", "Cron, webhooks, Pub/Sub", "Limited or none"] },
          { cells: ["Cost", "Self-hosted: free + API costs", "Subscription or pay-per-use"] },
        ],
      },
      {
        type: "callout",
        content:
          "Don't want to self-host ClawdBot? OpenClaw Cloud gives you a fully managed ClawdBot for Discord, Telegram, and WhatsApp — with all integrations pre-configured. Connect your platforms in one click, no server required.",
      },
      {
        type: "faq",
        faqs: [
          {
            q: "Is ClawdBot a separate download from OpenClaw?",
            a: "No. ClawdBot is just the name for your OpenClaw instance's bot identity on platforms like Discord. There's nothing separate to download — it's all part of OpenClaw.",
          },
          {
            q: "Can I name my ClawdBot something different?",
            a: "Yes, you can name your bot anything you like when you create the bot application on Discord or Telegram. ClawdBot is just the popular informal name used by the community.",
          },
          {
            q: "Can ClawdBot respond to multiple users on the same Discord server?",
            a: "Yes, ClawdBot handles multiple concurrent users. Each user gets their own conversation context, so conversations don't bleed into each other.",
          },
          {
            q: "Does ClawdBot support image generation?",
            a: "OpenClaw can be extended with image generation skills. The core ClawdBot doesn't generate images by default, but you can add this capability via the Skills platform.",
          },
        ],
      },
    ],
  },

  {
    slug: "moltbot-vs-openclaw",
    title: "MoltBot vs OpenClaw: Which Self-Hosted AI Assistant is Right for You?",
    metaTitle: "MoltBot vs OpenClaw 2025: Full Comparison | OpenClaw Cloud",
    metaDescription:
      "MoltBot and OpenClaw are both open-source self-hosted AI assistants. Compare features, setup complexity, platform support, and community size to choose the right one for your needs.",
    publishedAt: "2025-03-10",
    readingTime: "10 min read",
    category: "Comparisons",
    excerpt:
      "Both MoltBot and OpenClaw aim to give you a personal AI assistant you fully control. We compare them head-to-head across features, ease of use, and platform support.",
    keywords: ["moltbot", "moltbot vs openclaw", "openclaw vs moltbot", "self-hosted ai comparison", "moltbot setup"],
    relatedSlugs: ["what-is-openclaw", "clawdbot-guide", "self-hosted-ai-2025"],
    content: [
      {
        type: "p",
        content:
          "As self-hosted AI assistants have grown in popularity, two projects have consistently appeared in comparisons: OpenClaw and MoltBot. Both are open-source, both aim to give you a personal AI assistant you fully control, and both have active communities. But they take meaningfully different approaches — and the right choice depends on your priorities.",
      },
      {
        type: "p",
        content:
          "The name MoltBot, like OpenClaw, draws from the lobster metaphor — molting is the process by which a lobster sheds its old shell to grow a larger one. MoltBot positions itself as a project about growth and renewal in AI assistants. OpenClaw, by contrast, emphasizes the 'grabbing' metaphor — connecting to every platform and pulling information from any direction.",
      },
      {
        type: "h2",
        heading: "Feature Comparison: MoltBot vs OpenClaw",
      },
      {
        type: "table",
        headers: ["Feature", "OpenClaw", "MoltBot"],
        rows: [
          { cells: ["Supported Platforms", "20+ (WhatsApp, Telegram, Discord, Slack, iMessage, Signal, Email, and more)", "8 (Telegram, Discord, Slack, Email, Matrix, IRC, Mastodon, XMPP)"] },
          { cells: ["AI Model Support", "Claude, GPT-4o, Gemini, Mistral, Ollama (local)", "GPT-4o, Ollama (local), Groq"] },
          { cells: ["Voice Mode", "Yes — iOS, Android, macOS apps", "Beta — Discord voice only"] },
          { cells: ["Skills/Plugins", "Full Skills platform with 30+ built-in skills", "Plugin system with ~12 community plugins"] },
          { cells: ["Automations", "Cron, webhooks, Gmail Pub/Sub", "Cron only"] },
          { cells: ["Control UI", "Full web-based control UI", "CLI only"] },
          { cells: ["Multi-user", "Yes — per-user isolated workspaces", "Yes — single workspace shared"] },
          { cells: ["Memory", "Persistent per-user memory", "Session memory only (no persistence)"] },
          { cells: ["Setup Difficulty", "Moderate (CLI wizard + 20-40 min)", "Moderate (manual config + 30-60 min)"] },
          { cells: ["Cloud Hosted Version", "Yes — OpenClaw Cloud", "No"] },
          { cells: ["License", "MIT", "AGPL-3.0"] },
          { cells: ["GitHub Stars", "8.2k+", "3.1k+"] },
        ],
      },
      {
        type: "h2",
        heading: "When to Choose OpenClaw",
        content:
          "OpenClaw is the better choice if you need maximum platform coverage. If you want your AI on WhatsApp, iMessage, Discord, Telegram, Slack, and Signal — all at the same time — OpenClaw's 20+ integrations make that possible. MoltBot covers fewer platforms.",
      },
      {
        type: "p",
        content:
          "OpenClaw also wins if you want a persistent memory system. Your OpenClaw instance remembers conversation context across sessions, which makes it behave more like a true personal assistant. MoltBot currently only maintains context within a single session — restart the bot and the context is gone.",
      },
      {
        type: "p",
        content:
          "Finally, if you want a hosted version without managing infrastructure, OpenClaw Cloud is the only managed option between the two. MoltBot has no official cloud offering.",
      },
      {
        type: "h2",
        heading: "When to Choose MoltBot",
        content:
          "MoltBot might be the better choice if you're already running an XMPP or Matrix server and want AI integration there — these are platforms that OpenClaw doesn't currently support. MoltBot's AGPL license is also preferable if you're building a project that must remain open-source.",
      },
      {
        type: "p",
        content:
          "MoltBot's setup is also slightly more transparent for very technical users who prefer YAML configuration files over CLI wizards. If you're comfortable writing config files and don't need the OpenClaw CLI wizard, MoltBot's configuration style might feel more familiar.",
      },
      {
        type: "h2",
        heading: "ClawdBot and MoltBot: The Bot Names Explained",
        content:
          "A common source of confusion: 'ClawdBot' refers to the bot identity that OpenClaw creates on platforms like Discord, not a separate product. Similarly, 'MoltBot' is both the project name and the bot name on platforms. When someone says 'I'm running ClawdBot', they mean they have OpenClaw installed with a Discord/Telegram bot configured. When someone says 'I'm running MoltBot', they're using the MoltBot project.",
      },
      {
        type: "h2",
        heading: "Verdict: Which Should You Use in 2025?",
        content:
          "For most users, OpenClaw is the better choice in 2025. It has broader platform support, better AI model coverage (including Claude, which consistently outperforms GPT-4o on assistant tasks), persistent memory, and a hosted cloud version for those who don't want to manage infrastructure. MoltBot is a solid alternative if you specifically need Matrix/XMPP support or prefer AGPL licensing.",
      },
      {
        type: "callout",
        content:
          "Try OpenClaw without the setup headache. OpenClaw Cloud gives you a fully managed OpenClaw instance — connected to Claude, ready for all 20+ integrations — in about 2 minutes. No server required, no config files, no Docker.",
      },
      {
        type: "faq",
        faqs: [
          {
            q: "Can I run both MoltBot and OpenClaw at the same time?",
            a: "Technically yes, as they run independently. However, connecting both to the same Telegram or Discord account would cause conflicts, as only one bot can control a given bot token at a time.",
          },
          {
            q: "Is MoltBot free?",
            a: "Yes, MoltBot is free and open-source (AGPL-3.0). You need to pay for your own server and AI API costs.",
          },
          {
            q: "Does MoltBot support Claude?",
            a: "At the time of writing, MoltBot does not have official support for Anthropic Claude. OpenClaw supports Claude natively.",
          },
          {
            q: "Which has better community support?",
            a: "OpenClaw has a larger community (8.2k+ GitHub stars vs 3.1k+ for MoltBot) and a more active Discord server. Both have responsive maintainers.",
          },
        ],
      },
    ],
  },

  {
    slug: "openclaw-integrations",
    title: "OpenClaw Integrations: Connect WhatsApp, Telegram, Discord & 20+ Platforms to Your AI",
    metaTitle: "OpenClaw Integrations 2025: Full Platform List | OpenClaw Cloud",
    metaDescription:
      "OpenClaw supports 20+ messaging and productivity platform integrations including WhatsApp, Telegram, Discord, Slack, iMessage, Gmail, and more. Full integration guide for 2025.",
    publishedAt: "2025-03-12",
    readingTime: "8 min read",
    category: "Guides",
    excerpt:
      "OpenClaw connects your AI assistant to over 20 messaging platforms and productivity tools. Here's the complete guide to every integration and how to set each one up.",
    keywords: ["openclaw integrations", "openclaw whatsapp", "openclaw telegram", "openclaw discord", "openclaw slack"],
    relatedSlugs: ["what-is-openclaw", "clawdbot-guide", "setup-openclaw-beginners"],
    content: [
      {
        type: "p",
        content:
          "One of OpenClaw's most powerful features is its integrations system. Unlike AI assistants that live in a single app or website, OpenClaw meets you where you already are — on WhatsApp, Telegram, Discord, Slack, and 20+ other platforms. You configure each integration once, and your AI assistant is available across all of them simultaneously.",
      },
      {
        type: "h2",
        heading: "Messaging Platform Integrations",
        content:
          "These are the platforms where you can chat directly with your OpenClaw instance. Each integration maintains a persistent connection via openclawd and supports full conversation context.",
      },
      {
        type: "table",
        headers: ["Platform", "Support Level", "Key Features"],
        rows: [
          { cells: ["Telegram", "Full", "Commands, inline keyboards, voice messages, photos, groups"] },
          { cells: ["WhatsApp", "Full", "Direct messages, media support, business API compatible"] },
          { cells: ["Discord", "Full", "Slash commands, threads, voice, server-wide (ClawdBot)"] },
          { cells: ["Slack", "Full", "Slash commands, DMs, app mentions, blocks UI"] },
          { cells: ["iMessage", "macOS only", "Native Messages integration on macOS via Shortcuts"] },
          { cells: ["Signal", "Full", "Private messages, group chats"] },
          { cells: ["SMS", "Full", "Via Twilio — send/receive SMS with your AI"] },
          { cells: ["Email", "Full", "Gmail, Outlook via IMAP/SMTP"] },
          { cells: ["Matrix", "Beta", "Matrix protocol, compatible with Element"] },
          { cells: ["IRC", "Beta", "Classic IRC networks"] },
        ],
      },
      {
        type: "h2",
        heading: "Productivity & Automation Integrations",
        content:
          "Beyond messaging, OpenClaw integrates with productivity tools and automation platforms to give your AI real capabilities in your workflow.",
      },
      {
        type: "ul",
        items: [
          "Google Calendar — let your AI check, create, and update calendar events",
          "Gmail Pub/Sub — receive real-time notifications for new emails and have your AI summarize or respond",
          "Notion — read and write to your Notion databases from any messaging platform",
          "GitHub — get PR summaries, issue updates, and code reviews from your AI",
          "Zapier/Make — connect OpenClaw to any Zapier or Make automation via webhook",
          "Cron Jobs — schedule your AI to run tasks at specific times (e.g., daily briefings)",
        ],
      },
      {
        type: "h2",
        heading: "How to Set Up OpenClaw Integrations",
        content:
          "Each integration is configured through the OpenClaw CLI wizard or through the OpenClaw Cloud dashboard. The process for each platform typically takes 5-10 minutes and involves creating a bot token or OAuth connection.",
      },
      {
        type: "h3",
        heading: "Setting Up Telegram (ClawdBot on Telegram)",
        content:
          "Telegram is the fastest integration to set up. You create a bot via @BotFather, copy the bot token, and paste it into the OpenClaw wizard. Your OpenClaw instance connects immediately and your ClawdBot is live on Telegram within seconds.",
      },
      {
        type: "h3",
        heading: "Setting Up Discord (ClawdBot on Discord)",
        content:
          "Discord integration requires creating a bot application in the Discord Developer Portal, configuring the required bot permissions, and copying the bot token. The OpenClaw wizard guides you through each step. Once configured, you can invite your ClawdBot to any Discord server you manage.",
      },
      {
        type: "h3",
        heading: "Setting Up WhatsApp",
        content:
          "WhatsApp integration uses either the official WhatsApp Business API (for business accounts) or a WhatsApp-compatible library (for personal accounts). The setup is slightly more involved than Telegram or Discord but the wizard walks you through it step by step.",
      },
      {
        type: "h2",
        heading: "OpenClaw Integrations on OpenClaw Cloud",
        content:
          "If you're using OpenClaw Cloud, all 20+ integrations are pre-configured and available from your dashboard. You simply click to enable an integration, paste your bot token or complete an OAuth flow, and your AI is connected. No CLI required, no manual config file editing.",
      },
      {
        type: "callout",
        content:
          "OpenClaw Cloud includes all 20+ integrations out of the box. Connect WhatsApp, Telegram, Discord, and Slack to your personal AI in minutes — from a clean dashboard, no terminal required.",
      },
      {
        type: "faq",
        faqs: [
          {
            q: "Can OpenClaw be on multiple platforms at the same time?",
            a: "Yes, OpenClaw supports simultaneous connections to all configured platforms. Your AI assistant can receive and respond to messages on Telegram, Discord, and WhatsApp concurrently.",
          },
          {
            q: "Does OpenClaw support group chats on Telegram?",
            a: "Yes. You can add your OpenClaw Telegram bot to group chats. You can configure whether it responds to all messages or only when directly mentioned.",
          },
          {
            q: "Is WhatsApp integration against WhatsApp's ToS?",
            a: "Using the official WhatsApp Business API is fully compliant with WhatsApp's terms. Using unofficial libraries for personal accounts is technically against the ToS, though widely done. OpenClaw supports both approaches and lets you choose.",
          },
          {
            q: "Can I use OpenClaw with Zapier?",
            a: "Yes, via webhooks. OpenClaw supports incoming and outgoing webhooks, which work with Zapier, Make (Integromat), and similar automation platforms.",
          },
        ],
      },
    ],
  },

  {
    slug: "self-hosted-ai-2025",
    title: "Self-Hosted AI Assistants in 2025: OpenClaw, ClawdBot, MoltBot & OpenClawd Compared",
    metaTitle: "Best Self-Hosted AI Assistants 2025: OpenClaw, MoltBot, ClawdBot | OpenClaw Cloud",
    metaDescription:
      "Compare the best self-hosted AI assistants in 2025: OpenClaw, ClawdBot, MoltBot, and openclawd. Features, setup difficulty, platform support, and which to choose for your needs.",
    publishedAt: "2025-03-13",
    readingTime: "11 min read",
    category: "Comparisons",
    excerpt:
      "The self-hosted AI assistant ecosystem has grown rapidly. We compare OpenClaw, ClawdBot, MoltBot, and openclawd to help you choose the right tool in 2025.",
    keywords: ["self-hosted ai", "openclaw", "clawdbot", "moltbot", "openclawd", "personal ai assistant 2025"],
    relatedSlugs: ["moltbot-vs-openclaw", "what-is-openclaw", "what-is-openclawd"],
    content: [
      {
        type: "p",
        content:
          "The idea of a personal AI assistant you fully control — one that doesn't report to Google, OpenAI, or any other company — has moved from niche hobby project to serious software in 2025. Projects like OpenClaw, MoltBot, and ClawdBot have collectively attracted tens of thousands of users who want the power of AI without the privacy compromises.",
      },
      {
        type: "p",
        content:
          "In this guide, we'll break down the entire ecosystem: what each project is, how they relate to each other, and which combination makes sense for your specific situation.",
      },
      {
        type: "h2",
        heading: "The Self-Hosted AI Landscape in 2025",
        content:
          "Self-hosted AI assistants have become more viable in 2025 for a few reasons: AI APIs have become cheaper, models have become better, and the open-source tooling around them has matured significantly. What used to require a devoted ML engineer to set up can now be configured by a motivated non-developer in an afternoon — especially with tools like OpenClaw's CLI wizard.",
      },
      {
        type: "h2",
        heading: "OpenClaw: The Platform Leader",
        content:
          "OpenClaw is the most fully-featured self-hosted AI assistant in 2025. With 20+ platform integrations, a full Skills ecosystem, and a web-based control UI, it covers more ground than any competing project. The openclawd daemon architecture makes it reliable for 24/7 operation, and the OpenClaw Cloud option means you don't have to manage your own server if you don't want to.",
      },
      {
        type: "p",
        content:
          "Key strengths of OpenClaw: maximum platform coverage, best-in-class AI model support (including Anthropic Claude), persistent memory, and a hosted cloud option.",
      },
      {
        type: "h2",
        heading: "Openclawd: The Engine Room",
        content:
          "Openclawd is the background daemon that makes OpenClaw always-on. It's not a separate product — it's the runtime component of OpenClaw. When people say they're running 'openclawd', they mean they have OpenClaw installed and the daemon is actively managing their connections. Understanding openclawd is important for troubleshooting and performance tuning of your OpenClaw installation.",
      },
      {
        type: "h2",
        heading: "ClawdBot: OpenClaw's Bot Identity",
        content:
          "ClawdBot is the community name for the bot that appears on Discord, Telegram, and other platforms when you have OpenClaw configured. When you set up OpenClaw's Discord integration, you're setting up ClawdBot on Discord. The 'ClawdBot' identity has become so well known that many users now refer to their OpenClaw Discord integration specifically as 'ClawdBot'.",
      },
      {
        type: "h2",
        heading: "MoltBot: The Alternative",
        content:
          "MoltBot is a genuinely separate project that takes a different approach to self-hosted AI. It focuses on simplicity and minimalism — fewer integrations, but a configuration style that many developers find more intuitive. MoltBot supports Matrix and XMPP, which OpenClaw currently doesn't, making it the better choice for users in those ecosystems.",
      },
      {
        type: "h2",
        heading: "How They All Relate",
        content:
          "Here's a simple way to think about the ecosystem:",
      },
      {
        type: "ul",
        items: [
          "OpenClaw = the full platform (gateway + UI + CLI + Skills)",
          "Openclawd = the always-running daemon component within OpenClaw",
          "ClawdBot = the informal name for your OpenClaw bot on Discord/Telegram/WhatsApp",
          "MoltBot = a separate competing project with different design principles",
        ],
      },
      {
        type: "h2",
        heading: "Which Should You Use?",
        content:
          "The answer depends on your priorities. Here's a decision framework:",
      },
      {
        type: "table",
        headers: ["Your Priority", "Best Choice"],
        rows: [
          { cells: ["Maximum platform support", "OpenClaw"] },
          { cells: ["Claude AI model support", "OpenClaw"] },
          { cells: ["Persistent memory across sessions", "OpenClaw"] },
          { cells: ["Hosted cloud version (no server)", "OpenClaw Cloud"] },
          { cells: ["Matrix or XMPP support", "MoltBot"] },
          { cells: ["AGPL license requirement", "MoltBot"] },
          { cells: ["Minimal setup, minimal config", "MoltBot"] },
          { cells: ["Discord bot with slash commands", "OpenClaw (ClawdBot)"] },
          { cells: ["24/7 always-on assistant", "OpenClaw (openclawd)"] },
        ],
      },
      {
        type: "h2",
        heading: "The Self-Hosted AI Future",
        content:
          "The trend toward self-hosted AI is accelerating. As AI capabilities continue to improve and API costs continue to fall, the gap between hosted AI assistants (ChatGPT, Gemini) and self-hosted ones (OpenClaw, MoltBot) will narrow in functionality while the privacy advantage of self-hosted solutions remains. 2025 is arguably the best year yet to make the switch.",
      },
      {
        type: "callout",
        content:
          "Ready to try OpenClaw? Skip the setup entirely with OpenClaw Cloud — your personal AI assistant running on managed infrastructure, connected to all your platforms, in about two minutes.",
      },
    ],
  },

  {
    slug: "setup-openclaw-beginners",
    title: "How to Set Up OpenClaw Without Being a Developer: The Beginner's Guide",
    metaTitle: "OpenClaw Setup Guide for Beginners 2025 | OpenClaw Cloud",
    metaDescription:
      "Step-by-step guide to setting up OpenClaw for non-developers. Learn how to get your personal AI assistant running on WhatsApp, Telegram, and Discord — or skip setup entirely with OpenClaw Cloud.",
    publishedAt: "2025-03-14",
    readingTime: "9 min read",
    category: "Guides",
    excerpt:
      "Setting up OpenClaw yourself is possible, but it takes time. Here's the honest beginner's guide — including when to use OpenClaw Cloud instead.",
    keywords: ["openclaw setup", "openclaw install", "openclaw tutorial", "openclaw beginners guide", "openclaw cloud"],
    relatedSlugs: ["what-is-openclaw", "openclaw-integrations", "what-is-openclawd"],
    content: [
      {
        type: "p",
        content:
          "Let's be honest: setting up OpenClaw yourself is not trivial. It requires a server (or a computer that stays on), Node.js, some command-line comfort, and about 30-60 minutes if everything goes well. If something goes wrong — a port conflict, a dependency version mismatch, a firewall issue — it can take longer.",
      },
      {
        type: "p",
        content:
          "This guide gives you two paths. First, we'll walk through the full self-hosted setup for those who want to own every part of the stack. Then we'll cover OpenClaw Cloud for those who just want their assistant running as quickly as possible.",
      },
      {
        type: "h2",
        heading: "Path 1: Self-Hosted OpenClaw",
        content:
          "To self-host OpenClaw, you need:",
      },
      {
        type: "ul",
        items: [
          "A server or computer that stays on 24/7 (VPS, Raspberry Pi, old laptop, etc.)",
          "Node.js 20 or newer",
          "npm or pnpm package manager",
          "An AI API key (Anthropic, OpenAI, or similar)",
          "Bot tokens for the platforms you want to connect",
          "~1 hour of time and some patience",
        ],
      },
      {
        type: "h3",
        heading: "Step 1: Get a Server",
        content:
          "If you don't already have a server, the cheapest option is a $5-6/month VPS from providers like DigitalOcean, Vultr, or Hetzner. Choose Ubuntu 22.04 LTS as your operating system. If you want to run OpenClaw on your own computer, make sure it stays on and connected — OpenClaw needs to be running continuously for your bot to respond to messages.",
      },
      {
        type: "h3",
        heading: "Step 2: Install Node.js",
        content:
          "Connect to your server via SSH and install Node.js 20 using nvm (Node Version Manager). This is the most reliable way to get the right Node.js version without package manager conflicts:",
      },
      {
        type: "ul",
        items: [
          "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash",
          "source ~/.bashrc",
          "nvm install 20",
          "nvm use 20",
        ],
      },
      {
        type: "h3",
        heading: "Step 3: Install OpenClaw",
        content:
          "Once Node.js is installed, install OpenClaw globally via npm:",
      },
      {
        type: "ul",
        items: [
          "npm install -g openclaw",
          "openclaw --version (confirm the installation worked)",
        ],
      },
      {
        type: "h3",
        heading: "Step 4: Run the Setup Wizard",
        content:
          "OpenClaw's onboarding wizard walks you through the setup process. It will ask for your AI API key, help you configure your first platform integration, and set up openclawd to run in the background:",
      },
      {
        type: "ul",
        items: [
          "openclaw onboard",
          "Follow the prompts to enter your Anthropic or OpenAI API key",
          "Select which platform to connect first (Telegram is easiest)",
          "Follow the platform-specific instructions to create a bot token",
          "The wizard configures openclawd and starts it automatically",
        ],
      },
      {
        type: "h3",
        heading: "Step 5: Install Openclawd as a System Service",
        content:
          "To make openclawd start automatically when your server reboots, install it as a systemd service:",
      },
      {
        type: "ul",
        items: [
          "openclaw install-service",
          "systemctl status openclawd (confirm it's running)",
        ],
      },
      {
        type: "h2",
        heading: "Common Problems When Setting Up OpenClaw",
        content:
          "Here are the most common issues people run into and how to fix them:",
      },
      {
        type: "table",
        headers: ["Problem", "Solution"],
        rows: [
          { cells: ["Port 18789 already in use", "Kill the process using the port: lsof -i :18789, then kill <PID>"] },
          { cells: ["Node version too old", "Use nvm to install Node 20: nvm install 20 && nvm use 20"] },
          { cells: ["Bot doesn't respond on Telegram", "Check your bot token and ensure openclawd is running: openclawd status"] },
          { cells: ["Permission denied errors", "Run the installer with sudo or fix npm global permissions"] },
          { cells: ["OpenClaw crashes on startup", "Check logs: openclawd logs | tail -50 for the error message"] },
        ],
      },
      {
        type: "h2",
        heading: "Path 2: OpenClaw Cloud (Skip All of the Above)",
        content:
          "If Path 1 sounds like a lot — it is. OpenClaw Cloud removes every step above. There's no server to configure, no Node.js to install, no openclawd to manage. You sign up, get a pre-configured OpenClaw instance, and connect your platforms from a dashboard.",
      },
      {
        type: "ol",
        items: [
          "Go to openclaw.cloud and sign up",
          "Your OpenClaw instance is provisioned automatically",
          "Click to enable your first integration (Telegram, Discord, WhatsApp, etc.)",
          "Paste your bot token or complete the OAuth flow",
          "Your AI assistant is live in under 2 minutes",
        ],
      },
      {
        type: "callout",
        content:
          "OpenClaw Cloud is $49/month and includes a fully managed openclawd daemon, all 20+ integrations, Claude AI model access, and persistent memory. It's the fastest way to get your personal AI assistant running — and you never have to touch the command line.",
      },
      {
        type: "faq",
        faqs: [
          {
            q: "Can I migrate from self-hosted OpenClaw to OpenClaw Cloud?",
            a: "Yes. Your conversation history and configuration can be exported from your self-hosted instance and imported into OpenClaw Cloud. Contact support for migration assistance.",
          },
          {
            q: "Do I need to bring my own AI API key for OpenClaw Cloud?",
            a: "OpenClaw Cloud includes access to Claude by default. You can optionally connect your own Anthropic or OpenAI API key (BYOK — Bring Your Own Key) if you prefer.",
          },
          {
            q: "What happens if my self-hosted server goes down?",
            a: "If your server goes down, openclawd stops and your bot goes offline until the server comes back up. OpenClaw Cloud handles uptime monitoring and automatic restarts, so your assistant stays online even during infrastructure issues.",
          },
          {
            q: "Is OpenClaw Cloud GDPR compliant?",
            a: "OpenClaw Cloud stores minimal user data and all AI model calls go directly to Anthropic. Full privacy and data processing details are in the privacy policy.",
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // NEW POSTS
  // ─────────────────────────────────────────────────────────────────────────

  {
    slug: "openclaw-discord-setup",
    title: "How to Set Up OpenClaw as a Discord Bot (Full 2025 Guide)",
    metaTitle: "OpenClaw Discord Bot Setup Guide 2025 | OpenClaw Cloud",
    metaDescription:
      "Step-by-step guide to connecting OpenClaw to Discord. Create a Discord bot, configure OpenClaw, and start chatting with your personal AI in any server or DM.",
    publishedAt: "2025-03-15",
    readingTime: "8 min read",
    category: "Guides",
    excerpt:
      "Connect your OpenClaw AI assistant to Discord in under 10 minutes. This guide covers bot creation, token setup, permissions, and advanced group chat configuration.",
    keywords: [
      "openclaw discord",
      "openclaw discord bot",
      "discord ai bot",
      "clawdbot discord",
      "discord ai assistant 2025",
      "self-hosted discord bot",
    ],
    relatedSlugs: ["what-is-openclaw", "openclaw-integrations", "openclaw-vs-chatgpt"],
    content: [
      {
        type: "p",
        content:
          "Discord is one of the most popular platforms for OpenClaw integrations. Whether you want a personal AI assistant in your DMs, a bot that helps your server members, or a private workspace where your team can chat with Claude — OpenClaw's Discord integration covers all of it. This guide walks you through every step.",
      },
      {
        type: "h2",
        heading: "Step 1: Create a Discord Application and Bot Token",
        content:
          "Before you can connect OpenClaw to Discord, you need a Discord bot token. Here's how to get one:",
      },
      {
        type: "ol",
        items: [
          "Go to https://discord.com/developers/applications and sign in with your Discord account",
          "Click 'New Application', give it a name (e.g. 'My OpenClaw Bot'), and click Create",
          "In the left sidebar, click 'Bot', then click 'Add Bot' and confirm",
          "Under 'Token', click 'Reset Token' and copy the token — you'll need this in OpenClaw",
          "Scroll down to 'Privileged Gateway Intents' and enable 'Message Content Intent'",
          "Click 'Save Changes'",
        ],
      },
      {
        type: "h2",
        heading: "Step 2: Invite the Bot to Your Server",
        content:
          "Your bot needs to be added to a Discord server before OpenClaw can receive messages from it.",
      },
      {
        type: "ol",
        items: [
          "In the Discord Developer Portal, click 'OAuth2' in the sidebar, then 'URL Generator'",
          "Under 'Scopes', check 'bot' and 'applications.commands'",
          "Under 'Bot Permissions', check: Send Messages, Read Message History, Add Reactions, Embed Links, Attach Files",
          "Copy the generated URL at the bottom and open it in your browser",
          "Select your server and click 'Authorize'",
        ],
      },
      {
        type: "h2",
        heading: "Step 3: Configure OpenClaw with Your Discord Token",
        content:
          "Now that you have your bot token and the bot is in your server, add it to OpenClaw. If you're using OpenClaw Cloud, go to your Dashboard → Channels → Discord and paste the token. If you're self-hosting, use the CLI wizard:",
      },
      {
        type: "ul",
        items: [
          "Run: openclaw channel add discord",
          "When prompted, paste your Discord bot token",
          "Select which type of access to enable: DMs only, servers only, or both",
          "Choose your DM policy: allow all users, allowlist only, or deny all",
          "The wizard will verify the token and connect automatically",
        ],
      },
      {
        type: "h3",
        heading: "OpenClaw Cloud: Even Simpler",
        content:
          "On OpenClaw Cloud, you skip the CLI entirely. Open your Dashboard, click 'Channels', select Discord, paste your bot token, and hit Connect. Your assistant is live in under 30 seconds.",
      },
      {
        type: "h2",
        heading: "Step 4: Talking to Your OpenClaw Discord Bot",
        content:
          "Once connected, you can interact with your bot in two ways:",
      },
      {
        type: "ul",
        items: [
          "Direct Message: Send a DM to your bot. It will respond privately, just like a chat.",
          "Server channel: In a server channel, mention the bot (@YourBotName) followed by your message. OpenClaw responds in the same channel.",
          "Thread mode: OpenClaw can be configured to respond in threaded replies to keep server channels clean.",
          "Slash commands: OpenClaw supports /ask, /clear, /status, and custom slash commands you define in your config.",
        ],
      },
      {
        type: "h2",
        heading: "Advanced Discord Configuration",
        content:
          "OpenClaw's Discord integration supports fine-grained control over how and where your bot responds:",
      },
      {
        type: "ul",
        items: [
          "Channel allowlist: Restrict which channels the bot is active in",
          "Role-based access: Only users with specific roles can use the bot",
          "Group DM support: The bot can participate in Discord group DMs",
          "Auto-reactions: React to messages with an emoji to confirm receipt before responding",
          "Response delay: Add a configurable typing indicator delay to seem more natural",
          "Max message length: Split long responses into multiple messages automatically",
        ],
      },
      {
        type: "callout",
        content:
          "OpenClaw Cloud includes Discord as a built-in channel. Sign up, paste your bot token in the dashboard, and your Discord AI assistant is live instantly — no CLI, no server management required.",
      },
      {
        type: "h2",
        heading: "Frequently Asked Questions: OpenClaw Discord",
      },
      {
        type: "faq",
        faqs: [
          {
            q: "Can I use OpenClaw in multiple Discord servers?",
            a: "Yes. You can invite your Discord bot to as many servers as you want. OpenClaw will respond in all of them. Each server can have separate channel allowlists if needed.",
          },
          {
            q: "What is ClawdBot?",
            a: "ClawdBot is the informal name the community uses for an OpenClaw-powered Discord bot. It's not a separate product — it's just what OpenClaw looks like when it's connected to Discord.",
          },
          {
            q: "Does OpenClaw remember conversations in Discord?",
            a: "Yes. OpenClaw maintains conversation context per user. In DMs, it remembers your conversation history. In server channels, context is tracked per user and per channel.",
          },
          {
            q: "Can other people use my Discord bot?",
            a: "Yes, if you invite the bot to a server, other server members can interact with it (subject to your DM and channel policy settings). On OpenClaw Cloud, only you control the AI config.",
          },
          {
            q: "What AI model does the Discord bot use?",
            a: "Your OpenClaw Discord bot uses whatever AI model you configure — Claude, GPT-4o, Gemini, or any Ollama-compatible local model.",
          },
        ],
      },
    ],
  },

  {
    slug: "openclaw-vs-chatgpt",
    title: "OpenClaw vs ChatGPT: Which AI Assistant Should You Use in 2025?",
    metaTitle: "OpenClaw vs ChatGPT 2025: Full Comparison | OpenClaw Cloud",
    metaDescription:
      "Comparing OpenClaw and ChatGPT in 2025. Privacy, platform integrations, model flexibility, pricing, and self-hosting. Which AI assistant fits your needs?",
    publishedAt: "2025-03-17",
    readingTime: "10 min read",
    category: "Comparisons",
    excerpt:
      "OpenClaw and ChatGPT both let you talk to AI — but they are fundamentally different products. This side-by-side comparison covers privacy, integrations, pricing, and who each one is for.",
    keywords: [
      "openclaw vs chatgpt",
      "chatgpt alternative",
      "self-hosted ai vs chatgpt",
      "openclaw chatgpt comparison",
      "private ai assistant",
      "open source chatgpt alternative 2025",
    ],
    relatedSlugs: ["what-is-openclaw", "moltbot-vs-openclaw", "self-hosted-ai-2025"],
    content: [
      {
        type: "p",
        content:
          "ChatGPT needs no introduction. It's the most widely used AI assistant in the world. OpenClaw is a very different product — open-source, self-hosted, platform-agnostic. So why would anyone choose OpenClaw over ChatGPT? The answer comes down to a few core priorities: privacy, platform freedom, and control.",
      },
      {
        type: "h2",
        heading: "The Fundamental Difference",
        content:
          "ChatGPT is a product. OpenClaw is infrastructure. ChatGPT is a single destination you go to on OpenAI's servers. OpenClaw is software you run on your own server that connects your favorite messaging apps to whatever AI model you choose.",
      },
      {
        type: "table",
        headers: ["Feature", "OpenClaw", "ChatGPT"],
        rows: [
          { cells: ["Hosting", "Self-hosted or OpenClaw Cloud", "OpenAI servers only"] },
          { cells: ["AI Models", "Claude, GPT-4o, Gemini, Ollama, more", "GPT-4o (OpenAI only)"] },
          { cells: ["Platforms", "WhatsApp, Telegram, Discord, Slack, iMessage, Signal…", "ChatGPT app, web, API"] },
          { cells: ["Privacy", "Conversations stay on your server", "Processed by OpenAI"] },
          { cells: ["Memory", "Persistent, customizable per user", "Limited (ChatGPT Plus only)"] },
          { cells: ["Voice", "Native iOS, Android, macOS apps", "ChatGPT Voice mode (Plus)"] },
          { cells: ["Custom skills", "Full Skills SDK", "Custom GPTs (Plus only)"] },
          { cells: ["Data export", "Full, any time", "Limited"] },
          { cells: ["Open source", "Yes (MIT)", "No"] },
          { cells: ["Free tier", "Yes (self-hosted)", "$0 plan with limits"] },
          { cells: ["Cloud pricing", "From $49/month", "From $20/month (Plus)"] },
        ],
      },
      {
        type: "h2",
        heading: "Privacy: The Biggest Reason to Choose OpenClaw",
        content:
          "When you send a message to ChatGPT, that message is processed on OpenAI's servers. OpenAI's privacy policy allows them to use your conversations to improve their models (unless you opt out). If you're discussing business plans, health issues, legal matters, or anything sensitive, this matters.",
      },
      {
        type: "p",
        content:
          "With OpenClaw running on your own server, your messages never leave your infrastructure. The only third-party data transfer is the AI model call — and if you use a local model via Ollama, even that stays on-device. For professionals and businesses with data compliance requirements (HIPAA, GDPR, SOC 2), this is non-negotiable.",
      },
      {
        type: "h2",
        heading: "Platform Flexibility: Talk to AI Wherever You Already Are",
        content:
          "ChatGPT lives in the ChatGPT app or on chat.openai.com. OpenClaw lives inside your existing communication stack. If you use WhatsApp to talk to clients, you can talk to your AI on WhatsApp. If your team lives in Discord, your AI assistant is in Discord. You don't need to switch apps.",
      },
      {
        type: "ul",
        items: [
          "WhatsApp: Text or voice messages to your AI, works on iOS and Android",
          "Telegram: Full bot integration with inline commands and inline keyboard support",
          "Discord: Server bot or DM assistant with slash command support",
          "Slack: Workspace assistant with channel and DM support",
          "iMessage: Native Apple Messages integration for Mac users",
          "Signal: Privacy-first messaging with Signal-cli bridge",
        ],
      },
      {
        type: "h2",
        heading: "AI Model Freedom: Not Locked to OpenAI",
        content:
          "ChatGPT uses GPT-4o. That's it. If you think Claude (Anthropic) gives better answers for your use case, or if you want to run Mistral locally for complete privacy, ChatGPT can't help you. OpenClaw can.",
      },
      {
        type: "p",
        content:
          "OpenClaw supports Claude 3.5, GPT-4o, Google Gemini, Mistral, Llama 3, and any model running via Ollama. You can switch models any time or run different models for different tasks — use a fast model for quick answers and a powerful model for deep research.",
      },
      {
        type: "h2",
        heading: "When Should You Choose ChatGPT Instead?",
        content:
          "OpenClaw isn't for everyone. ChatGPT is the better choice if:",
      },
      {
        type: "ul",
        items: [
          "You don't want to manage any infrastructure, even through a cloud service",
          "You primarily use the web browser or the official ChatGPT mobile app",
          "You want access to DALL·E image generation or GPT-4o Vision natively",
          "Your workflow is centered around OpenAI's Custom GPTs ecosystem",
          "You need the latest GPT features the moment they're released",
        ],
      },
      {
        type: "h2",
        heading: "When Should You Choose OpenClaw?",
      },
      {
        type: "ul",
        items: [
          "You want AI in WhatsApp, Telegram, Discord, or Slack — not a separate app",
          "Privacy is important: you don't want conversations processed by OpenAI",
          "You want to use Claude, Gemini, or local models — not just GPT",
          "You need persistent, structured memory across conversations",
          "You want a programmable assistant with custom skills and automations",
          "You're a developer, tech-savvy professional, or run a small team",
        ],
      },
      {
        type: "callout",
        content:
          "OpenClaw Cloud gives you the full OpenClaw experience — Claude AI, all 20+ platform integrations, persistent memory, and custom skills — without any server management. Try it from $49/month.",
      },
      {
        type: "h2",
        heading: "Frequently Asked Questions",
      },
      {
        type: "faq",
        faqs: [
          {
            q: "Is OpenClaw better than ChatGPT?",
            a: "It depends on your priorities. OpenClaw is better for privacy, platform flexibility, and model choice. ChatGPT is better for simplicity and access to OpenAI-exclusive features like DALL·E.",
          },
          {
            q: "Can OpenClaw use ChatGPT (GPT-4o)?",
            a: "Yes. OpenClaw supports GPT-4o and GPT-4 via the OpenAI API. You supply your own API key, and OpenClaw will route your messages through OpenAI's model.",
          },
          {
            q: "Is OpenClaw free like ChatGPT's free tier?",
            a: "The self-hosted version of OpenClaw is completely free. OpenClaw Cloud starts at $49/month, which is higher than ChatGPT Plus ($20/month) but includes your own isolated server instance.",
          },
          {
            q: "Does OpenClaw have image generation like ChatGPT?",
            a: "Not natively built-in, but you can add image generation via the Skills platform — e.g., a skill that calls the DALL·E or Stable Diffusion API.",
          },
          {
            q: "Does OpenClaw work on mobile?",
            a: "Yes. OpenClaw works on mobile through WhatsApp, Telegram, and Discord mobile apps. You don't need a dedicated OpenClaw app — it lives in the apps you already use.",
          },
        ],
      },
    ],
  },

  {
    slug: "openclaw-whatsapp-guide",
    title: "How to Connect OpenClaw to WhatsApp: AI in Your Chats (2025)",
    metaTitle: "OpenClaw WhatsApp Integration Guide 2025 | OpenClaw Cloud",
    metaDescription:
      "Connect your OpenClaw AI assistant to WhatsApp. Step-by-step guide for WhatsApp Web pairing, group chat setup, and running your own private WhatsApp AI bot.",
    publishedAt: "2025-03-19",
    readingTime: "7 min read",
    category: "Guides",
    excerpt:
      "OpenClaw's WhatsApp integration lets you chat with your AI directly in WhatsApp — text, voice, images, and documents. Here's how to set it up from scratch.",
    keywords: [
      "openclaw whatsapp",
      "whatsapp ai bot",
      "whatsapp ai assistant",
      "openclaw whatsapp setup",
      "self-hosted whatsapp ai",
      "whatsapp chatbot 2025",
    ],
    relatedSlugs: ["what-is-openclaw", "openclaw-discord-setup", "openclaw-integrations"],
    content: [
      {
        type: "p",
        content:
          "WhatsApp has over 2 billion users. It's how most people communicate with friends, family, and colleagues — especially outside the US. Connecting OpenClaw to WhatsApp means your AI assistant lives exactly where your conversations already happen. No switching apps, no browser tabs. Just type (or voice-message) your AI as you would a contact.",
      },
      {
        type: "h2",
        heading: "How OpenClaw Connects to WhatsApp",
        content:
          "OpenClaw uses the WhatsApp Web protocol (via Baileys — the same approach as many popular WhatsApp integrations) to connect your WhatsApp account to the OpenClaw gateway. This means no business API approval process and no per-message fees. You connect your personal WhatsApp account the same way you'd connect WhatsApp Web on a computer — by scanning a QR code.",
      },
      {
        type: "h2",
        heading: "Step-by-Step: Connecting WhatsApp to OpenClaw",
      },
      {
        type: "ol",
        items: [
          "In the OpenClaw CLI wizard, run: openclaw channel add whatsapp",
          "A QR code will appear in your terminal (or in the OpenClaw Cloud dashboard)",
          "Open WhatsApp on your phone → tap the three-dot menu → Linked Devices → Link a Device",
          "Scan the QR code with your phone's camera",
          "OpenClaw will confirm the connection and start listening for messages",
          "Send yourself a WhatsApp message from another number (or from WhatsApp Web) to test",
        ],
      },
      {
        type: "h3",
        heading: "On OpenClaw Cloud",
        content:
          "In your OpenClaw Cloud dashboard, go to Channels → WhatsApp → Connect. A QR code appears on screen. Scan it with your WhatsApp app and the connection is live. No CLI required.",
      },
      {
        type: "h2",
        heading: "What You Can Do With OpenClaw on WhatsApp",
        content:
          "Once connected, your OpenClaw assistant responds to messages you send to yourself (your own number) or in a dedicated WhatsApp group. Here's what it handles:",
      },
      {
        type: "ul",
        items: [
          "Text messages: Ask questions, get summaries, continue long conversations with full context",
          "Voice notes: Send a voice message, OpenClaw transcribes it and responds in text (or voice)",
          "Images: Send a photo and ask OpenClaw to describe or analyze it (requires a vision-capable model)",
          "Documents: Send a PDF and ask questions about its content",
          "Group chats: Add OpenClaw to a WhatsApp group; it responds when mentioned with @",
        ],
      },
      {
        type: "h2",
        heading: "Privacy and Session Persistence",
        content:
          "Your WhatsApp connection session is stored securely on your server (or OpenClaw Cloud). Once paired, OpenClaw maintains the session indefinitely — you don't need to re-scan the QR code after every restart. Sessions are encrypted and stored locally.",
      },
      {
        type: "p",
        content:
          "Because OpenClaw uses the WhatsApp Web protocol, your messages are end-to-end encrypted in transit on WhatsApp's network. When they arrive at OpenClaw, they're processed on your server — not a third-party service. The AI model call (e.g. to Anthropic for Claude) is the only external request.",
      },
      {
        type: "h2",
        heading: "Limitations of the WhatsApp Integration",
        content:
          "It's important to understand a few constraints:",
      },
      {
        type: "ul",
        items: [
          "One WhatsApp account per OpenClaw instance: Each account can only be linked to one device session",
          "WhatsApp's terms of service technically restrict automated messaging — use at your own discretion",
          "If WhatsApp detects unusual activity (very high message volume), your account may be temporarily flagged",
          "The WhatsApp Business API (for large-scale use) requires approval and costs money — OpenClaw uses the consumer protocol",
        ],
      },
      {
        type: "callout",
        content:
          "OpenClaw Cloud includes WhatsApp as a built-in channel. QR code pairing, session persistence, and automatic reconnection are all handled for you. Sign up and connect WhatsApp in 2 minutes.",
      },
      {
        type: "faq",
        faqs: [
          {
            q: "Can I use a dedicated phone number just for OpenClaw on WhatsApp?",
            a: "Yes, and this is actually recommended. Get a second SIM or a WhatsApp Business account on a secondary number and link that to OpenClaw, keeping your personal account separate.",
          },
          {
            q: "Will my WhatsApp contacts see that I'm using a bot?",
            a: "No. From the perspective of anyone messaging the WhatsApp number, it looks like a normal WhatsApp account. There's no bot indicator.",
          },
          {
            q: "Does OpenClaw work with WhatsApp Business?",
            a: "Yes, OpenClaw works with both personal WhatsApp accounts and WhatsApp Business accounts using the same QR pairing flow.",
          },
          {
            q: "What happens if OpenClaw goes offline?",
            a: "Messages sent while OpenClaw is offline are queued and delivered when the connection is restored (standard WhatsApp behavior). OpenClaw will process and respond to them when it reconnects.",
          },
        ],
      },
    ],
  },

  {
    slug: "openclaw-voice-mode",
    title: "OpenClaw Voice Mode: Talk to Your AI Assistant Out Loud",
    metaTitle: "OpenClaw Voice Mode Guide: Talk to AI by Voice | OpenClaw Cloud",
    metaDescription:
      "OpenClaw Voice Mode lets you speak to your AI assistant and hear responses out loud. Learn how to enable talk mode on iOS, Android, and macOS in 2025.",
    publishedAt: "2025-03-21",
    readingTime: "6 min read",
    category: "Guides",
    excerpt:
      "OpenClaw supports native voice input and text-to-speech responses on iOS, Android, and macOS. This guide shows you how to enable Talk Mode and get the most out of voice conversations.",
    keywords: [
      "openclaw voice mode",
      "openclaw talk mode",
      "voice ai assistant",
      "ai voice chat",
      "openclaw ios",
      "openclaw android",
      "speak to ai assistant",
    ],
    relatedSlugs: ["what-is-openclaw", "openclaw-whatsapp-guide", "openclaw-discord-setup"],
    content: [
      {
        type: "p",
        content:
          "Typing is fast — but sometimes you just want to talk. OpenClaw's Voice Mode (also called Talk Mode) lets you send voice messages to your AI assistant and receive spoken responses. It works across iOS, Android, and macOS, and integrates natively with WhatsApp and Telegram voice messages.",
      },
      {
        type: "h2",
        heading: "How OpenClaw Voice Mode Works",
        content:
          "OpenClaw voice conversations work in two directions: speech-to-text (STT) for your input, and text-to-speech (TTS) for the AI's response. When you send a voice note on WhatsApp or Telegram, OpenClaw automatically transcribes it, sends the text to your AI model, and can optionally respond with a generated voice message.",
      },
      {
        type: "h2",
        heading: "Voice Mode via WhatsApp and Telegram",
        content:
          "The easiest way to use voice with OpenClaw is through WhatsApp or Telegram voice notes:",
      },
      {
        type: "ol",
        items: [
          "Hold the microphone button in WhatsApp or Telegram to record a voice message",
          "Send it to your OpenClaw bot number (or the @bot in a Telegram chat)",
          "OpenClaw transcribes your voice using Whisper (OpenAI's speech model) or a local STT engine",
          "The text is sent to your AI model (Claude, GPT-4o, etc.)",
          "OpenClaw can respond in text, or generate a voice note reply using TTS",
        ],
      },
      {
        type: "h2",
        heading: "Native Talk Mode on iOS and macOS",
        content:
          "OpenClaw has a native Talk Mode feature for Apple devices. When enabled, you can use Siri Shortcuts or the OpenClaw companion app to speak directly to your assistant and receive spoken answers — without opening WhatsApp or Telegram at all.",
      },
      {
        type: "ul",
        items: [
          "iOS: Install the OpenClaw companion shortcut via Shortcuts app. Tap to speak, results are read aloud.",
          "macOS: Use the OpenClaw menu bar app — press a keyboard shortcut, speak, and the response is read by macOS TTS.",
          "Apple Watch: Trigger a voice query from your wrist and get a brief spoken response.",
          "Android: Use the Tasker integration or the OpenClaw for Android companion app for a similar experience.",
        ],
      },
      {
        type: "h2",
        heading: "Configuring TTS and STT Providers",
        content:
          "OpenClaw supports multiple speech engines, letting you choose the best one for your setup:",
      },
      {
        type: "table",
        headers: ["Provider", "Type", "Quality", "Privacy"],
        rows: [
          { cells: ["OpenAI Whisper", "STT", "Excellent", "Cloud — data sent to OpenAI"] },
          { cells: ["Whisper Local (Ollama)", "STT", "Very good", "On-device — fully private"] },
          { cells: ["ElevenLabs", "TTS", "Human-quality", "Cloud — requires API key"] },
          { cells: ["OpenAI TTS", "TTS", "Very good", "Cloud — requires API key"] },
          { cells: ["macOS built-in TTS", "TTS", "Good", "Fully on-device"] },
          { cells: ["Edge TTS (free)", "TTS", "Good", "Microsoft cloud, free"] },
        ],
      },
      {
        type: "h2",
        heading: "Voice Mode Privacy Considerations",
        content:
          "Voice input introduces an extra privacy consideration: your voice recordings may be processed by a cloud STT provider. For maximum privacy, use Whisper Local (via Ollama) for transcription and macOS or Edge TTS for responses — all audio processing stays on your device.",
      },
      {
        type: "callout",
        content:
          "OpenClaw Cloud includes voice mode out of the box. Send voice notes via WhatsApp or Telegram and get AI responses instantly — no configuration needed. ElevenLabs TTS can be enabled in your Cloud dashboard settings.",
      },
      {
        type: "faq",
        faqs: [
          {
            q: "Can I use voice mode with any AI model?",
            a: "Yes. Voice mode handles speech-to-text separately from the AI model. Once transcribed, your voice message is sent to whichever model you've configured — Claude, GPT-4o, local models, or anything else.",
          },
          {
            q: "How accurate is the voice transcription?",
            a: "OpenAI Whisper (the default transcription engine) is highly accurate — among the best available. Accuracy depends on microphone quality and ambient noise. It handles multiple languages and accents well.",
          },
          {
            q: "Can OpenClaw call me back with voice responses?",
            a: "Not as a phone call. OpenClaw sends voice notes (audio files) as responses in WhatsApp or Telegram, which your phone plays when you open the message.",
          },
          {
            q: "Does voice mode work for non-English languages?",
            a: "Yes. Whisper supports 99 languages for transcription. TTS support depends on your chosen provider — ElevenLabs and Edge TTS both support many languages.",
          },
        ],
      },
    ],
  },

  {
    slug: "openclaw-memory-guide",
    title: "OpenClaw Memory: How Your AI Assistant Remembers You",
    metaTitle: "OpenClaw Memory System Guide: AI That Remembers | OpenClaw Cloud",
    metaDescription:
      "Learn how OpenClaw's memory system works — conversation history, persistent facts, workspace context, and how to give your AI a long-term memory of who you are.",
    publishedAt: "2025-03-23",
    readingTime: "7 min read",
    category: "Technical",
    excerpt:
      "OpenClaw's memory system goes far beyond conversation history. Persistent facts, workspace context, and user profiles let your AI assistant build a genuine understanding of who you are over time.",
    keywords: [
      "openclaw memory",
      "ai with memory",
      "persistent ai assistant",
      "ai that remembers",
      "openclaw context",
      "long-term ai memory",
      "ai personal memory 2025",
    ],
    relatedSlugs: ["what-is-openclaw", "what-is-openclawd", "self-hosted-ai-2025"],
    content: [
      {
        type: "p",
        content:
          "One of the most common frustrations with AI assistants is that they forget everything the moment you start a new conversation. Every session starts from scratch: you have to re-explain who you are, what you're working on, and what context matters. OpenClaw solves this with a layered memory system that persists across conversations, across platforms, and across devices.",
      },
      {
        type: "h2",
        heading: "The Three Layers of OpenClaw Memory",
        content:
          "OpenClaw organizes memory into three distinct layers, each serving a different purpose:",
      },
      {
        type: "ol",
        items: [
          "Conversation Memory: The recent context window — the last N messages in your current conversation. This is what most AI assistants provide as their only form of memory.",
          "Session Memory: Context that persists across multiple conversations within the same channel. Closing and reopening Telegram, for example, doesn't wipe your session.",
          "Persistent Memory (Facts): Long-term facts about you that are injected into every conversation as a system prompt. 'You are a software engineer in Berlin. You prefer concise answers. You are working on a SaaS product called XYZ.'",
        ],
      },
      {
        type: "h2",
        heading: "Persistent Memory: Teaching Your AI About You",
        content:
          "Persistent memory is what makes OpenClaw feel like an assistant that actually knows you. You can define facts in your workspace config, or tell OpenClaw to remember things conversationally:",
      },
      {
        type: "ul",
        items: [
          'Type "Remember that I prefer responses in bullet points" — OpenClaw saves this as a persistent fact',
          'Type "Forget that I\'m a Python developer, I switched to TypeScript" — OpenClaw updates its memory',
          'Type "What do you know about me?" — OpenClaw lists all stored facts about you',
          "Define structured facts in your openclaw.config.yaml for more control",
          "Facts are stored per-workspace — you can have different memory profiles for different use cases",
        ],
      },
      {
        type: "h2",
        heading: "Workspace Context",
        content:
          "Beyond personal facts, OpenClaw supports workspace context — a block of text that's injected into every conversation as additional system context. This is where you define your AI's persona, the project you're working on, and any standing instructions.",
      },
      {
        type: "p",
        content:
          "A workspace context might look like: 'We are working on a B2B SaaS product that helps restaurants manage inventory. The tech stack is Next.js, Supabase, and Stripe. I'm the solo founder and need concise, actionable advice. Always suggest the simplest possible solution first.' Every conversation starts with this context injected silently — your AI assistant is always in the right headspace.",
      },
      {
        type: "h2",
        heading: "Memory Across Platforms",
        content:
          "Because OpenClaw is a central gateway, your memory is shared across all your connected platforms. The conversation you had with your AI in Telegram yesterday is part of the context when you start chatting on Discord today. This is fundamentally different from using different AI apps on different devices — the memory lives in OpenClaw, not in the client app.",
      },
      {
        type: "h2",
        heading: "Memory Privacy and Control",
        content:
          "Your memory data is stored on your server (or OpenClaw Cloud's isolated instance). You have full access to it:",
      },
      {
        type: "ul",
        items: [
          "View all stored memories: openclaw memory list",
          "Delete a specific memory: openclaw memory delete <id>",
          "Clear all memories: openclaw memory clear",
          "Export memories as JSON: openclaw memory export",
          "On OpenClaw Cloud: manage memories in the Dashboard → Memory section",
        ],
      },
      {
        type: "h2",
        heading: "How OpenClaw Memory Compares to ChatGPT Memory",
        content:
          "ChatGPT Plus introduced a memory feature in 2024 that stores facts about you across conversations. OpenClaw's memory system is more powerful in several ways:",
      },
      {
        type: "table",
        headers: ["Feature", "OpenClaw Memory", "ChatGPT Memory"],
        rows: [
          { cells: ["Storage location", "Your server / OpenClaw Cloud", "OpenAI servers"] },
          { cells: ["Transparency", "Full — you see all stored facts", "Partial — some auto-generated memories aren't shown"] },
          { cells: ["Control", "Full — add, edit, delete any memory", "Limited editing"] },
          { cells: ["Cross-platform", "Yes — shared across all channels", "No — ChatGPT only"] },
          { cells: ["Workspace context", "Yes — custom system prompts per workspace", "No"] },
          { cells: ["Memory privacy", "On your infrastructure", "On OpenAI infrastructure"] },
        ],
      },
      {
        type: "callout",
        content:
          "OpenClaw Cloud includes persistent memory with full read/write access via your dashboard. Your AI remembers your preferences, projects, and context — across WhatsApp, Telegram, Discord, and every other channel you connect.",
      },
      {
        type: "faq",
        faqs: [
          {
            q: "How much can OpenClaw remember?",
            a: "There's no hard limit on persistent facts. In practice, the memory injected into each conversation is bounded by the model's context window. OpenClaw intelligently summarizes and prioritizes memories to fit within the context limit.",
          },
          {
            q: "Can I have different memories for different topics?",
            a: "Yes. You can create multiple workspaces in OpenClaw, each with its own memory context. Use one workspace for work, another for personal use, another for a specific project.",
          },
          {
            q: "Is memory shared between users?",
            a: "No. Memory is per-user. If you give other people access to your OpenClaw instance, each user has their own isolated memory profile.",
          },
          {
            q: "Does memory get used automatically?",
            a: "Yes. Persistent facts and workspace context are injected into every new conversation automatically. You don't need to manually remind the AI of anything you've already told it.",
          },
          {
            q: "Can I back up my OpenClaw memories?",
            a: "Yes. Use 'openclaw memory export' to export all memories as a JSON file. On OpenClaw Cloud, you can download your memory backup from the dashboard at any time.",
          },
        ],
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}

export function getRelatedPosts(slug: string): BlogPost[] {
  const post = getBlogPost(slug);
  if (!post) return [];
  return post.relatedSlugs
    .map((s) => getBlogPost(s))
    .filter((p): p is BlogPost => p !== undefined);
}
