'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle, Users, UserPlus, Edit3, Trash2, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UserData {
  id: number;
  email: string;
  name: string;
  callsign?: string;
  grid_locator?: string;
  role: string;
  status: string;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export default function UserManagementPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Form state for new/edit user
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    callsign: '',
    grid_locator: '',
    role: 'user',
    status: 'active'
  });

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
        return;
      }
      
      if (user.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      
      setIsAuthorized(true);
      fetchUsers();
    }
  }, [user, loading, router]);

  const fetchUsers = async () => {
    try {
      setError('');
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      
      if (response.ok) {
        setUsers(data.users || []);
      } else {
        setError(data.error || 'Failed to fetch users');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const isEditing = editingUser !== null;
      const url = isEditing ? `/api/admin/users/${editingUser.id}` : '/api/admin/users';
      const method = isEditing ? 'PUT' : 'POST';
      
      // Don't send password if editing and password is empty
      const submitData = { ...formData };
      if (isEditing && !submitData.password) {
        delete submitData.password;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess(`User ${isEditing ? 'updated' : 'created'} successfully!`);
        setShowForm(false);
        resetForm();
        fetchUsers();
      } else {
        setError(data.error || `Failed to ${isEditing ? 'update' : 'create'} user`);
      }
    } catch (err) {
      setError('Network error occurred');
    }
  };

  const handleEdit = (userData: UserData) => {
    setEditingUser(userData);
    setFormData({
      email: userData.email,
      password: '', // Leave empty for editing
      name: userData.name,
      callsign: userData.callsign || '',
      grid_locator: userData.grid_locator || '',
      role: userData.role,
      status: userData.status
    });
    setShowForm(true);
  };

  const handleDelete = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      setError('');
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess('User deleted successfully!');
        fetchUsers();
      } else {
        setError(data.error || 'Failed to delete user');
      }
    } catch (err) {
      setError('Network error occurred');
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      name: '',
      callsign: '',
      grid_locator: '',
      role: 'user',
      status: 'active'
    });
    setEditingUser(null);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setRoleFilter('all');
    setStatusFilter('all');
  };

  const filteredUsers = users.filter(userData => {
    const matchesSearch = !searchTerm || 
      userData.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userData.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (userData.callsign && userData.callsign.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRole = !roleFilter || roleFilter === 'all' || userData.role === roleFilter;
    const matchesStatus = !statusFilter || statusFilter === 'all' || userData.status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="User Management" breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Users' }]} />
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        title="User Management" 
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Users' }]}
        actions={
          <Button onClick={() => setShowForm(!showForm)}>
            <UserPlus className="mr-2 h-4 w-4" />
            {showForm ? 'Cancel' : 'Add User'}
          </Button>
        }
      />
      
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {error && (
          <Alert className="mb-6 border-destructive/20 bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-destructive">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">{success}</AlertDescription>
          </Alert>
        )}

        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingUser ? 'Edit User' : 'Add New User'}</CardTitle>
              <CardDescription>
                {editingUser 
                  ? 'Update user account information and permissions'
                  : 'Create a new user account with specified role and permissions'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="user@example.com"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="password">
                      Password {editingUser ? '(leave empty to keep current)' : '*'}
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder={editingUser ? "Enter new password or leave empty" : "Enter password"}
                      required={!editingUser}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="John Doe"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="callsign">Callsign</Label>
                    <Input
                      id="callsign"
                      value={formData.callsign}
                      onChange={(e) => setFormData(prev => ({ ...prev, callsign: e.target.value.toUpperCase() }))}
                      placeholder="W1AW"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="grid_locator">Grid Locator</Label>
                    <Input
                      id="grid_locator"
                      value={formData.grid_locator}
                      onChange={(e) => setFormData(prev => ({ ...prev, grid_locator: e.target.value.toUpperCase() }))}
                      placeholder="FN31pr"
                    />
                  </div>

                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="moderator">Moderator</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingUser ? 'Update User' : 'Create User'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Search and Filter */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>

              <div className="text-sm text-muted-foreground flex items-center">
                {filteredUsers.length} of {users.length} users
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No users found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || roleFilter || statusFilter ? 'No users match your search criteria.' : 'Create your first user account.'}
                </p>
                {!searchTerm && !roleFilter && !statusFilter && (
                  <Button onClick={() => setShowForm(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add User
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredUsers.map((userData) => (
              <Card key={userData.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
                      <div>
                        <p className="font-medium">{userData.name}</p>
                        <p className="text-sm text-muted-foreground">{userData.email}</p>
                        {userData.callsign && (
                          <p className="text-sm font-mono text-blue-600 dark:text-blue-400">{userData.callsign}</p>
                        )}
                      </div>
                      
                      <div>
                        <Badge variant={userData.role === 'admin' ? 'default' : userData.role === 'moderator' ? 'secondary' : 'outline'} className="mb-1">
                          {userData.role}
                        </Badge>
                        <p className="text-sm text-muted-foreground">Role</p>
                      </div>
                      
                      <div>
                        <Badge variant={userData.status === 'active' ? 'default' : userData.status === 'suspended' ? 'destructive' : 'secondary'}>
                          {userData.status}
                        </Badge>
                        <p className="text-sm text-muted-foreground">Status</p>
                      </div>
                      
                      <div>
                        <p className="text-sm">
                          {userData.last_login ? new Date(userData.last_login).toLocaleDateString() : 'Never'}
                        </p>
                        <p className="text-sm text-muted-foreground">Last Login</p>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleEdit(userData)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDelete(userData.id)}
                        className="text-destructive hover:text-destructive"
                        disabled={userData.id === user?.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}