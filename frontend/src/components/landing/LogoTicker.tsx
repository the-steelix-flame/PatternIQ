import { motion } from "framer-motion";

const logos = ["NSE", "BSE", "NIFTY 50", "SENSEX", "MCX", "NASDAQ", "S&P 500", "NSE", "BSE", "NIFTY 50", "SENSEX", "MCX"];

const LogoTicker = () => (
  <section className="py-12 border-y border-border overflow-hidden">
    <div className="container mx-auto px-6 mb-6">
      <p className="text-center text-sm text-muted-foreground font-body uppercase tracking-widest">Supported Markets & Exchanges</p>
    </div>
    <div className="relative">
      <motion.div
        className="flex gap-16 items-center"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      >
        {logos.map((name, i) => (
          <span key={i} className="text-lg font-heading font-bold text-muted-foreground/40 whitespace-nowrap">{name}</span>
        ))}
      </motion.div>
    </div>
  </section>
);

export default LogoTicker;
