import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Home, Plus, User, List, LogOut, Menu, Building, LayoutDashboard, Crown, AlertCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { motion } from 'framer-motion';
import '@/styles/portal-theme.css';
import UpgradeSidebar from './UpgradeSidebar';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Logo from '../../../public/Logo.svg';

type AgentSidebarProps = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
};

type MenuItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  highlight?: boolean;
  notification?: boolean;
  notificationContent?: string;
};

const AgentSidebar = ({ activeTab, setActiveTab }: AgentSidebarProps) => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [profile, setProfile] = React.useState<any>(null);
  const [paymentDueSoon, setPaymentDueSoon] = React.useState<boolean>(false);
  const [daysRemaining, setDaysRemaining] = React.useState<number | null>(null);

  // Returns a string like '1 year, 2 months, 5 days remaining' or '15 days remaining'
  const getTimeRemaining = (profile: any) => {
    if (!profile) return null;
    const endDateRaw = profile.subscription_details?.end_date || profile.subscription_end_date;
    if (!endDateRaw) return null;
    const endDate = new Date(endDateRaw);
    const today = new Date();
    // Use UTC for both
    let y1 = today.getUTCFullYear(), m1 = today.getUTCMonth(), d1 = today.getUTCDate();
    let y2 = endDate.getUTCFullYear(), m2 = endDate.getUTCMonth(), d2 = endDate.getUTCDate();
    let years = y2 - y1;
    let months = m2 - m1;
    let days = d2 - d1;
    if (days < 0) {
      months--;
      // Get days in previous month
      const prevMonth = new Date(y2, m2, 0);
      days += prevMonth.getUTCDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    // If expired
    if (years < 0 || (years === 0 && months === 0 && days < 0)) return 'Expired';
    let parts = [];
    if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
    if (days > 0 || (years === 0 && months === 0 && days === 0)) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    return parts.length > 0 ? parts.join(', ') + ' remaining' : 'Expired';
  };

  React.useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!error && profile) {
        setProfile(profile);
        
        // Check subscription status and end date
        const endDate = profile.subscription_end_date || profile.subscription_details?.end_date;
        if (endDate && profile.subscription_status === 'pro') {
          // Only set paymentDueSoon if the subscription is expiring within 7 days, based on the AccountInfo logic
          const paymentDate = new Date(endDate);
          const today = new Date();
          const utc1 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
          const utc2 = Date.UTC(paymentDate.getUTCFullYear(), paymentDate.getUTCMonth(), paymentDate.getUTCDate());
          const diffDays = Math.ceil((utc2 - utc1) / (1000 * 60 * 60 * 24));
          setPaymentDueSoon(diffDays >= 0 && diffDays <= 7);
          // daysRemaining will be handled by getTimeRemaining in render
        }
      }
    };

    fetchProfile();
  }, [user]);

  const menuItems: MenuItem[] = [
    { 
      id: 'listings', 
      label: 'My Listings', 
      icon: <List className="h-5 w-5" />,
      action: () => setActiveTab('listings') 
    },
    { 
      id: 'create', 
      label: 'Create New', 
      icon: <Plus className="h-5 w-5" />,
      action: () => setActiveTab('create') 
    },
    { 
      id: 'account', 
      label: 'Account Info', 
      icon: <User className="h-5 w-5" />,
      action: () => setActiveTab('account'),
      notification: paymentDueSoon,
      notificationContent: profile && profile.subscription_status === 'pro' && getTimeRemaining(profile) !== 'Expired'
        ? `Payment due: ${getTimeRemaining(profile)}`
        : profile?.subscription_status === 'pro' && getTimeRemaining(profile) === 'Expired'
        ? 'Subscription Expired' : undefined
    }
  ];

  // Only add upgrade menu item if user is not pro
  if (!profile?.subscription_status || profile.subscription_status === 'free') {
    menuItems.push({ 
      id: 'upgrade', 
      label: 'Upgrade to Pro', 
      icon: <Crown className="h-5 w-5" />,
      action: () => setActiveTab('upgrade'),
      highlight: true
    });
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full portal-sidebar">
      <div className="pt-6 border-b border-[var(--portal-border)] overflow-hidden">
        <div className="flex items-center justify-center h-28 w-full">
          <img src={Logo} alt="Agent Portal Logo" className="h-full w-full object-cover" />
        </div>
      </div>
      
      <div className="p-4 flex-1">
        <nav className="space-y-1">
          {menuItems.map((item, index) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                  activeTab === item.id 
                    ? 'bg-gold-500/20 text-gold-500 font-medium' 
                    : item.highlight
                    ? 'text-gold-500 hover:bg-gold-500/10'
                    : 'text-[var(--portal-text-secondary)] hover:bg-[var(--portal-bg-hover)]'
                }`}
                onClick={item.action}
              >
                <div className={`p-1.5 rounded-md ${
                  activeTab === item.id 
                    ? 'bg-gold-500 text-black' 
                    : item.highlight
                    ? 'bg-gold-500/20'
                    : 'bg-[var(--portal-card-bg)]'
                }`}>
                  {item.icon}
                </div>
                <span className="flex-1">{item.label}</span>
                {item.notification && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="h-6 w-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{item.notificationContent}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </motion.div>
          ))}
        </nav>
      </div>
      
      <div className="mt-auto p-5 border-t border-[var(--portal-border)]">
        <div className="p-4 mb-4 rounded-xl bg-[var(--portal-card-bg)] border border-[var(--portal-border)]">
          <div className="flex items-center space-x-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-gold-500/20 text-gold-500 flex items-center justify-center font-semibold">
              {profile?.first_name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="overflow-hidden flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate text-[var(--portal-text)]">
                  {profile?.first_name 
                    ? `${profile.first_name} ${profile.last_name}`
                    : user?.email}
                </p>
                {profile?.subscription_status === 'pro' && (
                  <span className="bg-gold-500/10 text-gold-500 text-xs font-semibold px-2 py-0.5 rounded-full border border-gold-500/20 whitespace-nowrap">
                    PRO
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-gold-500">Agent</p>
                {profile?.subscription_status === 'pro' && getTimeRemaining(profile) && (
                  <span className="text-xs text-[var(--portal-text-secondary)]">
                    • {getTimeRemaining(profile)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <Button
          variant="outline"
          className="w-full justify-start text-left border-[var(--portal-border)] text-red-500 hover:bg-red-500/10 hover:text-red-400"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-3" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  // Mobile bottom navigation - improved for better usability
  const MobileNav = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-[var(--portal-sidebar-bg)] border-t border-[var(--portal-border)] py-2 px-4 md:hidden z-10">
      <div className="flex justify-around items-center">
        {menuItems.slice(0, 3).map((item) => (
          <button
            key={item.id}
            className={`flex flex-col items-center p-2 rounded-lg transition-all ${
              activeTab === item.id ? 'text-gold-500' : 'text-[var(--portal-text-secondary)]'
            }`}
            onClick={item.action}
          >
            <div className={`p-1.5 rounded-lg ${activeTab === item.id ? 'bg-gold-500/20' : ''} relative`}>
              {item.icon}
              {item.notification && (
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-amber-500 rounded-full border-2 border-[var(--portal-sidebar-bg)]"></span>
              )}
            </div>
            <span className="text-xs mt-1 font-medium">{item.label}</span>
          </button>
        ))}
        {profile?.subscription_status !== 'pro' && (
          <button 
            className="flex flex-col items-center p-2 text-gold-500"
            onClick={() => setActiveTab('upgrade')}
          >
            <div className="p-1.5 bg-gold-500/20 rounded-lg">
              <Crown className="h-5 w-5" />
            </div>
            <span className="text-xs mt-1 font-medium">Upgrade</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="w-72 h-full shadow-lg border-r border-[var(--portal-border)] flex-shrink-0 hidden md:block overflow-hidden">
        <SidebarContent />
      </div>
      
      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </>
  );
};

export default AgentSidebar;
