import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export interface PricingCardProps {
  plan: string;
  title: string;
  description: string;
  price: number;
  features: string[];
  isPopular?: boolean;
  ctaText: string;
  onCtaClick: () => void;
  highlight?: boolean;
  loading?: boolean;
}

export function PricingCard({
  plan, title, description, price, features, isPopular, ctaText, onCtaClick, highlight = false, loading = false
}: PricingCardProps) {
  return (
    <Card className={`relative flex flex-col h-full ${highlight ? 'border-primary shadow-lg lg:scale-105 z-10 bg-card' : 'bg-card/50'}`}>
      {isPopular && (
        <div className="absolute top-0 right-1/2 transform translate-x-1/2 -translate-y-1/2">
          <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full shadow-sm">
            Most Popular
          </span>
        </div>
      )}
      <CardHeader className="text-center pt-8">
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription className="min-h-[40px] mt-2">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="mb-8 text-center">
          <span className="text-4xl font-extrabold">{price === 0 ? "Free" : `Rp ${price.toLocaleString('id-ID')}`}</span>
          {price > 0 && <span className="text-muted-foreground">/mo</span>}
        </div>
        <ul className="space-y-4 text-sm flex-1">
          {features.map((f: string, i: number) => (
            <li key={i} className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <span className="text-muted-foreground">{f}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full text-base py-6" 
          variant={highlight ? "default" : "outline"}
          onClick={onCtaClick}
          disabled={loading}
        >
          {loading ? "Processing..." : ctaText}
        </Button>
      </CardFooter>
    </Card>
  );
}
