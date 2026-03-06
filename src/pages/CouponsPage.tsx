import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ticket, Gift, Coins, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

const CouponsPage = () => {
  const [couponCode, setCouponCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim() || !user) return;

    setRedeeming(true);
    try {
      // Find coupon
      const { data: coupon, error: findErr } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase())
        .eq('active', true)
        .single();

      if (findErr || !coupon) {
        toast.error('Invalid or expired coupon code');
        return;
      }

      if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
        toast.error('This coupon has reached its max uses');
        return;
      }

      // Check if already claimed
      const { data: existing } = await supabase
        .from('coupon_claims')
        .select('id')
        .eq('user_id', user.id)
        .eq('coupon_id', coupon.id)
        .maybeSingle();

      if (existing) {
        toast.error('You have already claimed this coupon');
        return;
      }

      // Claim it
      const { error: claimErr } = await supabase.from('coupon_claims').insert({
        user_id: user.id,
        coupon_id: coupon.id,
      });
      if (claimErr) throw claimErr;

      // Update coupon uses (best effort, no RLS issue since we use current_uses increment)
      // We'll do rewards via profile/resources update
      const { data: profile } = await supabase.from('profiles').select('coins').eq('id', user.id).single();
      if (profile && coupon.coins_reward > 0) {
        await supabase.from('profiles').update({ coins: profile.coins + coupon.coins_reward }).eq('id', user.id);
      }

      // Add resource rewards
      if (coupon.ram_reward > 0 || coupon.cpu_reward > 0 || coupon.disk_reward > 0 || coupon.slots_reward > 0) {
        const { data: res } = await supabase.from('user_resources').select('*').eq('user_id', user.id).single();
        if (res) {
          await supabase.from('user_resources').update({
            ram: res.ram + (coupon.ram_reward || 0),
            cpu: res.cpu + (coupon.cpu_reward || 0),
            disk: res.disk + (coupon.disk_reward || 0),
            server_slots: res.server_slots + (coupon.slots_reward || 0),
          }).eq('user_id', user.id);
        }
      }

      // Log transaction
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'coupon',
        description: `Redeemed coupon: ${coupon.code}`,
        coins_change: coupon.coins_reward || 0,
      });

      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['user_resources'] });

      const rewards = [];
      if (coupon.coins_reward) rewards.push(`${coupon.coins_reward} coins`);
      if (coupon.ram_reward) rewards.push(`${coupon.ram_reward} MB RAM`);
      if (coupon.cpu_reward) rewards.push(`${coupon.cpu_reward}% CPU`);
      if (coupon.disk_reward) rewards.push(`${coupon.disk_reward} MB Disk`);
      if (coupon.slots_reward) rewards.push(`${coupon.slots_reward} server slot(s)`);

      toast.success(`Coupon redeemed! You got: ${rewards.join(', ')}`);
      setCouponCode('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Coupons</h1>
        <p className="text-muted-foreground">Redeem coupon codes for coins and resources.</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-8 card-shadow max-w-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center animate-pulse-glow">
            <Ticket className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Redeem Coupon</h2>
            <p className="text-sm text-muted-foreground">Enter your coupon code below</p>
          </div>
        </div>

        <form onSubmit={handleRedeem} className="space-y-4">
          <div className="space-y-2">
            <Label>Coupon Code</Label>
            <Input
              placeholder="ENTER-YOUR-CODE"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              className="bg-secondary border-border text-center font-mono text-lg tracking-wider"
              required
            />
          </div>
          <Button type="submit" variant="glow" className="w-full" disabled={redeeming}>
            <Sparkles className="w-4 h-4 mr-2" />
            {redeeming ? 'Redeeming...' : 'Redeem Coupon'}
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg">
        <div className="bg-card rounded-xl border border-border p-4 card-shadow text-center">
          <Coins className="w-6 h-6 text-warning mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Coins</p>
          <p className="text-xs text-muted-foreground">Get free coins</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 card-shadow text-center">
          <Gift className="w-6 h-6 text-success mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Resources</p>
          <p className="text-xs text-muted-foreground">RAM, CPU, Disk</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 card-shadow text-center">
          <Sparkles className="w-6 h-6 text-accent mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Special</p>
          <p className="text-xs text-muted-foreground">Limited rewards</p>
        </div>
      </div>
    </div>
  );
};

export default CouponsPage;
