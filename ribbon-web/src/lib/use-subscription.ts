import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export interface SubscriptionInfo {
  plan: 'free' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'event';
  status: 'active' | 'expired' | 'cancelled' | 'trial';
  expiresAt: string | null;
  daysRemaining: number;
  isActive: boolean;
}

const DEFAULT_SUB: SubscriptionInfo = {
  plan: 'free',
  status: 'expired',
  expiresAt: null,
  daysRemaining: 0,
  isActive: false,
};

export function useSubscription() {
  const [subscription, setSubscription] = useState<SubscriptionInfo>(DEFAULT_SUB);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSubscription(DEFAULT_SUB);
        return;
      }

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        // No subscription record → free/expired
        setSubscription(DEFAULT_SUB);
        return;
      }

      const now = new Date();
      const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
      const isActive = expiresAt ? expiresAt > now && data.status === 'active' : false;
      const daysRemaining = expiresAt
        ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      setSubscription({
        plan: data.plan,
        status: isActive ? 'active' : 'expired',
        expiresAt: data.expires_at,
        daysRemaining,
        isActive,
      });
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
      setSubscription(DEFAULT_SUB);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  return { subscription, loading, refresh: fetchSubscription };
}
