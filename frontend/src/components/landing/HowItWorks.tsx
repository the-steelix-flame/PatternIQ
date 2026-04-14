import { motion } from "framer-motion";
import { MessageSquare, Cpu, LineChart, Trophy } from "lucide-react";

const steps = [
  { icon: MessageSquare, step: "01", title: "Describe Your Strategy", desc: "Type your trading idea in plain English. No coding syntax, no formulas — just describe what you'd do." },
  { icon: Cpu, step: "02", title: "AI Generates the Logic", desc: "Our engine converts your description into optimized Python code, selects the right data sources, and configures parameters." },
  { icon: LineChart, step: "03", title: "Instant Backtest Results", desc: "Get a full PnL report with Sharpe ratio, max drawdown, win rate, and visual equity curves in under 30 seconds." },
  { icon: Trophy, step: "04", title: "Share & Compete", desc: "Save winning strategies to your Vault, share with the community, and compete in The Arena for leaderboard glory." },
];

const HowItWorks = () => (
  <section className="py-24 border-y border-border" style={{ background: 'var(--gradient-hero)' }}>
    <div className="container mx-auto px-6">
      <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-heading font-bold mb-4">How It Works</h2>
        <p className="text-lg text-muted-foreground font-body">From idea to institutional-grade backtest in four steps.</p>
      </motion.div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
        {steps.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.12 }}
            className="relative text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <s.icon className="w-7 h-7 text-primary" />
            </div>
            <span className="text-xs font-heading font-bold text-primary uppercase tracking-widest">{s.step}</span>
            <h3 className="text-lg font-heading font-bold mt-2 mb-2">{s.title}</h3>
            <p className="text-sm text-muted-foreground font-body">{s.desc}</p>
            {i < steps.length - 1 && (
              <div className="hidden lg:block absolute top-8 right-0 translate-x-1/2 w-8 border-t border-dashed border-border" />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
