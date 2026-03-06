import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Key, Settings, Users, Ticket, Plus, Save, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useIsAdmin } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const AdminPage = () => {
  const isAdmin = useIsAdmin();
  const { user } = useAuth();
  const [couponCode, setCouponCode] = useState('');
  const [couponCoins, setCouponCoins] = useState('');
  const [couponRam, setCouponRam] = useState('');
  const [couponCpu, setCouponCpu] = useState('');
  const [couponDisk, setCouponDisk] = useState('');
  const [couponSlots, setCouponSlots] = useState('');
  const [couponUses, setCouponUses] = useState('');
  const [coupons, setCoupons] = useState<any[]>([]);

  useEffect(() => {
    if (isAdmin) loadCoupons();
  }, [isAdmin]);

  const loadCoupons = async () => {
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    if (data) setCoupons(data);
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Access Denied</h2>
        <p className="text-muted-foreground">You need admin privileges to access this page.</p>
      </div>
    );
  }

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode) {
      toast.error('Please enter a coupon code');
      return;
    }
    try {
      const { error } = await supabase.from('coupons').insert({
        code: couponCode.toUpperCase(),
        coins_reward: parseInt(couponCoins) || 0,
        ram_reward: parseInt(couponRam) || 0,
        cpu_reward: parseInt(couponCpu) || 0,
        disk_reward: parseInt(couponDisk) || 0,
        slots_reward: parseInt(couponSlots) || 0,
        max_uses: parseInt(couponUses) || null,
      });
      if (error) throw error;
      toast.success('Coupon created!');
      setCouponCode('');
      setCouponCoins('');
      setCouponRam('');
      setCouponCpu('');
      setCouponDisk('');
      setCouponSlots('');
      setCouponUses('');
      loadCoupons();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
        <p className="text-muted-foreground">Configure your Pterodactyl panel and manage resources.</p>
      </div>

      <Tabs defaultValue="coupons" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="coupons" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Ticket className="w-4 h-4 mr-2" />
            Coupons
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Users className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="coupons">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-card rounded-xl border border-border p-6 card-shadow space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Create Coupon</h2>
              <form onSubmit={handleCreateCoupon} className="space-y-4">
                <div className="space-y-2">
                  <Label>Coupon Code</Label>
                  <Input placeholder="WELCOME2024" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} className="bg-secondary border-border font-mono" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Coins</Label>
                    <Input type="number" placeholder="100" value={couponCoins} onChange={(e) => setCouponCoins(e.target.value)} className="bg-secondary border-border" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">RAM (MB)</Label>
                    <Input type="number" placeholder="0" value={couponRam} onChange={(e) => setCouponRam(e.target.value)} className="bg-secondary border-border" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CPU (%)</Label>
                    <Input type="number" placeholder="0" value={couponCpu} onChange={(e) => setCouponCpu(e.target.value)} className="bg-secondary border-border" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Disk (MB)</Label>
                    <Input type="number" placeholder="0" value={couponDisk} onChange={(e) => setCouponDisk(e.target.value)} className="bg-secondary border-border" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Slots</Label>
                    <Input type="number" placeholder="0" value={couponSlots} onChange={(e) => setCouponSlots(e.target.value)} className="bg-secondary border-border" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max Uses</Label>
                    <Input type="number" placeholder="∞" value={couponUses} onChange={(e) => setCouponUses(e.target.value)} className="bg-secondary border-border" />
                  </div>
                </div>
                <Button type="submit" variant="glow">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Coupon
                </Button>
              </form>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 card-shadow space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Existing Coupons</h2>
              {coupons.length === 0 ? (
                <p className="text-muted-foreground text-sm">No coupons yet.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-auto">
                  {coupons.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                      <div>
                        <p className="font-mono font-semibold text-foreground text-sm">{c.code}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.coins_reward > 0 && `${c.coins_reward} coins `}
                          {c.ram_reward > 0 && `${c.ram_reward}MB RAM `}
                          • {c.current_uses}/{c.max_uses ?? '∞'} uses
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${c.active ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                        {c.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <div className="bg-card rounded-xl border border-border p-8 card-shadow text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-1">User Management</h3>
            <p className="text-muted-foreground">User management will be available when the Pterodactyl API edge function is configured.</p>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <div className="bg-card rounded-xl border border-border p-6 card-shadow max-w-xl space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Default Resources</h2>
            <p className="text-sm text-muted-foreground">Configure default resources for new users. Changes apply to new signups.</p>
            <p className="text-xs text-muted-foreground">Settings management requires edge function setup. Coming soon.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPage;
