
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TicketPercent, Construction } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function OffersPage() {
  return (
    <div className="container mx-auto px-4 py-8 min-h-[calc(100vh-150px)] flex flex-col items-center justify-center text-center">
      <Card className="w-full max-w-md shadow-xl rounded-xl bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <CardHeader className="items-center">
          <div className="p-4 bg-primary/20 rounded-full mb-4 inline-block">
            <TicketPercent className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-foreground">
            Exciting Offers Coming Soon!
          </CardTitle>
          <CardDescription className="text-muted-foreground text-base pt-2">
            We're working hard to bring you the best deals on lab tests.
            Stay tuned for amazing discounts and packages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="relative w-full max-w-xs mx-auto aspect-square">
            <Image
              src="https://placehold.co/300x300.png"
              alt="Coming Soon Illustration"
              fill
              style={{ objectFit: 'contain' }}
              className="rounded-lg"
              data-ai-hint="coming soon deals"
            />
             <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-lg">
                <Construction className="h-16 w-16 text-white/70" />
            </div>
          </div>
          <p className="text-muted-foreground">
            In the meantime, you can explore our available lab tests or create a custom package.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="flex-1">
              <Link href="/lab-tests">Explore Lab Tests</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="flex-1">
              <Link href="/">Go to Homepage</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
