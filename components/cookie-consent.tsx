"use client"

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { event, ANALYTICS_EVENTS } from '@/lib/analytics';

export function CookieConsentBanner(): React.ReactElement | null {
  const [mounted, setMounted] = useState(false);
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    setMounted(true);
    // Check if user has already made a choice
    const cookieChoice = localStorage.getItem('cookieConsent');
    if (cookieChoice) {
      setAccepted(cookieChoice === 'accepted');
    }
  }, []);

  if (!mounted || accepted !== null) return null;

  const handleAccept = (): void => {
    localStorage.setItem('cookieConsent', 'accepted');
    setAccepted(true);
    event({
      action: ANALYTICS_EVENTS.COOKIE_ACCEPT,
      category: 'Cookie Consent',
      label: 'Accepted',
    });
  };

  const handleDecline = (): void => {
    localStorage.setItem('cookieConsent', 'declined');
    setAccepted(false);
    event({
      action: ANALYTICS_EVENTS.COOKIE_DECLINE,
      category: 'Cookie Consent',
      label: 'Declined',
    });
  };

  return (
    <div className="fixed bottom-[4.5rem] left-0 right-0 px-8 z-50 animate-in fade-in slide-in-from-bottom duration-500">
      <div className="mx-auto max-w-[640px]">
        <Card className="!py-0">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                This website uses cookies to enhance the user experience and analyze site traffic.
              </p>
              <div className="flex gap-4 shrink-0">
                <Button
                  variant="outline"
                  onClick={handleDecline}
                >
                  Decline
                </Button>
                <Button
                  onClick={handleAccept}
                >
                  Accept
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 