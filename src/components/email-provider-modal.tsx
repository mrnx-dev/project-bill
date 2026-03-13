"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Mail, ArrowUpRight } from "lucide-react";
import { SiGmail } from "react-icons/si";

interface EmailModalData {
  to: string;
  subject: string;
  body: string;
}

interface EmailProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailData: EmailModalData | null;
}

/**
 * Modal to select email provider for manual fallback.
 * Note: Outlook and Yahoo icons use Lucide Mail as fallback to avoid react-icons versioning issues.
 */
export function EmailProviderModal({
  isOpen,
  onClose,
  emailData,
}: EmailProviderModalProps) {
  if (!emailData) return null;

  const { to, subject, body } = emailData;
  const encodedTo = encodeURIComponent(to);
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);

  // Provider Links
  const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedTo}&su=${encodedSubject}&body=${encodedBody}`;
  const outlookLink = `https://outlook.live.com/mail/0/deeplink/compose?to=${encodedTo}&subject=${encodedSubject}&body=${encodedBody}`;
  const yahooLink = `https://compose.mail.yahoo.com/?to=${encodedTo}&subj=${encodedSubject}&body=${encodedBody}`;
  const defaultLink = `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-amber-500" />
            Pilih Provider Email
          </DialogTitle>
          <DialogDescription>
            Kirim email ini secara manual. Kami telah menyiapkan draf email (termasuk link tagihan) untuk Anda.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 py-4">
          <Button variant="outline" className="justify-start h-12 relative" asChild>
            <a href={gmailLink} target="_blank" rel="noopener noreferrer" onClick={onClose}>
              <SiGmail className="mr-3 h-5 w-5 text-red-500" />
              Buka di Gmail (Web)
              <ArrowUpRight className="h-4 w-4 ml-auto text-muted-foreground opacity-50 absolute right-4" />
            </a>
          </Button>

          <Button variant="outline" className="justify-start h-12 relative" asChild>
            <a href={outlookLink} target="_blank" rel="noopener noreferrer" onClick={onClose}>
              <Mail className="mr-3 h-5 w-5 text-blue-500" />
              Buka di Outlook (Web)
              <ArrowUpRight className="h-4 w-4 ml-auto text-muted-foreground opacity-50 absolute right-4" />
            </a>
          </Button>

          <Button variant="outline" className="justify-start h-12 relative" asChild>
            <a href={yahooLink} target="_blank" rel="noopener noreferrer" onClick={onClose}>
              <Mail className="mr-3 h-5 w-5 text-purple-600" />
              Buka di Yahoo Mail (Web)
              <ArrowUpRight className="h-4 w-4 ml-auto text-muted-foreground opacity-50 absolute right-4" />
            </a>
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Atau
              </span>
            </div>
          </div>

          <Button variant="secondary" className="justify-start h-12 relative" asChild>
            <a href={defaultLink} onClick={onClose}>
              <Mail className="mr-3 h-5 w-5" />
              Buka Aplikasi Mail Bawaan Sistem
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
