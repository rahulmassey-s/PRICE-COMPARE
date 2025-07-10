'use client';

import { useEffect } from 'react';
import useAuth from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Mail, User as UserIcon, Phone, Edit2 } from 'lucide-react';

export default function AccountPage() {
    const { user, isCheckingAuth, signOut } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isCheckingAuth && !user) {
            router.replace('/auth');
        }
    }, [user, isCheckingAuth, router]);

    // This effect will try to reload user data if displayName is missing
    useEffect(() => {
        if (user && !user.displayName) {
            user.reload();
        }
    }, [user]);

    if (isCheckingAuth || !user) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    const getInitials = (name: string | null) => {
        if (!name) return 'U';
        const names = name.split(' ');
        if (names.length > 1) {
            return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
        }
        return names[0][0].toUpperCase();
    };

    return (
        <div className="container mx-auto p-4">
            <Card className="max-w-lg mx-auto">
                <CardHeader className="text-center">
                    <Avatar className="w-24 h-24 mx-auto mb-4 border-2 border-primary">
                        <AvatarImage src={user.photoURL || ''} alt={user.displayName || 'User'} />
                        <AvatarFallback className="text-3xl">{getInitials(user.displayName)}</AvatarFallback>
                    </Avatar>
                    <CardTitle className="text-2xl">{user.displayName || user.phoneNumber}</CardTitle>
                    <p className="text-muted-foreground">Manage your profile, view booking history, and more.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Accordion type="single" collapsible defaultValue="item-1">
                        <AccordionItem value="item-1">
                            <AccordionTrigger>My Details</AccordionTrigger>
                            <AccordionContent className="space-y-3">
                                <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted">
                                    <Mail className="h-5 w-5 text-muted-foreground" />
                                    <span>{user.email}</span>
                                </div>
                                <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted">
                                    <Phone className="h-5 w-5 text-muted-foreground" />
                                    <span>{user.phoneNumber || 'Not set'}</span>
                                </div>
                                <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted">
                                    <UserIcon className="h-5 w-5 text-muted-foreground" />
                                    <span>{user.displayName || 'Not set'}</span>
                                </div>
                                <Button variant="ghost" className="w-full justify-start text-sm">
                                    <Edit2 className="h-4 w-4 mr-2" />
                                    Edit Details
                                </Button>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2">
                            <AccordionTrigger>Booking History</AccordionTrigger>
                            <AccordionContent>
                                You have no booking history yet.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-3">
                            <AccordionTrigger>My Offers</AccordionTrigger>
                            <AccordionContent>
                                No offers available for you at the moment.
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                    <Button onClick={signOut} variant="destructive" className="w-full">
                        Logout
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
