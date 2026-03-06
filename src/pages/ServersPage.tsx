import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Server, Plus, Play, Square, RotateCcw, Trash2, ExternalLink,
  Cpu, MemoryStick, HardDrive, Edit, Skull, RefreshCw, Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useUserResources, useServers } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import {
  usePteroNodes, usePteroNests, usePteroEggs, usePteroLocations,
  useCreatePteroServer, useDeletePteroServer, useServerPower,
  useUpdateServerBuild
} from '@/hooks/usePterodactyl';

const ServersPage = () => {
  const { user } = useAuth();
  const { data: resources } = useUserResources();
  const { data: servers, refetch: refetchServers } = useServers();
  const queryClient = useQueryClient();

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [serverName, setServerName] = useState('');
  const [selectedNest, setSelectedNest] = useState<string>('');
  const [selectedEgg, setSelectedEgg] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<string>('');
  const [allocRam, setAllocRam] = useState(1024);
  const [allocCpu, setAllocCpu] = useState(100);
  const [allocDisk, setAllocDisk] = useState(5120);

  // Edit dialog
  const [editDialog, setEditDialog] = useState(false);
  const [editingServer, setEditingServer] = useState<any>(null);
  const [editRam, setEditRam] = useState(1024);
  const [editCpu, setEditCpu] = useState(100);
  const [editDisk, setEditDisk] = useState(5120);

  // Ptero data
  const { data: locations } = usePteroLocations();
  const { data: nodes } = usePteroNodes();
  const { data: nests } = usePteroNests();
  const { data: eggs } = usePteroEggs(selectedNest ? parseInt(selectedNest) : null);

  const createServer = useCreatePteroServer();
  const deleteServer = useDeletePteroServer();
  const serverPower = useServerPower();
  const updateBuild = useUpdateServerBuild();

  const nodeList = nodes?.data || [];
  const nestList = nests?.data || [];
  const eggList = eggs?.data || [];
  const locationList = locations?.data || [];

  const maxRam = resources?.ram || 1024;
  const maxCpu = resources?.cpu || 100;
  const maxDisk = resources?.disk || 5120;

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverName.trim() || !selectedEgg || !selectedNode || !user) {
      toast.error('Please fill in all fields');
      return;
    }

    if (allocRam > maxRam || allocCpu > maxCpu || allocDisk > maxDisk) {
      toast.error('Not enough resources! Buy more in the shop.');
      return;
    }

    const serverSlots = resources?.server_slots || 1;
    if ((servers?.length || 0) >= serverSlots) {
      toast.error('No server slots available! Buy more in the shop.');
      return;
    }

    try {
      // Create on Pterodactyl
      // For now, use user id 1 as ptero_user_id - in production this should map to actual ptero user
      const pteroResult = await createServer.mutateAsync({
        name: serverName,
        egg_id: parseInt(selectedEgg),
        ram: allocRam,
        cpu: allocCpu,
        disk: allocDisk,
        node_id: parseInt(selectedNode),
        ptero_user_id: 1, // Default admin user - should be mapped properly
      });

      // Save to our DB
      const pteroId = pteroResult?.attributes?.id || pteroResult?.attributes?.identifier;
      await supabase.from('servers').insert({
        user_id: user.id,
        name: serverName,
        server_type: eggList.find((e: any) => e.attributes.id === parseInt(selectedEgg))?.attributes?.name || 'Unknown',
        ram: allocRam,
        cpu: allocCpu,
        disk: allocDisk,
        pterodactyl_id: String(pteroId || ''),
        status: 'installing',
      });

      // Deduct resources
      await supabase.from('user_resources').update({
        ram: maxRam - allocRam,
        cpu: maxCpu - allocCpu,
        disk: maxDisk - allocDisk,
      }).eq('user_id', user.id);

      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['user_resources'] });

      setDialogOpen(false);
      setServerName(''); setSelectedEgg(''); setSelectedNode(''); setSelectedNest('');
      setAllocRam(1024); setAllocCpu(100); setAllocDisk(5120);
    } catch (err: any) {
      // Error already shown by mutation
    }
  };

  const handleDeleteServer = async (server: any) => {
    if (!confirm('Are you sure you want to delete this server? This cannot be undone.')) return;
    try {
      if (server.pterodactyl_id) {
        await deleteServer.mutateAsync(parseInt(server.pterodactyl_id));
      }
      // Refund resources
      if (user && resources) {
        await supabase.from('user_resources').update({
          ram: (resources.ram || 0) + server.ram,
          cpu: (resources.cpu || 0) + server.cpu,
          disk: (resources.disk || 0) + server.disk,
        }).eq('user_id', user.id);
      }
      await supabase.from('servers').delete().eq('id', server.id);
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['user_resources'] });
      toast.success('Server deleted and resources refunded!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEditServer = (server: any) => {
    setEditingServer(server);
    setEditRam(server.ram);
    setEditCpu(server.cpu);
    setEditDisk(server.disk);
    setEditDialog(true);
  };

  const handleUpdateServer = async () => {
    if (!editingServer || !user || !resources) return;
    const ramDiff = editRam - editingServer.ram;
    const cpuDiff = editCpu - editingServer.cpu;
    const diskDiff = editDisk - editingServer.disk;

    if (ramDiff > resources.ram || cpuDiff > resources.cpu || diskDiff > resources.disk) {
      toast.error('Not enough resources for this upgrade!');
      return;
    }

    try {
      if (editingServer.pterodactyl_id) {
        await updateBuild.mutateAsync({
          server_id: parseInt(editingServer.pterodactyl_id),
          ram: editRam, cpu: editCpu, disk: editDisk,
          allocation_id: 0, // Will need to be fetched
        });
      }

      await supabase.from('servers').update({
        ram: editRam, cpu: editCpu, disk: editDisk,
      }).eq('id', editingServer.id);

      await supabase.from('user_resources').update({
        ram: resources.ram - ramDiff,
        cpu: resources.cpu - cpuDiff,
        disk: resources.disk - diskDiff,
      }).eq('user_id', user.id);

      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['user_resources'] });
      setEditDialog(false);
      toast.success('Server updated!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handlePower = (identifier: string, signal: string) => {
    serverPower.mutate({ identifier, signal });
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Servers</h1>
          <p className="text-muted-foreground">Create and manage your game servers.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="glow">
              <Plus className="w-4 h-4 mr-2" /> Create Server
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">Create New Server</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateServer} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Server Name</Label>
                <Input placeholder="My Awesome Server" value={serverName}
                  onChange={(e) => setServerName(e.target.value)} className="bg-secondary border-border" required />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={selectedNest} onValueChange={(v) => { setSelectedNest(v); setSelectedEgg(''); }}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {nestList.map((n: any) => (
                      <SelectItem key={n.attributes.id} value={String(n.attributes.id)}>
                        {n.attributes.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedNest && (
                <div className="space-y-2">
                  <Label>Server Type (Egg)</Label>
                  <Select value={selectedEgg} onValueChange={setSelectedEgg}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder="Select server type" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {eggList.map((e: any) => (
                        <SelectItem key={e.attributes.id} value={String(e.attributes.id)}>
                          {e.attributes.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Node</Label>
                <Select value={selectedNode} onValueChange={setSelectedNode}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Select node" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {nodeList.map((n: any) => (
                      <SelectItem key={n.attributes.id} value={String(n.attributes.id)}>
                        {n.attributes.name} ({n.attributes.location_id && locationList.find((l: any) => l.attributes.id === n.attributes.location_id)?.attributes?.short || 'Unknown'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-secondary/50 rounded-lg p-4 space-y-4">
                <p className="text-sm font-medium text-foreground">Resource Allocation</p>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground flex items-center gap-1"><MemoryStick className="w-3 h-3" /> RAM</span>
                      <span className="text-foreground font-semibold">{allocRam} MB / {maxRam} MB</span>
                    </div>
                    <Slider value={[allocRam]} min={128} max={maxRam} step={128}
                      onValueChange={([v]) => setAllocRam(v)} className="w-full" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU</span>
                      <span className="text-foreground font-semibold">{allocCpu}% / {maxCpu}%</span>
                    </div>
                    <Slider value={[allocCpu]} min={25} max={maxCpu} step={25}
                      onValueChange={([v]) => setAllocCpu(v)} className="w-full" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground flex items-center gap-1"><HardDrive className="w-3 h-3" /> Disk</span>
                      <span className="text-foreground font-semibold">{allocDisk} MB / {maxDisk} MB</span>
                    </div>
                    <Slider value={[allocDisk]} min={512} max={maxDisk} step={512}
                      onValueChange={([v]) => setAllocDisk(v)} className="w-full" />
                  </div>
                </div>
              </div>

              <Button type="submit" variant="glow" className="w-full" disabled={createServer.isPending}>
                {createServer.isPending ? 'Creating...' : 'Create Server'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resource Bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 card-shadow">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <MemoryStick className="w-3.5 h-3.5 text-accent" /> Available RAM
          </div>
          <p className="text-lg font-bold text-foreground">{resources?.ram ?? 0} MB</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 card-shadow">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Cpu className="w-3.5 h-3.5 text-success" /> Available CPU
          </div>
          <p className="text-lg font-bold text-foreground">{resources?.cpu ?? 0}%</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 card-shadow">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <HardDrive className="w-3.5 h-3.5 text-primary" /> Available Disk
          </div>
          <p className="text-lg font-bold text-foreground">{resources?.disk ?? 0} MB</p>
        </div>
      </div>

      {/* Server List */}
      {servers && servers.length > 0 ? (
        <div className="space-y-3">
          {servers.map((server: any) => (
            <div key={server.id} className="bg-card rounded-xl border border-border p-5 card-shadow hover:border-primary/20 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    server.status === 'running' ? 'bg-success/10' : server.status === 'stopped' ? 'bg-muted' : 'bg-warning/10'
                  }`}>
                    <Server className={`w-5 h-5 ${
                      server.status === 'running' ? 'text-success' : server.status === 'stopped' ? 'text-muted-foreground' : 'text-warning'
                    }`} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{server.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {server.server_type} • {server.ram}MB RAM • {server.cpu}% CPU • {server.disk}MB Disk
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    server.status === 'running' ? 'bg-success/10 text-success'
                    : server.status === 'stopped' ? 'bg-muted text-muted-foreground'
                    : 'bg-warning/10 text-warning'
                  }`}>
                    {server.status}
                  </span>

                  {server.pterodactyl_id && (
                    <>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-success hover:text-success"
                        onClick={() => handlePower(server.pterodactyl_id, 'start')} title="Start">
                        <Play className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-warning hover:text-warning"
                        onClick={() => handlePower(server.pterodactyl_id, 'restart')} title="Restart">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handlePower(server.pterodactyl_id, 'stop')} title="Stop">
                        <Square className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8"
                    onClick={() => handleEditServer(server)} title="Edit">
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteServer(server)} title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-12 card-shadow text-center">
          <Server className="w-16 h-16 text-muted-foreground mx-auto mb-4 animate-float" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No servers yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Create your first game server with custom resources.
          </p>
          <Button variant="glow" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create Your First Server
          </Button>
        </div>
      )}

      {/* Edit Server Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Server: {editingServer?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">Adjust resources. Additional resources will be deducted from your balance, reduced resources will be refunded.</p>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">RAM</span>
                  <span className="text-foreground font-semibold">{editRam} MB</span>
                </div>
                <Slider value={[editRam]} min={128} max={(resources?.ram || 0) + (editingServer?.ram || 0)} step={128}
                  onValueChange={([v]) => setEditRam(v)} />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">CPU</span>
                  <span className="text-foreground font-semibold">{editCpu}%</span>
                </div>
                <Slider value={[editCpu]} min={25} max={(resources?.cpu || 0) + (editingServer?.cpu || 0)} step={25}
                  onValueChange={([v]) => setEditCpu(v)} />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Disk</span>
                  <span className="text-foreground font-semibold">{editDisk} MB</span>
                </div>
                <Slider value={[editDisk]} min={512} max={(resources?.disk || 0) + (editingServer?.disk || 0)} step={512}
                  onValueChange={([v]) => setEditDisk(v)} />
              </div>
            </div>
            <Button variant="glow" className="w-full" onClick={handleUpdateServer} disabled={updateBuild.isPending}>
              {updateBuild.isPending ? 'Updating...' : 'Update Server'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServersPage;
