import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Terminal, Shield, MessageSquare, Workflow, Zap, Globe } from "lucide-react";

export function Home() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="min-h-screen pt-20 flex flex-col">
      {/* Hero Section */}
      <section className="relative w-full py-32 overflow-hidden flex-1 flex items-center">
        {/* Background Image & Overlay */}
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
                OpenClaw Gateway v1.0
              </div>
              
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display leading-[1.1]">
                Your personal AI assistant.<br />
                <span className="text-gradient-primary">The lobster way.</span>
              </h1>
              
              <p className="text-xl text-muted-foreground leading-relaxed max-w-lg">
                Run your own AI on your devices. Connects to WhatsApp, Telegram, Discord, and 20+ other platforms. Fast, private, and always-on.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                <Link href="/signup" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full text-lg h-14 px-8 rounded-full bg-primary hover:bg-primary/90 text-white shadow-[0_0_30px_rgba(255,81,47,0.3)] hover:shadow-[0_0_40px_rgba(255,81,47,0.5)] transition-all">
                    Start OpenClaw Now
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
                
                <div className="flex-1 font-mono text-sm text-green-400 space-y-2">
                  <p className="text-muted-foreground">$ openclaw onboard</p>
                  <p>🦞 EXFOLIATE! EXFOLIATE!</p>
                  <p className="text-blue-400">➜ Starting Gateway on ws://127.0.0.1:18789</p>
                  <p className="text-yellow-400">➜ Connecting to Telegram...</p>
                  <p className="text-green-400">✓ Connected successfully.</p>
                  <p className="text-muted-foreground mt-4 animate-pulse">Waiting for messages...</p>
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
            <h2 className="text-3xl md:text-4xl font-display mb-4">Everything you need in an AI.</h2>
            <p className="text-muted-foreground">Self-hosted control plane, zero privacy compromises, infinite possibilities.</p>
          </div>

          <motion.div 
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {[
              { icon: Globe, title: "Any Platform", desc: "Native integration with WhatsApp, Telegram, Slack, iMessage, Discord and 20+ more." },
              { icon: MessageSquare, title: "Voice & Talk Mode", desc: "Speak directly to your assistant via iOS, Android or macOS native apps." },
              { icon: Workflow, title: "Powerful Automations", desc: "Cron jobs, webhooks, and Gmail Pub/Sub integrations out of the box." },
              { icon: Shield, title: "Self-Hosted Privacy", desc: "You own the Gateway. Your data stays on your infrastructure." },
              { icon: Terminal, title: "CLI Wizard", desc: "Set up the entire workspace, channels, and skills in minutes with the terminal." },
              { icon: Zap, title: "Skills Platform", desc: "Extend capabilities with bundled and managed skills dynamically." }
            ].map((feature, i) => (
              <motion.div key={i} variants={item} className="glass-panel p-8 rounded-2xl group hover:-translate-y-1 transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </div>
  );
}
