import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  { name: "Arjun Mehta", role: "Swing Trader, Mumbai", text: "PatternIQ changed my workflow completely. I went from spending 3 hours on backtesting in Python to getting results in under 30 seconds. The AI understands exactly what I mean.", rating: 5 },
  { name: "Priya Sharma", role: "Options Trader, Bangalore", text: "The Anomaly Scanner caught a massive volume spike in HDFC Bank 15 minutes before the breakout. That single alert paid for a year of premium.", rating: 5 },
  { name: "Rahul Verma", role: "Quant Analyst, Delhi", text: "The Arena is addictive. Competing with other traders on real-time market quizzes keeps me sharp. My win rate has improved 20% since I joined.", rating: 5 },
  { name: "Sneha Patel", role: "Day Trader, Pune", text: "Risk Officer feature found I was over-concentrated in IT stocks. Rebalanced my portfolio and reduced volatility by 35%. This tool is a must-have.", rating: 5 },
  { name: "Vikram Singh", role: "Portfolio Manager, Chennai", text: "I've built a vault of 24 strategies with proven edge. The platform lets me iterate fast and share what works with my community.", rating: 5 },
  { name: "Anita Desai", role: "Retail Trader, Kolkata", text: "As someone who can't code, PatternIQ is a game-changer. I type what I want in English and get institutional-quality analysis back.", rating: 5 },
];

const TestimonialsSection = () => (
  <section className="py-24">
    <div className="container mx-auto px-6">
      <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-heading font-bold mb-4">Trusted by Traders Across India</h2>
        <p className="text-lg text-muted-foreground font-body">Real results from real traders on the platform.</p>
      </motion.div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {testimonials.map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="flex gap-1 mb-4">
              {Array.from({ length: t.rating }).map((_, j) => (
                <Star key={j} className="w-4 h-4 fill-primary text-primary" />
              ))}
            </div>
            <p className="text-sm text-muted-foreground font-body leading-relaxed mb-4">"{t.text}"</p>
            <div>
              <p className="text-sm font-heading font-bold text-foreground">{t.name}</p>
              <p className="text-xs text-muted-foreground font-body">{t.role}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default TestimonialsSection;
