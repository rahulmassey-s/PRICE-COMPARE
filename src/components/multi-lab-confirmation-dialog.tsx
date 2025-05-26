
'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface MultiLabConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  labs: string[];
  onConfirm: () => void;
}

export default function MultiLabConfirmationDialog({
  isOpen,
  onOpenChange,
  labs,
  onConfirm,
}: MultiLabConfirmationDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-xl shadow-2xl">
        <AlertDialogHeader>
          <div className="flex justify-center mb-4">
            <AlertTriangle className="h-12 w-12 text-amber-500 animate-pulse" />
          </div>
          <AlertDialogTitle className="text-xl font-semibold text-center text-foreground">
            Multiple Labs Involved
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-center text-muted-foreground pt-2">
              <p>
                Please be aware: Your selected tests will be processed by <strong className="text-foreground">{labs.length > 1 ? `${labs.length} different labs` : 'the following lab'}</strong>, as listed below.
              </p>
              <ul className="mt-3 list-disc list-inside text-left text-sm space-y-1 pl-4 mx-auto max-w-xs sm:max-w-sm">
                {labs.map((lab) => (
                  <li key={lab} className="font-medium text-foreground">{lab}</li>
                ))}
              </ul>
              {/* Removed the sentence: "This means you might need to coordinate with each lab separately for sample collection or visits." */}
              <p className="font-medium mt-4">Do you wish to proceed?</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="grid grid-cols-2 gap-3 pt-6">
          <AlertDialogCancel asChild>
            <Button variant="outline" className="py-3 text-base">No, Cancel</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={onConfirm} className="bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-base">
              <CheckCircle className="mr-2 h-5 w-5" />
              Yes, Proceed
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

