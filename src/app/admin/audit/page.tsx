'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, FileText, Search, User, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AuditLog {
  id: number;
  admin_user_id: number;
  action: string;
  target_type?: string;
  target_id?: number;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  admin_name: string;
  admin_email: string;
  admin_callsign?: string;
}

interface AuditResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AuditLogsPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0
  });
  
  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [adminUserFilter, setAdminUserFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleFetchAuditLogs = useCallback(async () => {
    try {
      setError('');
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (actionFilter && actionFilter !== 'all') params.append('action', actionFilter);
      if (targetTypeFilter && targetTypeFilter !== 'all') params.append('target_type', targetTypeFilter);
      if (adminUserFilter) params.append('admin_user_id', adminUserFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const response = await fetch(`/api/admin/audit?${params}`);
      const data: AuditResponse = await response.json();
      
      if (response.ok) {
        setAuditLogs(data.logs || []);
        setPagination(prev => ({
          ...prev,
          total: data.total,
          totalPages: data.totalPages
        }));
      } else {
        setError((data as { error?: string }).error || 'Failed to fetch audit logs');
      }
    } catch {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, actionFilter, targetTypeFilter, adminUserFilter, startDate, endDate]);

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
      handleFetchAuditLogs();
    }
  }, [user, loading, router, handleFetchAuditLogs]);

  useEffect(() => {
    if (isAuthorized) {
      handleFetchAuditLogs();
    }
  }, [isAuthorized, handleFetchAuditLogs]);


  const getActionBadgeVariant = (action: string) => {
    if (action.includes('created')) return 'default';
    if (action.includes('updated') || action.includes('changed')) return 'secondary';
    if (action.includes('deleted')) return 'destructive';
    if (action.includes('enabled')) return 'default';
    if (action.includes('disabled')) return 'secondary';
    return 'outline';
  };

  const formatActionName = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const clearFilters = () => {
    setActionFilter('all');
    setTargetTypeFilter('all');
    setAdminUserFilter('');
    setStartDate('');
    setEndDate('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  if (loading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="Audit Logs" breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Audit' }]} />
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        title="Audit Logs" 
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Audit' }]}
      />
      
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {error && (
          <Alert className="mb-6 border-destructive/20 bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-destructive">{error}</AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Search className="mr-2 h-5 w-5" />
                  Filter Audit Logs
                </CardTitle>
                <CardDescription>
                  Search and filter administrative actions and system events
                </CardDescription>
              </div>
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="user_created">User Created</SelectItem>
                  <SelectItem value="user_updated">User Updated</SelectItem>
                  <SelectItem value="user_deleted">User Deleted</SelectItem>
                  <SelectItem value="user_role_changed">Role Changed</SelectItem>
                  <SelectItem value="user_status_changed">Status Changed</SelectItem>
                  <SelectItem value="storage_config_created">Storage Created</SelectItem>
                  <SelectItem value="storage_config_updated">Storage Updated</SelectItem>
                  <SelectItem value="storage_config_deleted">Storage Deleted</SelectItem>
                </SelectContent>
              </Select>

              <Select value={targetTypeFilter} onValueChange={setTargetTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by target" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Targets</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="storage_config">Storage Config</SelectItem>
                  <SelectItem value="user_list">User List</SelectItem>
                </SelectContent>
              </Select>

              <div>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="Start date"
                />
              </div>

              <div>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="End date"
                />
              </div>

              <div className="text-sm text-muted-foreground flex items-center">
                {pagination.total} total entries
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audit Logs List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">Loading audit logs...</div>
          ) : auditLogs.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No audit logs found</h3>
                <p className="text-muted-foreground mb-4">
                  No administrative actions match your search criteria.
                </p>
                <Button onClick={clearFilters}>
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            auditLogs.map((log) => (
              <Card key={log.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <Badge variant={getActionBadgeVariant(log.action)}>
                          {formatActionName(log.action)}
                        </Badge>
                        {log.target_type && (
                          <Badge variant="outline">
                            {log.target_type.replace('_', ' ')}
                          </Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {formatDate(log.created_at)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="flex items-center mb-1">
                            <User className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Admin User</span>
                          </div>
                          <p>{log.admin_name}</p>
                          <p className="text-muted-foreground">{log.admin_email}</p>
                          {log.admin_callsign && (
                            <p className="font-mono text-blue-600 dark:text-blue-400">{log.admin_callsign}</p>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center mb-1">
                            <Activity className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Details</span>
                          </div>
                          {log.target_id && (
                            <p>Target ID: {log.target_id}</p>
                          )}
                          {log.ip_address && (
                            <p>IP: {log.ip_address}</p>
                          )}
                        </div>

                        <div>
                          {(log.old_values || log.new_values) && (
                            <>
                              <div className="flex items-center mb-1">
                                <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">Changes</span>
                              </div>
                              {log.old_values && (
                                <details className="mb-2">
                                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                    Old Values
                                  </summary>
                                  <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                                    {JSON.stringify(log.old_values, null, 2)}
                                  </pre>
                                </details>
                              )}
                              {log.new_values && (
                                <details>
                                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                    New Values
                                  </summary>
                                  <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                                    {JSON.stringify(log.new_values, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total entries)
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}