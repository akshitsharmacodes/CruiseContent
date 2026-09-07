import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Send, Users, FileText, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function WhatsAppCampaignPage() {
  const { hasPermission } = useAuth();
  const canCreateCampaign = hasPermission('WHATSAPP_CAMPAIGN', 'CAMPAIGNS', 'CREATE');
  const canSendCampaign = hasPermission('WHATSAPP_CAMPAIGN', 'CAMPAIGNS', 'SEND');
  const canViewContacts = hasPermission('WHATSAPP_CAMPAIGN', 'CONTACTS', 'VIEW');
  const canViewTemplates = hasPermission('WHATSAPP_CAMPAIGN', 'TEMPLATES', 'VIEW');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">WhatsApp Campaign</h2>
          <p className="text-muted-foreground">
            Launch, monitor, and automate WhatsApp audience campaigns.
          </p>
        </div>
        {canCreateCampaign && (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground mt-1">Ready for broadcast</p>
          </CardContent>
        </Card>

        {canViewContacts && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Audience Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">Verified phone numbers</p>
            </CardContent>
          </Card>
        )}

        {canViewTemplates && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Message Templates</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">Approved by Meta</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Management</CardTitle>
          <CardDescription>
            Manage and schedule your targeted WhatsApp outreach.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border border-dashed rounded-lg">
            <MessageSquare className="h-10 w-10 mb-2 opacity-50" />
            <p className="font-medium text-sm">No campaigns scheduled</p>
            <p className="text-xs mt-1">Create your first campaign to begin messaging audiences.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
