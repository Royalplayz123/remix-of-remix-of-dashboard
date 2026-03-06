import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Shield, Users, Ticket, Plus, Trash2, AlertTriangle,
  Server, BarChart3, Settings, Ban, CheckCircle2, Search,
  Coins, MemoryStick, Cpu, HardDrive, Eye, UserPlus, ServerCrash,
  Activity, TrendingUp, Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { useIsAdmin } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  usePteroServers, usePteroUsers, useSuspendServer, useUnsuspendServer,
  useDeletePteroServer, useDeletePteroUser, useCreatePteroUser
} from '@/hooks/usePterodactyl';

const AdminPage = () => {
  const isAdmin = useIsAdmin();
  const { user } = useAuth();

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponCoins, setCouponCoins] = useState('');
  const [couponRam, setCouponRam] = useState('');
  const [couponCpu, setCouponCpu] = useState('');
  const [couponDisk, setCouponDisk] = useState('');
  const [couponSlots, setCouponSlots] = useState('');
  const [couponUses, setCouponUses] = useState('');
  const [coupons, setCoupons] = useState<any[]>([]);

  // Dashboard users state
  const [dashUsers, setDashUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editCoins, setEditCoins] = useState('');

  // New Ptero User
  const [newUserDialog, setNewUserDialog] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Panel config
  const [serverSearch, setServerSearch] = useState('');

  // Ptero hooks
  const { data: pteroServers, isLoading: serversLoading } = usePteroServers(isAdmin);
  const { data: pteroUsers, isLoading: usersLoading } = usePteroUsers(isAdmin);
  const suspendServer = useSuspendServer();
  const unsuspendServer = useUnsuspendServer();
  const deletePteroServer = useDeletePteroServer();
  const deletePteroUser = useDeletePteroUser();
  const createPteroUser = useCreatePteroUser();

  useEffect(() => {
    if (isAdmin) {
      loadCoupons();
      loadDashUsers();
    }
  }, [isAdmin]);

  const loadCoupons = async () => {
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    if (data) setCoupons(data);
  };

  const loadDashUsers = async () => {
    // Admin needs service role to see all profiles - we'll use an edge function or RLS policy
    // For now, query profiles visible to admin
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setDashUsers(data);
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
      setCouponCode(''); setCouponCoins(''); setCouponRam('');
      setCouponCpu(''); setCouponDisk(''); setCouponSlots(''); setCouponUses('');
      loadCoupons();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    const { error } = await supabase.from('coupons').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Coupon deleted'); loadCoupons(); }
  };

  const handleToggleCoupon = async (id: string, active: boolean) => {
    const { error } = await supabase.from('coupons').update({ active: !active }).eq('id', id);
    if (error) toast.error(error.message);
    else { loadCoupons(); }
  };

  const handleUpdateUserCoins = async () => {
    if (!editingUser) return;
    const { error } = await supabase.from('profiles').update({ coins: parseInt(editCoins) || 0 }).eq('id', editingUser.id);
    if (error) toast.error(error.message);
    else { toast.success('Coins updated!'); setEditingUser(null); loadDashUsers(); }
  };

  const handleCreatePteroUser = async (e: React.FormEvent) => {
    e.preventDefault();
    createPteroUser.mutate({
      username: newUsername, email: newEmail,
      first_name: newFirstName, last_name: newLastName, password: newPassword,
    }, {
      onSuccess: () => {
        setNewUserDialog(false);
        setNewUsername(''); setNewEmail(''); setNewFirstName('');
        setNewLastName(''); setNewPassword('');
      }
    });
  };

  const pteroServerList = pteroServers?.data || [];
  const pteroUserList = pteroUsers?.data || [];
  const filteredServers = pteroServerList.filter((s: any) =>
    s.attributes?.name?.toLowerCase().includes(serverSearch.toLowerCase())
  );
  const filteredDashUsers = dashUsers.filter(u =>
    (u.username || u.email || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  // Analytics
  const totalServers = pteroServerList.length;
  const totalPteroUsers = pteroUserList.length;
  const totalDashUsers = dashUsers.length;
  const totalCoins = dashUsers.reduce((sum: number, u: any) => sum + (u.coins || 0), 0);

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground">Manage users, servers, coupons, and panel settings.</p>
        </div>
      </div>

      <Tabs defaultValue="analytics" className="space-y-4">
        <TabsList className="bg-card border border-border flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="analytics" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary gap-1.5">
            <BarChart3 className="w-4 h-4" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary gap-1.5">
            <Users className="w-4 h-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="servers" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary gap-1.5">
            <Server className="w-4 h-4" /> Servers
          </TabsTrigger>
          <TabsTrigger value="coupons" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary gap-1.5">
            <Ticket className="w-4 h-4" /> Coupons
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary gap-1.5">
            <Settings className="w-4 h-4" /> Settings
          </TabsTrigger>
        </TabsList>

        {/* ===== ANALYTICS TAB ===== */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl border border-border p-5 card-shadow">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Server className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">Total Servers</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{totalServers}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-5 card-shadow">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-accent" />
                </div>
                <span className="text-sm text-muted-foreground">Panel Users</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{totalPteroUsers}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-5 card-shadow">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-success" />
                </div>
                <span className="text-sm text-muted-foreground">Dashboard Users</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{totalDashUsers}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-5 card-shadow">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-warning" />
                </div>
                <span className="text-sm text-muted-foreground">Total Coins</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{totalCoins.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mt-4">
            <div className="bg-card rounded-xl border border-border p-6 card-shadow">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" /> Recent Users
              </h3>
              <div className="space-y-2 max-h-64 overflow-auto">
                {dashUsers.slice(0, 10).map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                    <div>
                      <p className="text-sm font-medium text-foreground">{u.username || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-warning">
                      <Coins className="w-3.5 h-3.5" /> {u.coins}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-6 card-shadow">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-success" /> Active Coupons
              </h3>
              <div className="space-y-2 max-h-64 overflow-auto">
                {coupons.filter(c => c.active).slice(0, 10).map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                    <div>
                      <p className="font-mono font-semibold text-foreground text-sm">{c.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.coins_reward > 0 && `${c.coins_reward} coins `}
                        {c.ram_reward > 0 && `${c.ram_reward}MB RAM `}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{c.current_uses}/{c.max_uses ?? '∞'}</span>
                  </div>
                ))}
                {coupons.filter(c => c.active).length === 0 && (
                  <p className="text-sm text-muted-foreground">No active coupons.</p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ===== USERS TAB ===== */}
        <TabsContent value="users">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9 bg-secondary border-border"
                />
              </div>
              <Dialog open={newUserDialog} onOpenChange={setNewUserDialog}>
                <DialogTrigger asChild>
                  <Button variant="glow" size="sm">
                    <UserPlus className="w-4 h-4 mr-1" /> Create Panel User
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Create Panel User</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreatePteroUser} className="space-y-3 mt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">First Name</Label>
                        <Input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} className="bg-secondary border-border" required />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Last Name</Label>
                        <Input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} className="bg-secondary border-border" required />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Username</Label>
                      <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="bg-secondary border-border" required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="bg-secondary border-border" required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Password</Label>
                      <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-secondary border-border" required minLength={8} />
                    </div>
                    <Button type="submit" variant="glow" className="w-full" disabled={createPteroUser.isPending}>
                      {createPteroUser.isPending ? 'Creating...' : 'Create User'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Dashboard Users */}
            <div className="bg-card rounded-xl border border-border card-shadow overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-foreground">Dashboard Users ({filteredDashUsers.length})</h3>
              </div>
              <div className="max-h-96 overflow-auto">
                {filteredDashUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-4 border-b border-border/50 hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{u.username || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-sm text-warning">
                        <Coins className="w-3.5 h-3.5" /> {u.coins}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingUser(u); setEditCoins(String(u.coins)); }}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Panel Users */}
            <div className="bg-card rounded-xl border border-border card-shadow overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-foreground">Panel Users ({pteroUserList.length})</h3>
              </div>
              {usersLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading panel users...</div>
              ) : (
                <div className="max-h-96 overflow-auto">
                  {pteroUserList.map((u: any) => (
                    <div key={u.attributes.id} className="flex items-center justify-between p-4 border-b border-border/50 hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                          <Users className="w-4 h-4 text-accent" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{u.attributes.username}</p>
                          <p className="text-xs text-muted-foreground">{u.attributes.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{u.attributes.root_admin ? 'Admin' : 'User'}</span>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                          onClick={() => { if (confirm('Delete this panel user?')) deletePteroUser.mutate(u.attributes.id); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Edit User Dialog */}
          <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Edit User: {editingUser?.username}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input value={editingUser?.email || ''} readOnly className="bg-secondary border-border opacity-60" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Coins</Label>
                  <Input type="number" value={editCoins} onChange={(e) => setEditCoins(e.target.value)} className="bg-secondary border-border" />
                </div>
                <Button variant="glow" onClick={handleUpdateUserCoins} className="w-full">
                  <Coins className="w-4 h-4 mr-2" /> Update Coins
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===== SERVERS TAB ===== */}
        <TabsContent value="servers">
          <div className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search servers..."
                value={serverSearch}
                onChange={(e) => setServerSearch(e.target.value)}
                className="pl-9 bg-secondary border-border"
              />
            </div>

            {serversLoading ? (
              <div className="bg-card rounded-xl border border-border p-12 card-shadow text-center">
                <ServerCrash className="w-12 h-12 text-muted-foreground mx-auto mb-3 animate-pulse" />
                <p className="text-muted-foreground">Loading servers from panel...</p>
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border card-shadow overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h3 className="font-semibold text-foreground">All Servers ({filteredServers.length})</h3>
                </div>
                <div className="max-h-[500px] overflow-auto">
                  {filteredServers.map((s: any) => {
                    const attr = s.attributes;
                    const isSuspended = attr.suspended;
                    return (
                      <div key={attr.id} className="flex items-center justify-between p-4 border-b border-border/50 hover:bg-secondary/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSuspended ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                            <Server className={`w-4 h-4 ${isSuspended ? 'text-destructive' : 'text-primary'}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{attr.name}</p>
                            <p className="text-xs text-muted-foreground">
                              ID: {attr.id} • {attr.limits?.memory}MB RAM • {attr.limits?.cpu}% CPU • {attr.limits?.disk}MB Disk
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${isSuspended ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                            {isSuspended ? 'Suspended' : 'Active'}
                          </span>
                          {isSuspended ? (
                            <Button size="sm" variant="ghost" className="text-success hover:text-success"
                              onClick={() => unsuspendServer.mutate(attr.id)}>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="text-warning hover:text-warning"
                              onClick={() => suspendServer.mutate(attr.id)}>
                              <Ban className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                            onClick={() => { if (confirm('Delete this server permanently?')) deletePteroServer.mutate(attr.id); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {filteredServers.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">No servers found.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== COUPONS TAB ===== */}
        <TabsContent value="coupons">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-card rounded-xl border border-border p-6 card-shadow space-y-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" /> Create Coupon
              </h2>
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
                <Button type="submit" variant="glow" className="w-full">
                  <Plus className="w-4 h-4 mr-2" /> Create Coupon
                </Button>
              </form>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 card-shadow space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Existing Coupons ({coupons.length})</h2>
              {coupons.length === 0 ? (
                <p className="text-muted-foreground text-sm">No coupons yet.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-auto">
                  {coupons.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                      <div className="flex-1">
                        <p className="font-mono font-semibold text-foreground text-sm">{c.code}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.coins_reward > 0 && `${c.coins_reward} coins `}
                          {c.ram_reward > 0 && `${c.ram_reward}MB RAM `}
                          {c.cpu_reward > 0 && `${c.cpu_reward}% CPU `}
                          {c.disk_reward > 0 && `${c.disk_reward}MB Disk `}
                          {c.slots_reward > 0 && `${c.slots_reward} slots `}
                          • {c.current_uses}/{c.max_uses ?? '∞'} uses
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleToggleCoupon(c.id, c.active)}
                          className={c.active ? 'text-success hover:text-success' : 'text-muted-foreground'}>
                          {c.active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteCoupon(c.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ===== SETTINGS TAB ===== */}
        <TabsContent value="settings">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-card rounded-xl border border-border p-6 card-shadow space-y-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" /> Panel Connection
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                  <span className="text-sm text-muted-foreground">Panel URL</span>
                  <span className="text-sm font-medium text-success flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                  <span className="text-sm text-muted-foreground">API Key</span>
                  <span className="text-sm font-medium text-success flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Configured
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                  <span className="text-sm text-muted-foreground">Panel Version</span>
                  <span className="text-sm font-medium text-foreground">Pterodactyl v1.x</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                To update your panel URL or API key, update the secrets in your project settings.
              </p>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 card-shadow space-y-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Cpu className="w-5 h-5 text-accent" /> Default Resources
              </h2>
              <p className="text-sm text-muted-foreground">Resources given to new users on signup.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-secondary text-center">
                  <p className="text-lg font-bold text-foreground">1024 MB</p>
                  <p className="text-xs text-muted-foreground">RAM</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary text-center">
                  <p className="text-lg font-bold text-foreground">100%</p>
                  <p className="text-xs text-muted-foreground">CPU</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary text-center">
                  <p className="text-lg font-bold text-foreground">5120 MB</p>
                  <p className="text-xs text-muted-foreground">Disk</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary text-center">
                  <p className="text-lg font-bold text-foreground">1</p>
                  <p className="text-xs text-muted-foreground">Server Slots</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Edit the handle_new_user function in your database to change defaults.</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPage;
