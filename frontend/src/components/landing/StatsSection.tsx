import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";

const stats = [
  { value: 5200, suffix: "+", label: "Active Traders" },
  { value: 1200000, suffix: "+", label: "Backtests Completed", format: true },
  { value: 98.7, suffix: "%", label: "Platform Uptime", decimal: true },
  { value: 47, suffix: "ms", label: "Avg. Signal Latency" },
  { value: 340, suffix: "+", label: "Strategies Shared" },
  { value: 12, suffix: "", label: "Markets Supported" },
];

const formatNumber = (n: number, format?: boolean) => {
  if (format) return (n / 1000000).toFixed(1) + "M";
  return n.toLocaleString();
};

const Counter = ({ target, suffix, format, decimal }: { target: number; suffix: string; format?: boolean; decimal?: boolean }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStarted(true); }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const duration = 1500;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) { setCount(target); clearInterval(timer); }
      else setCount(current);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [started, target]);

  return (
    <div ref={ref} className="text-center">
      <p className="text-4xl md:text-5xl font-heading font-bold text-foreground">
        {decimal ? count.toFixed(1) : format ? formatNumber(Math.floor(count), true) : Math.floor(count).toLocaleString()}{suffix}
      </p>
    </div>
  );
};

const StatsSection = () => (
  <section className="py-20 border-y border-border" style={{ background: 'var(--gradient-hero)' }}>
    <div className="container mx-auto px-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
        {stats.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="text-center"
          >
            <Counter target={s.value} suffix={s.suffix} format={s.format} decimal={s.decimal} />
            <p className="text-sm text-muted-foreground font-body mt-2">{s.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default StatsSection;
