import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import dashboardImg from "@/assets/dashboard-hero.jpg";

// 1. Define the Interface for Props
interface HeroSectionProps {
  onCtaClick: () => void;
}

// 2. Destructure the onCtaClick prop
const HeroSection = ({ onCtaClick }: HeroSectionProps) => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Animated grid background */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />
      </div>
      
      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, hsl(195 100% 50% / 0.15), transparent 70%)' }} />

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5 mb-8"
            >
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm text-muted-foreground font-body">Now in Public Beta — Free to Join</span>
            </motion.div>

            <h1 className="font-heading text-5xl md:text-7xl font-bold leading-[1.05] mb-6">
              Pattern<span className="text-gradient">IQ</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed mb-4 max-w-xl font-body">
              The world's first <span className="text-foreground font-semibold">AI-Native Trading OS</span>. Build, backtest, and battle with strategies using plain English.
            </p>
            <p className="text-base text-muted-foreground mb-8 max-w-lg font-body">
              No coding required. Type your strategy in natural language. Our AI handles the rest — from Python logic to professional PnL reports.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              {/* 3. Attach the onCtaClick handler to the primary button */}
              <Button 
                size="lg" 
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-heading font-semibold text-base px-8 py-6 gap-2 group"
                onClick={onCtaClick}
              >
                Launch Terminal
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
              
              <Button variant="outline" size="lg" className="border-border text-foreground hover:bg-secondary font-heading font-semibold text-base px-8 py-6 gap-2">
                <Play className="w-4 h-4" />
                Watch Demo
              </Button>
            </div>

            <div className="flex items-center gap-8 mt-10">
              <div>
                <p className="text-2xl font-heading font-bold text-foreground">5,200+</p>
                <p className="text-sm text-muted-foreground font-body">Active Traders</p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div>
                <p className="text-2xl font-heading font-bold text-foreground">1.2M+</p>
                <p className="text-sm text-muted-foreground font-body">Backtests Run</p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div>
                <p className="text-2xl font-heading font-bold text-foreground">98.7%</p>
                <p className="text-sm text-muted-foreground font-body">Uptime</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 60, rotateY: -15 }}
            animate={{ opacity: 1, x: 0, rotateY: -8 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="hidden lg:block"
          >
            <div className="relative" style={{ perspective: '1200px' }}>
              <img
                src={dashboardImg}
                alt="PatternIQ Trading Dashboard"
                width={1920}
                height={1080}
                className="rounded-xl w-[130%]"
                style={{
                  transform: 'perspective(1000px) rotateY(-12deg) rotateX(2deg)',
                  boxShadow: '0 25px 80px hsl(195 100% 50% / 0.2), 0 0 0 1px hsl(220 15% 16%)',
                }}
              />
              <div className="absolute -bottom-6 -left-6 rounded-lg border border-border bg-card p-4 shadow-lg" style={{ animation: 'float 6s ease-in-out infinite' }}>
                <p className="text-xs text-muted-foreground font-body">Latest Signal</p>
                <p className="text-sm font-heading font-bold text-primary">NIFTY 50 — Bullish Breakout</p>
                <p className="text-xs text-green-400">+2.4% since alert</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;