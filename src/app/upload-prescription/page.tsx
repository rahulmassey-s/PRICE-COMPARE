
'use client';

import { useState, useEffect, type ChangeEvent, type FormEvent, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User as FirebaseAuthUser } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UploadCloud, User as UserIcon, Phone as PhoneIcon, FileImage, AlertTriangle, CheckCircle2, PartyPopper } from 'lucide-react';
import { auth } from '@/lib/firebase/client';
import { savePrescriptionToFirestore } from '@/lib/firebase/firestoreService';
import Link from 'next/link';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

// Cloudinary Configuration
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "dvgilt12w";
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "my-preset";
const CLOUDINARY_API_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export default function UploadPrescriptionPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isConfigValid, setIsConfigValid] = useState(false);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [successDialogUserName, setSuccessDialogUserName] = useState('');


  const checkCloudinaryConfig = useCallback(() => {
    if (
      CLOUDINARY_CLOUD_NAME &&
      typeof CLOUDINARY_CLOUD_NAME === 'string' && CLOUDINARY_CLOUD_NAME.trim() !== '' && CLOUDINARY_CLOUD_NAME !== "YOUR_CLOUD_NAME" &&
      CLOUDINARY_UPLOAD_PRESET &&
      typeof CLOUDINARY_UPLOAD_PRESET === 'string' && CLOUDINARY_UPLOAD_PRESET.trim() !== '' &&
      CLOUDINARY_UPLOAD_PRESET !== 'YOUR_UNSIGNED_UPLOAD_PRESET_NAME' 
    ) {
      setIsConfigValid(true);
      return true;
    } else {
      setIsConfigValid(false);
      console.error(
        `Cloudinary configuration incomplete or uses placeholder. Ensure NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET are correctly set in your environment. ` +
        `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET must be a non-empty string representing your actual UNSIGNED upload preset and not a placeholder. ` +
        `Current Cloud Name: "${CLOUDINARY_CLOUD_NAME || 'Not Set'}", Current Upload Preset: "${CLOUDINARY_UPLOAD_PRESET || 'Not Set'}"`
      );
      toast({
        title: "Admin Configuration Error",
        description: "Prescription upload service is not configured. Please contact support. (Admin: Check Cloudinary env vars and ensure preset is for UNSIGNED uploads and not a placeholder).",
        variant: "destructive",
        duration: 10000,
      });
      return false;
    }
  }, [toast]);


  useEffect(() => {
    checkCloudinaryConfig();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthLoading(true);
      if (user) {
        setFirebaseUser(user);
        if (!userName) setUserName(user.displayName || '');
        if (!userPhone) setUserPhone(user.phoneNumber || '');
      } else {
        setFirebaseUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [checkCloudinaryConfig, userName, userPhone]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
      if (!allowedTypes.includes(selectedFile.type)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload an image (JPEG, PNG, GIF) or a PDF file.",
          variant: "destructive",
        });
        setFile(null);
        if (e.target) e.target.value = "";
        return;
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please upload a file smaller than 5MB.",
          variant: "destructive",
        });
        setFile(null);
        if (e.target) e.target.value = "";
        return;
      }
      setFile(selectedFile);
    } else {
      setFile(null);
    }
  };

  const uploadToCloudinary = async (selectedFile: File): Promise<string | null> => {
     if (!checkCloudinaryConfig()) return null; 

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET as string); 

    try {
      const response = await fetch(CLOUDINARY_API_URL, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.secure_url) {
        return data.secure_url;
      } else {
        let errorMessage = data.error?.message || 'Cloudinary upload failed. Unknown error.';
        if (data.error?.message?.includes('unsigned')) {
             errorMessage = `Cloudinary Configuration Error: The upload preset "${CLOUDINARY_UPLOAD_PRESET}" is not configured for UNSIGNED uploads. Please verify this preset in your Cloudinary dashboard and ensure "Signing Mode" is set to "Unsigned".`;
        } else if (data.error?.message?.includes('api_key') || data.error?.message?.includes('Cloud name')) {
            errorMessage = `Cloudinary Configuration Error: Invalid Cloud Name ("${CLOUDINARY_CLOUD_NAME}") or API setup issue. Please check your NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME.`;
        } else if (data.error?.message?.includes('rate_limit')){
            errorMessage = "Cloudinary upload failed: You've exceeded the upload rate limit. Please try again later.";
        }
        console.error("Cloudinary specific error:", data.error);
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error("Cloudinary upload error: ", error);
      let description = "Cloudinary upload failed. Please try again.";
      if (error.message) {
        if (error.message.toLowerCase().includes('failed to fetch')) {
          description = `Cloudinary Upload Error: Failed to connect. Please check your internet connection, VPN/proxy settings, or browser extensions (like ad-blockers) that might be blocking the request.`;
        } else if (error.message.includes("unsigned")) {
          description = `Cloudinary Configuration Error: The upload preset "${CLOUDINARY_UPLOAD_PRESET}" is not configured for UNSIGNED uploads. Please verify this preset in your Cloudinary dashboard.`;
        } else if (error.message.includes("api_key") || error.message.includes("Cloud name")) {
          description = `Cloudinary Configuration Error: Invalid Cloud Name ("${CLOUDINARY_CLOUD_NAME}") or API setup issue.`;
        } else if (error.message.includes("rate_limit")) {
          description = "Cloudinary upload failed: You've exceeded the upload rate limit. Please try again later.";
        } else {
           description = `Cloudinary Upload Error: ${error.message}`;
        }
      }
      toast({ title: 'Cloudinary Upload Failed', description, variant: 'destructive', duration: 8000 });
      return null;
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!checkCloudinaryConfig()) return;

    if (!file || !userName.trim() || !userPhone.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please provide your name, phone number, and select a prescription file.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const imageUrl = await uploadToCloudinary(file);
      if (imageUrl) {
        const prescriptionId = await savePrescriptionToFirestore(userName, userPhone, imageUrl, firebaseUser);
        if (prescriptionId) {
          setSuccessDialogUserName(userName.split(' ')[0] || 'Valued Customer');
          setIsSuccessDialogOpen(true);
          setFile(null);
           const fileInput = document.getElementById('prescriptionFile') as HTMLInputElement;
           if(fileInput) fileInput.value = '';
          if(!firebaseUser){ 
            setUserName('');
            setUserPhone('');
          }
        } else {
           toast({
            title: 'Upload Failed',
            description: 'Could not save prescription details after upload. Please try again.',
            variant: 'destructive',
          });
        }
      }
    } catch (error: any) {
      console.error("Error in submission process:", error);
      let description = error.message || 'An unexpected error occurred during upload. Please try again.';
      if (error.name === 'FirebaseError' && error.code === 'unavailable') {
        description = 'Could not save prescription: Connection to our servers failed. Please check your internet connection and try again.';
      } else if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
        description = 'Upload Error: Failed to connect to upload service. Check your internet connection, VPN/proxy, or browser extensions.';
      }
      toast({
        title: 'Upload Failed',
        description: description,
        variant: 'destructive',
        duration: 8000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8 flex justify-center">
        <Card className="w-full max-w-lg shadow-xl rounded-xl">
          <CardHeader className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary mb-4">
              <UploadCloud className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">Upload Prescription</CardTitle>
            <CardDescription>
              Fill in your details and upload your prescription. We&apos;ll get in touch with you.
            </CardDescription>
          </CardHeader>
          <CardContent>
          {!isConfigValid && (
              <Alert variant="destructive" className="mb-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Configuration Incomplete</AlertTitle>
                <AlertDescription>
                  The prescription upload service is not fully configured. Please contact support or try other booking methods.
                  Admin: Ensure NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET (must be for an <strong>UNSIGNED</strong> preset, not a placeholder) are set in your environment variables.
                  Current Preset: &quot;{CLOUDINARY_UPLOAD_PRESET || 'Not Set'}&quot;.
                </AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="userName" className="flex items-center">
                  <UserIcon className="mr-2 h-4 w-4 text-muted-foreground" /> Full Name
                </Label>
                <Input
                  id="userName"
                  type="text"
                  placeholder="Enter your full name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                  disabled={isLoading || !isConfigValid}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userPhone" className="flex items-center">
                  <PhoneIcon className="mr-2 h-4 w-4 text-muted-foreground" /> Phone Number
                </Label>
                <Input
                  id="userPhone"
                  type="tel"
                  placeholder="Enter your phone number"
                  value={userPhone}
                  onChange={(e) => setUserPhone(e.target.value)}
                  required
                  disabled={isLoading || !isConfigValid}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prescriptionFile" className="flex items-center">
                  <FileImage className="mr-2 h-4 w-4 text-muted-foreground" /> Prescription File
                </Label>
                <Input
                  id="prescriptionFile"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,application/pdf"
                  onChange={handleFileChange}
                  required
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  disabled={isLoading || !isConfigValid}
                />
                {file && <p className="text-xs text-muted-foreground mt-1">Selected: {file.name}</p>}
              </div>
              <Button type="submit" className="w-full py-3 text-base" disabled={isLoading || !file || !isConfigValid}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Uploading...
                  </>
                ) : (
                  <>
                    <UploadCloud className="mr-2 h-5 w-5" /> Upload Prescription
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col items-center text-center text-sm text-muted-foreground pt-6">
              <p>Alternatively, you can book tests directly or contact us.</p>
              <Button variant="link" asChild className="mt-1 text-primary">
                  <Link href="/">Back to Home</Link>
              </Button>
          </CardFooter>
        </Card>
      </div>

      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl shadow-2xl overflow-hidden p-0">
          <div className="bg-gradient-to-br from-primary to-teal-500 p-6 text-center">
            <PartyPopper className="h-16 w-16 text-primary-foreground mx-auto animate-success-icon-pop mb-4" />
            <DialogTitle className="text-2xl font-bold text-primary-foreground">
              Thank You, {successDialogUserName}!
            </DialogTitle>
          </div>
          <div className="p-6 space-y-3 text-center">
            <DialogDescription className="text-base text-muted-foreground">
              Your prescription has been successfully submitted!
            </DialogDescription>
            <p className="text-sm text-muted-foreground">
              Our team will review it shortly and contact you to discuss the next steps and the best available prices for your tests. We appreciate you choosing us!
            </p>
          </div>
          <DialogFooter className="p-4 bg-muted/50">
            <Button onClick={() => setIsSuccessDialogOpen(false)} className="w-full">Okay, Got it!</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        @keyframes successIconPop {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          80% { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-success-icon-pop {
          animation: successIconPop 0.6s ease-out forwards;
        }
      `}</style>
    </>
  );
}

