import { GitBranch, MessageCircle, LinkIcon, PlayCircle } from "lucide-react";

const footerLinks = [
  { heading: "Product", links: ["Features", "Pricing", "Arena", "Anomaly Scanner", "Risk Officer", "API Docs"] },
  { heading: "Company", links: ["About Us", "Careers", "Blog", "Press Kit", "Contact"] },
  { heading: "Resources", links: ["Documentation", "Tutorials", "Community", "Status Page", "Changelog"] },
  { heading: "Legal", links: ["Privacy Policy", "Terms of Service", "Cookie Policy", "Security"] },
];

const Footer = () => (
  <footer className="border-t border-border bg-card">
    <div className="container mx-auto px-6 py-16">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-12">
        <div className="col-span-2 md:col-span-1">
          <h3 className="text-2xl font-heading font-bold mb-2">Pattern<span className="text-gradient">IQ</span></h3>
          <p className="text-sm text-muted-foreground font-body mb-6">AI-Native Trading OS for the modern retail trader.</p>
          <div className="flex gap-4">
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><MessageCircle className="w-5 h-5" /></a>
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><GitBranch className="w-5 h-5" /></a>
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><LinkIcon className="w-5 h-5" /></a>
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><PlayCircle className="w-5 h-5" /></a>
          </div>
        </div>
        {footerLinks.map((col) => (
          <div key={col.heading}>
            <h4 className="font-heading font-semibold text-sm mb-4">{col.heading}</h4>
            <ul className="space-y-3">
              {col.links.map((link) => (
                <li key={link}>
                  <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">{link}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-sm text-muted-foreground font-body">© 2026 PatternIQ. All rights reserved.</p>
        <p className="text-sm text-muted-foreground font-body">Made with ❤️ in India</p>
      </div>
    </div>
  </footer>
);

export default Footer;
