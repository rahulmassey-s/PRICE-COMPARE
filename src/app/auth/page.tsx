'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuth from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff } from 'lucide-react';

type AuthStep =
  | 'enter-mobile'
  | 'login'
  | 'signup'
  | 'verify-otp-signup'
  | 'reset-password'; // Simplified steps

export default function AuthPage() {
    const [step, setStep] = useState<AuthStep>('enter-mobile');
    const [mobile, setMobile] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    
    const { signInWithEmail, isCheckingAuth } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const handleMobileSubmit = async () => {
        if (!/^\d{10}$/.test(mobile)) {
            return toast({ title: 'Error', description: 'Please enter a valid 10-digit mobile number.', variant: 'destructive' });
        }
        setIsLoading(true);
        try {
            const res = await fetch('/api/auth-v2/check-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mobile }),
            });
            const data = await res.json();
            if (data.exists) {
                setStep('login');
            } else {
                setStep('signup');
            }
        } catch (error) {
            toast({ title: 'Error', description: 'Could not check user status.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendOtp = async (nextStep: AuthStep) => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/auth-v2/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mobile }),
            });
            const data = await res.json();
            if (res.ok) {
                setSessionId(data.details);
                setStep(nextStep);
                toast({ title: 'Success', description: 'OTP sent to your mobile number.' });
            } else {
                throw new Error(data.details || 'Failed to send OTP');
            }
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsLoading(true);
        const email = `+91${mobile}@smartbharat.com`;
        try {
            await signInWithEmail(email, password);
            toast({ title: 'Success!', description: "You're logged in." });
            await router.push('/');
        } catch (error: any) {
             toast({ title: 'Login Failed', description: 'Incorrect password. Please try again.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegistration = async () => {
        if (password.length < 6) return toast({ title: 'Error', description: "Password must be at least 6 characters.", variant: 'destructive' });
        if (password !== confirmPassword) return toast({ title: 'Error', description: "Passwords don't match.", variant: 'destructive' });
        
        setIsLoading(true);
        try {
            const res = await fetch('/api/auth-v2/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, mobile, otp, sessionId, password }),
            });
            const data = await res.json();
            if (res.ok) {
                toast({ title: 'Success!', description: 'Account created. Please log in.' });
                setPassword('');
                setConfirmPassword('');
                setStep('login'); // Go to login step after successful registration
            } else {
                throw new Error(data.details || 'Registration failed.');
            }
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordReset = async () => {
         if (password.length < 6) return toast({ title: 'Error', description: "Password must be at least 6 characters.", variant: 'destructive' });
         if (password !== confirmPassword) {
            return toast({ title: 'Error', description: "Passwords don't match.", variant: 'destructive' });
        }
        setIsLoading(true);
        try {
             const res = await fetch('/api/auth-v2/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mobile, otp, sessionId, newPassword: password }),
            });
            const data = await res.json();
             if (res.ok) {
                toast({ title: 'Success', description: 'Password has been reset. Please log in.' });
                setPassword('');
                setConfirmPassword('');
                setOtp('');
                setStep('login');
            } else {
                 throw new Error(data.details || 'Failed to reset password.');
            }
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };
    
    if (isCheckingAuth) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
                {step === 'enter-mobile' && (
                    <>
                        <h2 className="text-2xl font-bold text-center">Login or Signup</h2>
                        <div className="space-y-2">
                            <Label htmlFor="mobile">Mobile Number</Label>
                            <div className="flex items-center">
                                <span className="p-2 border border-r-0 rounded-l-md bg-gray-100 dark:bg-gray-700">+91</span>
                                <Input id="mobile" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="98765 43210" className="rounded-l-none"/>
                            </div>
                        </div>
                        <Button onClick={handleMobileSubmit} disabled={isLoading || mobile.length !== 10} className="w-full">
                            {isLoading ? 'Checking...' : 'Continue'}
                        </Button>
                    </>
                )}

                {step === 'login' && (
                    <form onSubmit={handleLogin}>
                        <h2 className="text-2xl font-bold text-center">Welcome Back!</h2>
                        <p className="text-center text-gray-600 dark:text-gray-400">Login to account with +91 {mobile}</p>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"/>
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3">
                                    {showPassword ? <EyeOff className="h-5 w-5 text-gray-400"/> : <Eye className="h-5 w-5 text-gray-400"/>}
                                </button>
                            </div>
                        </div>
                        <Button type="submit" disabled={isLoading} className="w-full">
                            {isLoading ? 'Logging in...' : 'Login'}
                        </Button>
                        <Button variant="link" onClick={() => handleSendOtp('reset-password')} className="w-full">Forgot Password?</Button>
                        <Button variant="link" onClick={() => { setMobile(''); setStep('enter-mobile'); }} className="w-full">Use another number</Button>
                    </form>
                )}
                
                {step === 'signup' && (
                    <>
                        <h2 className="text-2xl font-bold text-center">Create your Account</h2>
                        <p className="text-center text-gray-600 dark:text-gray-400">Creating account for +91 {mobile}</p>
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ram Kumar"/>
                        </div>
                        <Button onClick={() => handleSendOtp('verify-otp-signup')} disabled={isLoading || !name} className="w-full">
                           {isLoading ? 'Sending OTP...' : 'Verify Mobile'}
                        </Button>
                        <Button variant="link" onClick={() => setStep('login')} className="w-full">Already have an account? Login</Button>
                    </>
                )}

                {step === 'verify-otp-signup' && (
                    <>
                        <h2 className="text-2xl font-bold text-center">Create your Account</h2>
                        <p className="text-center text-gray-600 dark:text-gray-400">Verify to create account for +91 {mobile}</p>
                         <div className="space-y-2">
                            <Label htmlFor="otp">OTP</Label>
                            <Input id="otp" type="tel" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456"/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-password">Create Password</Label>
                             <div className="relative">
                                <Input id="new-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 characters"/>
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3">
                                    {showPassword ? <EyeOff className="h-5 w-5 text-gray-400"/> : <Eye className="h-5 w-5 text-gray-400"/>}
                                </button>
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm Password</Label>
                            <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••"/>
                        </div>
                        <Button onClick={handleRegistration} disabled={isLoading || otp.length !== 6} className="w-full">
                           {isLoading ? 'Creating Account...' : 'Create Account & Verify'}
                        </Button>
                        <Button variant="link" onClick={() => handleSendOtp(step)} className="w-full">Resend OTP</Button>
                    </>
                )}

                {step === 'reset-password' && (
                     <>
                        <h2 className="text-2xl font-bold text-center">Reset Password</h2>
                        <p className="text-center text-gray-600 dark:text-gray-400">Enter the OTP sent to +91 {mobile} and create a new password.</p>
                        <div className="space-y-2">
                            <Label htmlFor="otp">OTP</Label>
                            <Input id="otp" type="tel" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456"/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-password">New Password</Label>
                             <div className="relative">
                                <Input id="new-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 characters"/>
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3">
                                    {showPassword ? <EyeOff className="h-5 w-5 text-gray-400"/> : <Eye className="h-5 w-5 text-gray-400"/>}
                                </button>
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm Password</Label>
                            <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••"/>
                        </div>
                        <Button onClick={handlePasswordReset} disabled={isLoading || otp.length !== 6} className="w-full">
                           {isLoading ? 'Saving...' : 'Reset Password'}
                        </Button>
                        <Button variant="link" onClick={() => handleSendOtp(step)} className="w-full">Resend OTP</Button>
                     </>
                )}
            </div>
        </div>
    );
}
