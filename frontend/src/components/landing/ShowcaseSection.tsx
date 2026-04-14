import { motion } from "framer-motion";
import backtestingImg from "@/assets/backtesting.jpg";
import anomalyImg from "@/assets/anomaly-scanner.jpg";
import arenaImg from "@/assets/arena.jpg";

const showcases = [
  {
    tag: "AI Backtesting Engine",
    title: "Type Strategy. Get Results.",
    desc: "Describe your trading logic in plain English. Our AI converts it to optimized Python, runs it against years of historical data, and delivers institutional-grade PnL reports — in seconds.",
    bullets: ["Natural language strategy input", "Multi-timeframe analysis", "Sharpe ratio, drawdown & win-rate metrics"],
    img: backtestingImg,
    reverse: false,
  },
  {
    tag: "Anomaly Scanner",
    title: "Real-Time Intelligence",
    desc: "The Anomaly Scanner doesn't just look at price; it analyzes relative volume and standard deviations to find 'Smart Money' footprints before the crowd catches on.",
    bullets: ["Scans Nifty 50 every 60 seconds", "Volume spike & deviation detection", "Instant push notifications"],
    img: anomalyImg,
    reverse: true,
  },
  {
    tag: "The Arena",
    title: "Learn by Competing",
    desc: "Daily quizzes powered by live market events. Earn Reputation Points, unlock badges, and climb the global leaderboard. Trading education, gamified.",
    bullets: ["Daily market-based quizzes", "Global leaderboard & rankings", "Weekly Debrief tournaments"],
    img: arenaImg,
    reverse: false,
  },
];

const ShowcaseSection = () => (
  <section className="py-24 space-y-32">
    {showcases.map((s, i) => (
      <div key={i} className="container mx-auto px-6">
        <div className={`grid lg:grid-cols-2 gap-16 items-center ${s.reverse ? 'lg:direction-rtl' : ''}`}>
          <motion.div
            initial={{ opacity: 0, x: s.reverse ? 40 : -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className={s.reverse ? 'lg:order-2' : ''}
          >
            <span className="text-xs font-heading font-semibold uppercase tracking-widest text-primary mb-3 block">{s.tag}</span>
            <h3 className="text-3xl md:text-4xl font-heading font-bold mb-4">{s.title}</h3>
            <p className="text-muted-foreground font-body leading-relaxed mb-6">{s.desc}</p>
            <ul className="space-y-3">
              {s.bullets.map((b, j) => (
                <li key={j} className="flex items-center gap-3 text-sm font-body text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: s.reverse ? -40 : 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className={s.reverse ? 'lg:order-1' : ''}
          >
            <img src={s.img} alt={s.title} loading="lazy" className="rounded-xl border border-border w-full" style={{ boxShadow: 'var(--shadow-card)' }} />
          </motion.div>
        </div>
      </div>
    ))}
  </section>
);

export default ShowcaseSection;
