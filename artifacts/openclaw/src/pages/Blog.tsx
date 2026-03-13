import { Link } from "wouter";
import { motion } from "framer-motion";
import { SEOHead } from "@/components/SEOHead";
import { Clock, Tag, ArrowRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { getBlogPostsForLocale } from "@/data/blog-index";

const CATEGORY_COLORS: Record<string, string> = {
  Guides: "text-blue-400 bg-blue-400/10",
  Technical: "text-purple-400 bg-purple-400/10",
  Comparisons: "text-orange-400 bg-orange-400/10",
  Anleitungen: "text-blue-400 bg-blue-400/10",
  Technisch: "text-purple-400 bg-purple-400/10",
  Vergleiche: "text-orange-400 bg-orange-400/10",
  指南: "text-blue-400 bg-blue-400/10",
  技術: "text-purple-400 bg-purple-400/10",
  比較: "text-orange-400 bg-orange-400/10",
};

export function Blog() {
  const { t, locale } = useLanguage();
  const posts = getBlogPostsForLocale(locale);

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
  };

  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <>
      <SEOHead
        locale={locale}
        title={t.seo.blogTitle}
        description={t.seo.blogDesc}
        canonicalPath="/blog"
        keywords="openclaw, openclawd, clawdbot, moltbot, self-hosted ai, personal ai assistant"
      />

      <div className="min-h-screen pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-6">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
              <Tag className="w-3.5 h-3.5" />
              OpenClaw Blog
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
              {t.blog.title}
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t.blog.description}
            </p>
          </motion.div>

          {/* Featured Post */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-12"
          >
            <Link href={`/blog/${featured.slug}`}>
              <div className="group glass-panel rounded-2xl p-8 md:p-10 border border-primary/20 hover:border-primary/40 shadow-[0_0_40px_rgba(255,81,47,0.06)] hover:shadow-[0_0_60px_rgba(255,81,47,0.12)] transition-all duration-300 cursor-pointer">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[featured.category] ?? "text-primary bg-primary/10"}`}>
                    {featured.category}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    {featured.readingTime}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(featured.publishedAt).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                  <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-semibold">{t.blog.featured}</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-display font-bold mb-3 group-hover:text-primary transition-colors leading-tight">
                  {featured.title}
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-5 max-w-3xl">{featured.excerpt}</p>
                <div className="flex items-center gap-2 text-primary text-sm font-semibold">
                  {t.blog.readArticle}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Post Grid */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {rest.map((post) => (
              <motion.div key={post.slug} variants={item}>
                <Link href={`/blog/${post.slug}`}>
                  <div className="group glass-panel rounded-2xl p-6 h-full flex flex-col hover:-translate-y-1 hover:border-white/20 transition-all duration-300 cursor-pointer">
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[post.category] ?? "text-primary bg-primary/10"}`}>
                        {post.category}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {post.readingTime}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors leading-snug flex-1">
                      {post.title}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-3">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                      <span className="text-xs text-muted-foreground">
                        {new Date(post.publishedAt).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                      <span className="text-primary text-xs font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                        {t.blog.read} <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          {/* SEO keyword cloud */}
          <div className="mt-16 pt-10 border-t border-white/5">
            <p className="text-xs text-muted-foreground/40 text-center leading-relaxed">
              {t.blog.topicsLabel}: openclaw · openclawd · clawdbot · moltbot · self-hosted ai · personal ai assistant ·
              openclaw discord · openclaw telegram · openclaw whatsapp · openclaw integrations · clawdbot discord ·
              moltbot setup · openclaw cloud · openclaw tutorial · ai gateway · personal ai 2025
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
