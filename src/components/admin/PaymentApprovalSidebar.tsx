import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, ExternalLink, AlertCircle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Database response types
interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  career: string | null;
}

interface SubscriptionRequest {
  id: string;
  user_id: string;
  plan_id: string;
  receipt_path: string;
  status: 'pending' | 'approved' | 'rejected';
  amount: number;
  duration: string;
  listings_per_month: number;
  created_at: string;
  updated_at: string;
}

// Component state type
interface PaymentRequest {
  id: string;
  user_id: string;
  receipt_url: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  amount: number;
  plan_type: string;
  user_profile?: Profile;
}

const PaymentApprovalSidebar = () => {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedReceipt, setExpandedReceipt] = useState<string | null>(null);
  const [objectUrls, setObjectUrls] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    fetchPaymentRequests();
    // Cleanup object URLs when component unmounts
    return () => {
      objectUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const getReceiptUrl = async (path: string) => {
    try {
      const { data } = await supabase
        .storage
        .from('receipts')
        .getPublicUrl(path);

      return data.publicUrl;
    } catch (error) {
      console.error('Error getting receipt URL:', error);
      return null;
    }
  };

  const fetchPaymentRequests = async () => {
    try {
      // Check current user's role from user_roles table
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Error getting user:', userError);
        return;
      }

      // Get user role from user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id)
        .single();

      if (roleError) {
        console.error('Error fetching user role:', roleError);
        return;
      }

      console.log('User role from database:', roleData?.role);

      if (!roleData?.role || roleData.role !== 'super_admin') {
        console.error('User does not have admin privileges. Current role:', roleData?.role);
        return;
      }
      
      // First get subscription requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('subscription_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (requestsError) {
        console.error('Error fetching requests:', requestsError);
        throw requestsError;
      }

      console.log('Raw subscription requests:', requestsData);

      if (!requestsData || requestsData.length === 0) {
        console.log('No subscription requests found in database');
        setRequests([]);
        setLoading(false);
        return;
      }

      // Get all unique user IDs from the requests
      const userIds = [...new Set(requestsData.map(r => r.user_id))];

      // Fetch profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }

      // Create a map of profiles by user ID
      const profilesMap = new Map(profilesData?.map(profile => [profile.id, profile]) || []);

      // Transform the requests with receipt URLs and profile data
      const transformedRequests = await Promise.all(requestsData.map(async (request: SubscriptionRequest) => {
        try {
          console.log('Processing request:', request);
          console.log('Receipt path:', request.receipt_path);
          
          // First check if we can download the receipt
          const { data: receiptData, error: receiptError } = await supabase
            .storage
            .from('receipts')
            .download(request.receipt_path);

          if (receiptError) {
            console.error('Error downloading receipt:', receiptError);
            // If download fails, try getting public URL directly
            const { data: urlData } = await supabase
              .storage
              .from('receipts')
              .getPublicUrl(request.receipt_path);

            console.log('Receipt public URL:', urlData.publicUrl);
            
            return {
              id: request.id,
              user_id: request.user_id,
              receipt_url: urlData.publicUrl,
              status: request.status,
              created_at: request.created_at,
              amount: request.amount,
              plan_type: `${request.listings_per_month} listings/${request.duration}`,
              user_profile: profilesMap.get(request.user_id)
            };
          }

          // If download succeeds, create object URL
          const receiptUrl = URL.createObjectURL(receiptData);
          setObjectUrls(prev => [...prev, receiptUrl]);
          console.log('Created receipt URL:', receiptUrl);

          return {
            id: request.id,
            user_id: request.user_id,
            receipt_url: receiptUrl,
            status: request.status,
            created_at: request.created_at,
            amount: request.amount,
            plan_type: `${request.listings_per_month} listings/${request.duration}`,
            user_profile: profilesMap.get(request.user_id)
          };
        } catch (error) {
          console.error('Error processing request:', request.id, error);
          return null;
        }
      }));

      // Filter out any null values from failed transformations
      const validRequests = transformedRequests.filter(r => r !== null) as PaymentRequest[];
      
      console.log('Final transformed requests:', validRequests);
      setRequests(validRequests);
    } catch (error) {
      console.error('Error in fetchPaymentRequests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string, userId: string) => {
    setProcessing(requestId);
    try {
      // First get the subscription request details
      const { data: requestData, error: requestError } = await supabase
        .from('subscription_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (requestError) {
        console.error('Error fetching request details:', requestError);
        throw requestError;
      }

      // Update subscription_requests status
      const { error: updateError } = await supabase
        .from('subscription_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Calculate subscription end date based on duration
      const subscriptionEndDate = new Date();
      if (requestData.duration === 'monthly') {
        subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);
      } else if (requestData.duration === 'yearly') {
        subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);
      }

      // Update user's profile with pro status and subscription details
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          subscription_status: 'pro',
          subscription_details: {
            plan_id: requestData.plan_id,
            listings_per_month: requestData.listings_per_month,
            duration: requestData.duration,
            amount: requestData.amount,
            start_date: new Date().toISOString(),
            end_date: subscriptionEndDate.toISOString(),
            subscription_request_id: requestId
          },
          listing_limit: {
            type: 'monthly',
            value: requestData.listings_per_month,
            reset_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()
          }
        })
        .eq('id', userId);

      if (profileError) {
        console.error('Error updating profile:', profileError);
        throw profileError;
      }

      // Refresh the requests list
      await fetchPaymentRequests();
    } catch (error) {
      console.error('Error approving payment:', error);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const { error } = await supabase
        .from('subscription_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;
      await fetchPaymentRequests();
    } catch (error) {
      console.error('Error rejecting payment:', error);
    } finally {
      setProcessing(null);
    }
  };

  const renderPaymentRequest = (request: PaymentRequest) => (
    <div key={request.id} className="border rounded-lg p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold">
            {request.user_profile?.first_name} {request.user_profile?.last_name}
          </h3>
          <p className="text-sm text-gray-500">
            {request.user_profile?.phone_number} • {request.user_profile?.career}
          </p>
          <p className="text-sm font-medium mt-1">
            Plan: {request.plan_type}
          </p>
          <p className="text-sm font-medium">
            Amount: ${request.amount}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Submitted: {format(new Date(request.created_at), 'MMM d, yyyy')}
          </p>
        </div>
        <Badge variant={
          request.status === 'pending' 
            ? 'outline' 
            : request.status === 'approved' 
              ? 'secondary'
              : 'destructive'
        }>
          {request.status}
        </Badge>
      </div>

      {request.receipt_url && (
        <div className="mt-2">
          <button
            onClick={() => setExpandedReceipt(expandedReceipt === request.id ? null : request.id)}
            className="text-sm text-blue-600 hover:underline"
          >
            {expandedReceipt === request.id ? 'Hide Receipt' : 'View Receipt'}
          </button>
          {expandedReceipt === request.id && (
            <div className="mt-2 relative">
              <img
                src={request.receipt_url}
                alt="Receipt"
                className="max-w-full rounded-lg shadow-lg"
                style={{ maxHeight: '400px', objectFit: 'contain' }}
              />
            </div>
          )}
        </div>
      )}

      {request.status === 'pending' && (
        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleApprove(request.id, request.user_id)}
            disabled={processing === request.id}
          >
            {processing === request.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                Approve
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleReject(request.id)}
            disabled={processing === request.id}
          >
            {processing === request.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-gold-500" />
      </div>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved');
  const rejectedRequests = requests.filter(r => r.status === 'rejected');

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-2xl font-bold">Payment Approvals</h2>
      
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            Pending
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            Approved
            {approvedRequests.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {approvedRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center gap-2">
            Rejected
            {rejectedRequests.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {rejectedRequests.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pendingRequests.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              No pending payment requests
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map(renderPaymentRequest)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approved">
          {approvedRequests.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              No approved payment requests
            </div>
          ) : (
            <div className="space-y-4">
              {approvedRequests.map(renderPaymentRequest)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rejected">
          {rejectedRequests.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              No rejected payment requests
            </div>
          ) : (
            <div className="space-y-4">
              {rejectedRequests.map(renderPaymentRequest)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaymentApprovalSidebar; 