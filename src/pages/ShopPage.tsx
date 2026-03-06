import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Coins, Cpu, HardDrive, MemoryStick, Server, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile, useUserResources } from '@/hooks/useProfile';
import { useQueryClient } from '@tanstack/react-query';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  price: number;
  resource: 'ram' | 'cpu' | 'disk' | 'server_slots';
  amount: number;
  displayAmount: string;
  color: string;
}

const shopItems: ShopItem[] = [
  { id: 'ram-512', name: '512 MB RAM', description: 'Extra memory for your servers', icon: MemoryStick, price: 50, resource: 'ram', amount: 512, displayAmount: '512 MB', color: 'text-accent' },
  { id: 'ram-1024', name: '1 GB RAM', description: 'More memory for better performance', icon: MemoryStick, price: 90, resource: 'ram', amount: 1024, displayAmount: '1024 MB', color: 'text-accent' },
  { id: 'cpu-50', name: '50% CPU', description: 'Additional processing power', icon: Cpu, price: 40, resource: 'cpu', amount: 50, displayAmount: '50%', color: 'text-success' },
  { id: 'cpu-100', name: '100% CPU', description: 'Full CPU core allocation', icon: Cpu, price: 70, resource: 'cpu', amount: 100, displayAmount: '100%', color: 'text-success' },
  { id: 'disk-1', name: '1 GB Disk', description: 'Extra storage space', icon: HardDrive, price: 20, resource: 'disk', amount: 1024, displayAmount: '1 GB', color: 'text-primary' },
  { id: 'disk-5', name: '5 GB Disk', description: 'Large storage expansion', icon: HardDrive, price: 80, resource: 'disk', amount: 5120, displayAmount: '5 GB', color: 'text-primary' },
  { id: 'server-1', name: '+1 Server Slot', description: 'Create an additional server', icon: Server, price: 100, resource: 'server_slots', amount: 1, displayAmount: '1 slot', color: 'text-warning' },
];

const ShopPage = () => {
  const [buying, setBuying] = useState<string | null>(null);
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: resources } = useUserResources();
  const queryClient = useQueryClient();

  const handleBuy = async (item: ShopItem) => {
    if (!user || !profile || !resources) return;
    if (profile.coins < item.price) {
      toast.error('Not enough coins!');
      return;
    }

    setBuying(item.id);
    try {
      // Deduct coins
      const { error: coinErr } = await supabase
        .from('profiles')
        .update({ coins: profile.coins - item.price })
        .eq('id', user.id);
      if (coinErr) throw coinErr;

      // Add resource
      const { error: resErr } = await supabase
        .from('user_resources')
        .update({ [item.resource]: (resources as any)[item.resource] + item.amount })
        .eq('user_id', user.id);
      if (resErr) throw resErr;

      // Log transaction
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'purchase',
        description: `Bought ${item.name}`,
        coins_change: -item.price,
      });

      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['user_resources'] });
      toast.success(`Purchased ${item.name}!`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Shop</h1>
        <p className="text-muted-foreground">Purchase resources with your coins.</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 card-shadow">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
            <Coins className="w-6 h-6 text-warning" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Your Balance</p>
            <p className="text-3xl font-bold text-foreground">{profile?.coins ?? 0} <span className="text-lg text-muted-foreground font-normal">coins</span></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {shopItems.map((item) => (
          <div key={item.id} className="bg-card rounded-xl border border-border p-5 card-shadow hover:border-primary/30 transition-all duration-200 group">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">{item.name}</h3>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-1">
                <Coins className="w-4 h-4 text-warning" />
                <span className="font-bold text-foreground">{item.price}</span>
              </div>
              <Button
                size="sm"
                variant="glow"
                disabled={buying === item.id || (profile?.coins ?? 0) < item.price}
                onClick={() => handleBuy(item)}
              >
                <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                Buy
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ShopPage;
