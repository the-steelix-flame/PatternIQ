import { motion } from "framer-motion";
import { BarChart3, Brain, Users, Zap, Shield, Archive, TrendingUp, Globe, Bell } from "lucide-react";

const features = [
  { icon: BarChart3, title: "AI Backtesting", desc: "No more coding. Type 'Buy if RSI < 30 and price is near support' and our AI generates the Python logic, fetches Nifty data, and gives you a professional PnL report.", color: "text-primary" },
  { icon: Brain, title: "The Arena", desc: "Gamify your learning. Take daily quizzes based on real-time market news. Earn Reputation Points (RP) and climb the global leaderboard.", color: "text-primary" },
  { icon: Users, title: "Community Hub", desc: "Found a 70% win-rate strategy? Share it with a single click. Upvote the best insights and participate in the Weekly Debrief rounds.", color: "text-primary" },
  { icon: Zap, title: "Anomaly Scanner", desc: "Our background engine scans the Nifty 50 every minute for unusual volume spikes or price movements, alerting you before the trend goes mainstream.", color: "text-primary" },
  { icon: Shield, title: "Risk Officer", desc: "Connect your portfolio and let our AI Risk Officer audit your exposure. It detects sector over-concentration and correlation risks automatically.", color: "text-primary" },
  { icon: Archive, title: "Strategy Vault", desc: "Save your best performing tests to your profile. Build a library of proven mathematical edges over time.", color: "text-primary" },
  { icon: TrendingUp, title: "Smart Alerts", desc: "Get notified when your watched patterns form in real-time. Custom alerts based on technical indicators, volume, and price action.", color: "text-primary" },
  { icon: Globe, title: "Multi-Market Access", desc: "From NSE to NASDAQ — scan and backtest strategies across global markets with unified data feeds and cross-market analysis.", color: "text-primary" },
  { icon: Bell, title: "Sentiment Radar", desc: "AI-powered news sentiment analysis aggregating data from 500+ sources, social media, and institutional filings in real-time.", color: "text-primary" },
];

const FeaturesGrid = () => (
  <section className="py-24 relative">
    <div className="container mx-auto px-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-16"
      >
        <h2 className="text-4xl md:text-5xl font-heading font-bold mb-4">What can you do on PatternIQ?</h2>
        <p className="text-lg text-muted-foreground font-body max-w-2xl mx-auto">A complete ecosystem for the modern retail trader. Nine powerful tools, one unified platform.</p>
      </motion.div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="group rounded-xl border border-border bg-card p-6 hover:border-primary/30 transition-all duration-300"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <f.icon className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-heading font-bold mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground font-body leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default FeaturesGrid;
