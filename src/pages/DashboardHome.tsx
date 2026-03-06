import { Server, Coins, Cpu, HardDrive, MemoryStick, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useProfile, useUserResources, useServers } from '@/hooks/useProfile';

const DashboardHome = () => {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: resources } = useUserResources();
  const { data: servers } = useServers();

  const stats = [
    { label: 'Servers', value: `${servers?.length ?? 0}`, icon: Server, color: 'text-primary' },
    { label: 'Coins', value: `${profile?.coins ?? 0}`, icon: Coins, color: 'text-warning' },
    { label: 'CPU', value: `${resources?.cpu ?? 0}%`, icon: Cpu, color: 'text-success' },
    { label: 'RAM', value: `${resources?.ram ?? 0} MB`, icon: MemoryStick, color: 'text-accent' },
    { label: 'Disk', value: `${resources?.disk ?? 0} MB`, icon: HardDrive, color: 'text-primary' },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {profile?.username ?? 'user'}!</p>
        </div>
        <Button variant="glow" onClick={() => navigate('/dashboard/servers')}>
          <Plus className="w-4 h-4 mr-2" />
          New Server
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl border border-border p-4 card-shadow hover:border-primary/20 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border p-6 card-shadow">
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button variant="secondary" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/dashboard/servers')}>
            <Server className="w-5 h-5 text-primary" />
            <span>Create Server</span>
          </Button>
          <Button variant="secondary" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/dashboard/shop')}>
            <Coins className="w-5 h-5 text-warning" />
            <span>Buy Resources</span>
          </Button>
          <Button variant="secondary" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/dashboard/coupons')}>
            <span className="text-accent">🎟️</span>
            <span>Redeem Coupon</span>
          </Button>
        </div>
      </div>

      {/* Servers List */}
      {servers && servers.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Your Servers</h2>
          {servers.map((server: any) => (
            <div key={server.id} className="bg-card rounded-xl border border-border p-4 card-shadow flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Server className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">{server.name}</p>
                  <p className="text-xs text-muted-foreground">{server.server_type} • {server.status}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${server.status === 'running' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                {server.status}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-8 card-shadow text-center">
          <Server className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No servers yet</h3>
          <p className="text-muted-foreground mb-4">Create your first server to get started.</p>
          <Button variant="glow" onClick={() => navigate('/dashboard/servers')}>
            <Plus className="w-4 h-4 mr-2" />
            Create Server
          </Button>
        </div>
      )}
    </div>
  );
};

export default DashboardHome;
