import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Terminal, Shield, MessageSquare, Workflow, Zap, Globe, X, Check, Star } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { SEOHead } from "@/components/SEOHead";

const FEATURE_ICONS = [Globe, MessageSquare, Workflow, Shield, Terminal, Zap];

const TESTIMONIAL_META = [
  { name: "Marcus T.", handle: "@marcust_dev", avatar: "M", stars: 5 },
  { name: "Priya K.",  handle: "@priyak",       avatar: "P", stars: 5 },
  { name: "Jonas W.",  handle: "@jonaswdev",    avatar: "J", stars: 5 },
  { name: "Aisha M.",  handle: "@aisham_ai",    avatar: "A", stars: 5 },
];

const HERO_STYLES = [
  "text-muted-foreground",
  "",
  "text-blue-400",
  "text-yellow-400",
  "text-green-400",
  "text-muted-foreground mt-4 animate-pulse",
];

const WITHOUT_STYLES = [
  "text-muted-foreground",
  "text-muted-foreground",
  "text-destructive",
  "text-muted-foreground mt-1",
  "text-destructive",
  "text-muted-foreground mt-1",
  "text-destructive",
];

const WITH_STYLES = [
  "text-muted-foreground",
  "text-green-400 mt-1",
  "text-green-400",
  "text-green-400",
  "text-green-400",
  "text-green-400 animate-pulse mt-1",
];

export function Home() {
  const { t, locale } = useLanguage();

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <>
    <SEOHead
      locale={locale}
      title={t.seo.homeTitle}
      description={t.seo.homeDesc}
      canonicalPath="/"
      keywords="openclaw, personal ai assistant, self-hosted ai, whatsapp ai, telegram ai, discord ai"
    />
    <div className="min-h-screen pt-20 flex flex-col">
      {/* Hero Section */}
      <section className="relative w-full py-32 overflow-hidden flex-1 flex items-center">
        <div className="absolute inset-0 z-0">
          <img
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
            alt="Deep ocean background"
            className="w-full h-full object-cover opacity-30 mix-blend-screen"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex flex-col gap-6"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium w-fit">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                {t.home.badge}
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display leading-[1.1]">
                {t.home.heroTitle}<br />
                <span className="text-gradient-primary">{t.home.heroHighlight}</span>
              </h1>

              <p className="text-xl text-muted-foreground leading-relaxed max-w-lg">
                {t.home.heroDesc}
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                <Link href="/signup" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full text-lg h-14 px-8 rounded-full bg-primary hover:bg-primary/90 text-white shadow-[0_0_30px_rgba(255,81,47,0.3)] hover:shadow-[0_0_40px_rgba(255,81,47,0.5)] transition-all">
                    {t.home.heroCta}
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-3xl blur-2xl opacity-20 animate-pulse" />
              <div className="relative glass-panel rounded-3xl p-8 h-[500px] flex flex-col justify-between border-white/10 animate-float">
                <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-destructive" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="text-xs font-mono text-muted-foreground flex-1 text-center pr-8">openclaw-gateway</div>
                </div>

                <div className="flex-1 font-mono text-sm space-y-2">
                  {(t.home.terminalHero as readonly string[]).map((line, i) => (
                    <p key={i} className={HERO_STYLES[i]}>{line}</p>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-card/30 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-display mb-4">{t.home.featuresTitle}</h2>
            <p className="text-muted-foreground">{t.home.featuresSubtitle}</p>
          </div>

          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {t.home.features.map((feature, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <motion.div key={i} variants={item} className="glass-panel p-8 rounded-2xl group hover:-translate-y-1 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Why most people never use OpenClaw */}
      <section className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-display leading-tight mb-4">
              {t.home.whyTitle}
            </h2>
            <p className="text-muted-foreground text-lg">{t.home.whySubtitle}</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Without us */}
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-white/10 overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-white/10 bg-white/5">
                <span className="text-xs font-semibold tracking-widest text-destructive uppercase">{t.home.withoutLabel}</span>
              </div>

              <div className="bg-black/60 p-5 font-mono text-sm">
                <div className="flex gap-1.5 mb-4">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                {(t.home.terminalWithout as readonly string[]).map((line, i) => (
                  <p key={i} className={WITHOUT_STYLES[i]}>{line}</p>
                ))}
              </div>

              <div className="p-5 space-y-3 bg-card/40">
                {t.home.pains.map((pain, i) => (
                  <div key={i} className={`flex items-center gap-3 ${i === t.home.pains.length - 1 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                    <X className="w-4 h-4 shrink-0 text-destructive" />
                    <span>{pain}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* With us */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-2xl border border-primary/30 overflow-hidden shadow-[0_0_40px_rgba(255,81,47,0.08)]"
            >
              <div className="px-5 py-3 border-b border-primary/20 bg-primary/5">
                <span className="text-xs font-semibold tracking-widest text-primary uppercase">{t.home.withUsLabel}</span>
              </div>

              <div className="bg-black/60 p-5 font-mono text-sm">
                <div className="flex gap-1.5 mb-4">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                {(t.home.terminalWithUs as readonly string[]).map((line, i) => (
                  <p key={i} className={WITH_STYLES[i]}>{line}</p>
                ))}
              </div>

              <div className="p-5 space-y-3 bg-card/40">
                {t.home.wins.map((win, i) => (
                  <div key={i} className={`flex items-center gap-3 ${i === t.home.wins.length - 1 ? "text-primary font-semibold" : "text-foreground"}`}>
                    <Check className="w-4 h-4 shrink-0 text-green-400" />
                    <span>{win}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-center mt-10"
          >
            <Link href="/signup">
              <Button size="lg" className="text-lg h-14 px-10 rounded-full bg-primary hover:bg-primary/90 text-white shadow-[0_0_30px_rgba(255,81,47,0.3)] hover:shadow-[0_0_40px_rgba(255,81,47,0.5)] transition-all">
                {t.home.skipCta}
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-card/30 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-4xl font-display mb-4">{t.home.testimonialsTitle}</h2>
            <p className="text-muted-foreground">{t.home.testimonialsSubtitle}</p>
          </motion.div>

          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            {TESTIMONIAL_META.map((meta, i) => (
              <motion.div
                key={i}
                variants={item}
                className="glass-panel rounded-2xl p-6 flex flex-col gap-4 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: meta.stars }).map((_, s) => (
                    <Star key={s} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                  "{(t.home.testimonialTexts as readonly string[])[i]}"
                </p>

                <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                  <div className="w-9 h-9 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-sm shrink-0">
                    {meta.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{meta.name}</p>
                    <p className="text-xs text-muted-foreground">{meta.handle}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-28 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center gap-6"
          >
            <span className="text-5xl">🦞</span>
            <h2 className="text-4xl md:text-5xl font-display leading-tight" style={{ whiteSpace: "pre-line" }}>
              {t.home.finalTitle}
            </h2>
            <p className="text-muted-foreground text-lg max-w-lg">
              {t.home.finalDesc}
            </p>
            <Link href="/signup">
              <Button size="lg" className="text-lg h-14 px-12 rounded-full bg-primary hover:bg-primary/90 text-white shadow-[0_0_40px_rgba(255,81,47,0.3)] hover:shadow-[0_0_50px_rgba(255,81,47,0.5)] transition-all mt-2">
                {t.home.finalCta}
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
    </>
  );
}
