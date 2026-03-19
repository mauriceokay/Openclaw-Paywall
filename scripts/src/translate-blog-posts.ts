import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { blogPosts, type BlogPost } from "../../artifacts/openclaw/src/data/blog-posts";

type SupportedLocale = "it" | "fr" | "pl" | "ko";

type LocaleConfig = {
  locale: SupportedLocale;
  languageName: string;
  nativeName: string;
  categoryMap: Record<string, string>;
};

const LOCALES: Record<SupportedLocale, LocaleConfig> = {
  it: {
    locale: "it",
    languageName: "Italian",
    nativeName: "Italiano",
    categoryMap: {
      Guides: "Guide",
      Technical: "Tecnico",
      Comparisons: "Confronti",
    },
  },
  fr: {
    locale: "fr",
    languageName: "French",
    nativeName: "Français",
    categoryMap: {
      Guides: "Guides",
      Technical: "Technique",
      Comparisons: "Comparaisons",
    },
  },
  pl: {
    locale: "pl",
    languageName: "Polish",
    nativeName: "Polski",
    categoryMap: {
      Guides: "Poradniki",
      Technical: "Techniczne",
      Comparisons: "Porównania",
    },
  },
  ko: {
    locale: "ko",
    languageName: "Korean",
    nativeName: "한국어",
    categoryMap: {
      Guides: "가이드",
      Technical: "기술",
      Comparisons: "비교",
    },
  },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const locales: SupportedLocale[] = [];
  let model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  let limit = Number.POSITIVE_INFINITY;

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--locale" && args[i + 1]) {
      const v = args[i + 1] as SupportedLocale;
      if (v in LOCALES) locales.push(v);
      i += 1;
      continue;
    }
    if (a === "--model" && args[i + 1]) {
      model = args[i + 1];
      i += 1;
      continue;
    }
    if (a === "--limit" && args[i + 1]) {
      const n = Number(args[i + 1]);
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
      i += 1;
    }
  }

  return {
    locales: locales.length ? locales : (["it"] as SupportedLocale[]),
    model,
    limit,
  };
}

async function openAIJson<T>(params: {
  model: string;
  apiKey: string;
  system: string;
  user: string;
}): Promise<T> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${body}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty response");
  }

  return JSON.parse(content) as T;
}

function escapeForTs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
}

function toTsLiteral(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  const padNext = "  ".repeat(indent + 1);
  if (value === null) return "null";
  if (typeof value === "string") return `\`${escapeForTs(value)}\``;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((v) => `${padNext}${toTsLiteral(v, indent + 1)}`);
    return `[\n${items.join(",\n")}\n${pad}]`;
  }
  const obj = value as Record<string, unknown>;
  const entries = Object.entries(obj);
  if (entries.length === 0) return "{}";
  const lines = entries.map(([k, v]) => `${padNext}${k}: ${toTsLiteral(v, indent + 1)}`);
  return `{\n${lines.join(",\n")}\n${pad}}`;
}

function buildSystemPrompt(cfg: LocaleConfig): string {
  return [
    `You are an expert translator for technical AI blog content.`,
    `Translate from English to ${cfg.languageName} (${cfg.nativeName}).`,
    `Return ONLY a JSON object.`,
    `Preserve factual meaning, URLs, CLI commands, code, and brand names exactly.`,
    `Do not translate slugs.`,
    `Keep the same structure and array lengths.`,
    `Use natural, fluent ${cfg.languageName}.`,
    `Translate "readingTime" to local style while keeping the number (e.g. "9 min read").`,
    `Category mapping must be: ${JSON.stringify(cfg.categoryMap)}.`,
  ].join(" ");
}

type TranslatedShape = Omit<BlogPost, "slug" | "relatedSlugs" | "keywords"> & {
  slug: string;
  relatedSlugs: string[];
  keywords: string[];
};

function validateTranslated(post: BlogPost, translated: TranslatedShape): BlogPost {
  const result: BlogPost = {
    ...translated,
    slug: post.slug,
    relatedSlugs: post.relatedSlugs,
    keywords: translated.keywords?.length ? translated.keywords : post.keywords,
  };
  return result;
}

async function translatePost(post: BlogPost, cfg: LocaleConfig, model: string, apiKey: string): Promise<BlogPost> {
  const payload = {
    title: post.title,
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
    publishedAt: post.publishedAt,
    readingTime: post.readingTime,
    category: post.category,
    excerpt: post.excerpt,
    content: post.content,
    keywords: post.keywords,
  };

  const translated = await openAIJson<TranslatedShape>({
    model,
    apiKey,
    system: buildSystemPrompt(cfg),
    user: JSON.stringify(payload),
  });

  return validateTranslated(post, translated);
}

async function main() {
  const { locales, model, limit } = parseArgs();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  const posts = blogPosts.slice(0, Math.min(limit, blogPosts.length));

  for (const locale of locales) {
    const cfg = LOCALES[locale];
    const translatedPosts: BlogPost[] = [];
    console.log(`[translate-blog] locale=${locale} posts=${posts.length} model=${model}`);

    for (let i = 0; i < posts.length; i += 1) {
      const post = posts[i];
      console.log(`[translate-blog] ${locale} ${i + 1}/${posts.length} ${post.slug}`);
      const translated = await translatePost(post, cfg, model, apiKey);
      translatedPosts.push(translated);
    }

    const outputDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../artifacts/openclaw/src/data/blog-translations",
    );
    await mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `${locale}.ts`);
    const varName = `${locale}Blogs`;
    const fileBody =
      `import type { BlogPost } from "../blog-posts";\n\n` +
      `export const ${varName}: BlogPost[] = ${toTsLiteral(translatedPosts)};\n`;
    await writeFile(outputPath, fileBody, "utf8");
    console.log(`[translate-blog] wrote ${outputPath}`);
  }
}

main().catch((err) => {
  console.error("[translate-blog] failed:", err);
  process.exit(1);
});
