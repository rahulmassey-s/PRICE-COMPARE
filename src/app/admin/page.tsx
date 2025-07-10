"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export default function AdminPage() {
  const [heading, setHeading] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('all'); // 'all', 'members', 'non-members'
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ heading, message, target, imageUrl }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: "Success!",
          description: `Notification sent successfully. ID: ${result.notificationId}`,
        });
        setHeading('');
        setMessage('');
        setImageUrl('');
      } else {
        throw new Error(result.error || 'Something went wrong');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send notification.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Send Push Notification</CardTitle>
          <CardDescription>
            Craft and send a notification to a specific group of users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="heading">Notification Heading</Label>
              <Input
                id="heading"
                placeholder="Enter the notification heading"
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Notification Message</Label>
              <Textarea
                id="message"
                placeholder="Enter your notification message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageUrl">Image URL (Optional)</Label>
              <Input
                id="imageUrl"
                placeholder="https://example.com/image.png"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
            
            <div className="space-y-3">
              <Label>Target Audience</Label>
              <RadioGroup
                value={target}
                onValueChange={setTarget}
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="r1" />
                  <Label htmlFor="r1">All Users</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="members" id="r2" />
                  <Label htmlFor="r2">Members Only</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="non-members" id="r3" />
                  <Label htmlFor="r3">Non-Members Only</Label>
                </div>
              </RadioGroup>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Sending...' : 'Send Notification'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 