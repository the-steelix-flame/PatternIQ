import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    desc: "Get started with the basics",
    features: ["5 backtests per day", "Community Hub access", "3 Arena quizzes daily", "Basic Anomaly alerts"],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "₹999",
    period: "/month",
    desc: "For serious retail traders",
    features: ["Unlimited backtests", "Full Anomaly Scanner", "Strategy Vault (50 slots)", "Risk Officer", "Priority support", "Advanced charts & exports"],
    cta: "Upgrade to Pro",
    highlighted: true,
  },
  {
    name: "Institutional",
    price: "Custom",
    period: "",
    desc: "For teams and hedge funds",
    features: ["Everything in Pro", "API access", "Multi-user dashboards", "Custom integrations", "Dedicated account manager", "SLA guarantee"],
    cta: "Contact Sales",
    highlighted: false,
  },
];

const PricingSection = () => (
  <section className="py-24">
    <div className="container mx-auto px-6">
      <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-heading font-bold mb-4">Simple, Transparent Pricing</h2>
        <p className="text-lg text-muted-foreground font-body">Start free. Upgrade when you're ready.</p>
      </motion.div>
      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {plans.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className={`rounded-xl border p-8 flex flex-col ${p.highlighted ? 'border-primary glow-border bg-card' : 'border-border bg-card'}`}
          >
            {p.highlighted && <span className="text-xs font-heading font-bold text-primary uppercase tracking-widest mb-4">Most Popular</span>}
            <h3 className="text-xl font-heading font-bold">{p.name}</h3>
            <div className="mt-4 mb-2">
              <span className="text-4xl font-heading font-bold">{p.price}</span>
              <span className="text-muted-foreground font-body text-sm">{p.period}</span>
            </div>
            <p className="text-sm text-muted-foreground font-body mb-6">{p.desc}</p>
            <ul className="space-y-3 mb-8 flex-1">
              {p.features.map((f, j) => (
                <li key={j} className="flex items-center gap-2 text-sm font-body text-muted-foreground">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Button className={`w-full font-heading font-semibold ${p.highlighted ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
              {p.cta}
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default PricingSection;
