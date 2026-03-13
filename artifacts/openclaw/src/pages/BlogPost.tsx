import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Clock, ChevronRight, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBlogPost, getRelatedPosts, type BlogSection } from "@/data/blog-posts";
import NotFound from "@/pages/not-found";

const CATEGORY_COLORS: Record<string, string> = {
  Guides: "text-blue-400 bg-blue-400/10",
  Technical: "text-purple-400 bg-purple-400/10",
  Comparisons: "text-orange-400 bg-orange-400/10",
};

function Section({ section }: { section: BlogSection }) {
  switch (section.type) {
    case "h2":
      return (
        <div className="mt-10 mb-4">
          {section.heading && (
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground">
              {section.heading}
            </h2>
          )}
          {section.content && <p className="text-muted-foreground leading-relaxed mt-3">{section.content}</p>}
        </div>
      );

    case "h3":
      return (
        <div className="mt-8 mb-3">
          {section.heading && (
            <h3 className="text-xl font-bold text-foreground">{section.heading}</h3>
          )}
          {section.content && <p className="text-muted-foreground leading-relaxed mt-2">{section.content}</p>}
        </div>
      );

    case "p":
      return (
        <p className="text-foreground/80 leading-relaxed mb-4">{section.content}</p>
      );

    case "ul":
      return (
        <ul className="space-y-2 my-4">
          {section.items?.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-foreground/80">
              <span className="text-primary mt-1 shrink-0">•</span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      );

    case "ol":
      return (
        <ol className="space-y-2 my-4">
          {section.items?.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-foreground/80">
              <span className="text-primary font-bold shrink-0 w-5">{i + 1}.</span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ol>
      );

    case "callout":
      return (
        <div className="my-8 rounded-xl border border-primary/30 bg-primary/5 p-6">
          <p className="text-foreground/90 leading-relaxed font-medium">{section.content}</p>
          <div className="mt-4">
            <Link href="/signup">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-white rounded-full">
                Get Started with OpenClaw Cloud
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      );

    case "table":
      return (
        <div className="my-6 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                {section.headers?.map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 font-semibold text-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows?.map((row, ri) => (
                <tr key={ri} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  {row.cells.map((cell, ci) => (
                    <td key={ci} className={`px-4 py-3 text-muted-foreground ${ci === 0 ? "font-medium text-foreground/90" : ""}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "faq":
      return (
        <div className="my-8 space-y-4">
          <h2 className="text-2xl font-display font-bold mb-6">Frequently Asked Questions</h2>
          {section.faqs?.map((faq, i) => (
            <details key={i} className="group rounded-xl border border-white/10 bg-card/40 overflow-hidden">
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-semibold text-foreground hover:text-primary transition-colors list-none">
                {faq.q}
                <ChevronRight className="w-4 h-4 shrink-0 group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-5 pb-4 text-muted-foreground leading-relaxed">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      );

    default:
      return null;
  }
}

export function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = getBlogPost(slug);
  const related = getRelatedPosts(slug);

  if (!post) return <NotFound />;

  const publishedDate = new Date(post.publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription,
    datePublished: post.publishedAt,
    author: { "@type": "Organization", name: "OpenClaw Cloud" },
    publisher: { "@type": "Organization", name: "OpenClaw Cloud" },
    keywords: post.keywords.join(", "),
  };

  return (
    <>
      <Helmet>
        <title>{post.metaTitle}</title>
        <meta name="description" content={post.metaDescription} />
        <meta name="keywords" content={post.keywords.join(", ")} />
        <meta property="og:title" content={post.metaTitle} />
        <meta property="og:description" content={post.metaDescription} />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.metaTitle} />
        <meta name="twitter:description" content={post.metaDescription} />
        <link rel="canonical" href={`https://openclaw.cloud/blog/${post.slug}`} />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="min-h-screen pt-32 pb-24">
        <div className="max-w-4xl mx-auto px-6">

          {/* Breadcrumb */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-sm text-muted-foreground mb-8"
          >
            <Link href="/blog" className="hover:text-primary transition-colors flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              Blog
            </Link>
            <span>/</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[post.category] ?? "text-primary bg-primary/10"}`}>
              {post.category}
            </span>
          </motion.div>

          {/* Article Header */}
          <motion.header
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-10"
          >
            <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {post.readingTime}
              </span>
              <span>{publishedDate}</span>
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold leading-tight mb-5">
              {post.title}
            </h1>

            <p className="text-xl text-muted-foreground leading-relaxed">{post.excerpt}</p>

            {/* Keyword tags */}
            <div className="flex flex-wrap gap-2 mt-5">
              {post.keywords.map((kw) => (
                <span key={kw} className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                  <Tag className="w-3 h-3" />
                  {kw}
                </span>
              ))}
            </div>
          </motion.header>

          {/* Article body */}
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="prose-invert max-w-none"
          >
            {post.content.map((section, i) => (
              <Section key={i} section={section} />
            ))}
          </motion.article>

          {/* CTA Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-16 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 text-center"
          >
            <div className="text-4xl mb-4">🦞</div>
            <h2 className="text-2xl font-display font-bold mb-3">Ready to run your own AI?</h2>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              Get your personal OpenClaw instance running in minutes — no server, no config, no headaches.
            </p>
            <Link href="/signup">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-white rounded-full px-8 shadow-[0_0_30px_rgba(255,81,47,0.3)] hover:shadow-[0_0_40px_rgba(255,81,47,0.5)] transition-all">
                Start OpenClaw Now
              </Button>
            </Link>
          </motion.div>

          {/* Related Posts */}
          {related.length > 0 && (
            <div className="mt-16">
              <h2 className="text-2xl font-display font-bold mb-6">Related Articles</h2>
              <div className="grid md:grid-cols-3 gap-5">
                {related.map((rp) => (
                  <Link key={rp.slug} href={`/blog/${rp.slug}`}>
                    <div className="group glass-panel rounded-xl p-5 hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full flex flex-col">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit mb-3 ${CATEGORY_COLORS[rp.category] ?? "text-primary bg-primary/10"}`}>
                        {rp.category}
                      </span>
                      <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors flex-1 mb-3">
                        {rp.title}
                      </h3>
                      <div className="flex items-center gap-1 text-primary text-xs font-semibold">
                        Read <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
