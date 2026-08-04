import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminDashboard() {
  const { accessToken } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, [accessToken]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/auth/admin/users/', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        toast.error('Failed to load users');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error fetching users');
    } finally {
      setLoading(false);
    }
  };

  const handleTierChange = async (userId, newTier) => {
    setUpdating(userId);
    try {
      const res = await fetch(`http://localhost:8000/api/auth/admin/users/${userId}/tier/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ tier: newTier })
      });
      
      if (res.ok) {
        toast.success(`Updated user tier to ${newTier}`);
        setUsers(users.map(u => u.id === userId ? { ...u, tier: newTier } : u));
      } else {
        toast.error('Failed to update tier');
      }
    } catch (error) {
      toast.error('Error updating tier');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 mt-24 mb-16">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Super Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage user lifecycles and manual tier assignments.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">User</TableHead>
                <TableHead>Joined Date</TableHead>
                <TableHead>Engagement</TableHead>
                <TableHead className="w-[200px]">Subscription Tier</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      {u.picture ? (
                        <img src={u.picture} alt="" className="w-8 h-8 rounded-full bg-slate-800" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                          {u.email.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-semibold">{u.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.date_joined ? new Date(u.date_joined).toLocaleDateString() : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="w-fit text-emerald-500 border-emerald-500/20 bg-emerald-500/10">
                        {u.posts_created} Generated
                      </Badge>
                      <Badge variant="outline" className="w-fit text-blue-500 border-blue-500/20 bg-blue-500/10">
                        {u.publish_clicks} Published
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      disabled={updating === u.id}
                      value={u.tier}
                      onValueChange={(value) => handleTierChange(u.id, value)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Select Tier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FREE">FREE</SelectItem>
                        <SelectItem value="STARTER">STARTER</SelectItem>
                        <SelectItem value="CREATOR">CREATOR</SelectItem>
                        <SelectItem value="PRO">PRO</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    {updating === u.id ? (
                      <Loader2 className="w-4 h-4 animate-spin inline-block text-muted-foreground" />
                    ) : (
                      <Save className="w-4 h-4 inline-block text-muted-foreground opacity-50" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
