import { AlertCircle, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const router = useRouter();

  if (daysLeft < 0) return null;

  return (
    <Alert className="mb-6 bg-amber-500/10 border-amber-500/50 text-amber-800 dark:text-amber-300">
      <Clock className="h-5 w-5 flex-shrink-0" />
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between w-full ml-2">
        <div>
          <AlertTitle className="text-lg font-semibold">Pro Trial Active</AlertTitle>
          <AlertDescription>
            You have <strong>{daysLeft} days left</strong> on your Pro trial. Upgrade now to avoid losing access to premium features.
          </AlertDescription>
        </div>
        <Button 
          variant="default" 
          className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
          onClick={() => {
            const el = document.getElementById('plans');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          View Plans
        </Button>
      </div>
    </Alert>
  );
}
