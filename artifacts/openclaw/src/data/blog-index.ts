import { blogPosts, type BlogPost } from "./blog-posts";
import { deBlogs } from "./blog-translations/de";
import { frBlogs } from "./blog-translations/fr";
import { zhCNBlogs } from "./blog-translations/zh-CN";
import { zhTWBlogs } from "./blog-translations/zh-TW";
import { jaBlogs } from "./blog-translations/ja";
import { arBlogs } from "./blog-translations/ar";
import { plBlogs } from "./blog-translations/pl";
import type { LocaleCode } from "@/i18n";

const localeMap: Partial<Record<LocaleCode, BlogPost[]>> = {
  de: deBlogs,
  fr: frBlogs,
  "zh-CN": zhCNBlogs,
  "zh-TW": zhTWBlogs,
  ja: jaBlogs,
  ar: arBlogs,
  pl: plBlogs,
};

export function getBlogPostsForLocale(locale: LocaleCode): BlogPost[] {
  return localeMap[locale] ?? blogPosts;
}

export function getBlogPostForLocale(slug: string, locale: LocaleCode): BlogPost | undefined {
  const posts = getBlogPostsForLocale(locale);
  return posts.find((p) => p.slug === slug);
}

export function getRelatedPostsForLocale(slugs: string[], locale: LocaleCode): BlogPost[] {
  const posts = getBlogPostsForLocale(locale);
  return slugs
    .map((slug) => posts.find((p) => p.slug === slug))
    .filter(Boolean) as BlogPost[];
}
