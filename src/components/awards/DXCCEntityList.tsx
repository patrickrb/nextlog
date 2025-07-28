'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Circle, Target, Search, Filter, Globe, Map } from 'lucide-react';
import { DXCCEntityProgress, DXCCStatus, DXCC_CONTINENTS } from '@/types/awards';

interface DXCCEntityListProps {
  entities: DXCCEntityProgress[];
  title?: string;
  showFilters?: boolean;
  compact?: boolean;
}

type SortField = 'name' | 'status' | 'continent' | 'lastWorked' | 'count';
type SortOrder = 'asc' | 'desc';

export default function DXCCEntityList({ 
  entities, 
  title = "DXCC Entities", 
  showFilters = true,
  compact = false 
}: DXCCEntityListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DXCCStatus | 'all'>('all');
  const [continentFilter, setContinentFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const filteredAndSortedEntities = useMemo(() => {
    const filtered = entities.filter(entity => {
      const matchesSearch = entity.entity_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           entity.prefix.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || entity.status === statusFilter;
      const matchesContinent = continentFilter === 'all' || entity.continent === continentFilter;
      
      return matchesSearch && matchesStatus && matchesContinent;
    });

    // Sort the filtered results
    filtered.sort((a, b) => {
      let aValue: string | number, bValue: string | number;
      
      switch (sortField) {
        case 'name':
          aValue = a.entity_name.toLowerCase();
          bValue = b.entity_name.toLowerCase();
          break;
        case 'status':
          // Sort order: confirmed, worked, needed
          const statusOrder = { 'confirmed': 0, 'worked': 1, 'needed': 2 };
          aValue = statusOrder[a.status];
          bValue = statusOrder[b.status];
          break;
        case 'continent':
          aValue = a.continent;
          bValue = b.continent;
          break;
        case 'lastWorked':
          aValue = a.last_worked_date ? new Date(a.last_worked_date).getTime() : 0;
          bValue = b.last_worked_date ? new Date(b.last_worked_date).getTime() : 0;
          break;
        case 'count':
          aValue = a.contact_count;
          bValue = b.contact_count;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [entities, searchTerm, statusFilter, continentFilter, sortField, sortOrder]);

  const getStatusIcon = (status: DXCCStatus) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'worked':
        return <Target className="h-4 w-4 text-yellow-600" />;
      case 'needed':
        return <Circle className="h-4 w-4 text-gray-400" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: DXCCStatus) => {
    const variants = {
      'confirmed': 'default' as const,
      'worked': 'secondary' as const,
      'needed': 'outline' as const
    };
    
    const colors = {
      'confirmed': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'worked': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'needed': ''
    };

    return (
      <Badge variant={variants[status]} className={colors[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (field !== sortField) return null;
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const stats = useMemo(() => {
    const total = entities.length;
    const worked = entities.filter(e => e.status !== 'needed').length;
    const confirmed = entities.filter(e => e.status === 'confirmed').length;
    const needed = entities.filter(e => e.status === 'needed').length;
    
    return { total, worked, confirmed, needed };
  }, [entities]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {title}
            </CardTitle>
            <CardDescription>
              {stats.total} entities • {stats.worked} worked • {stats.confirmed} confirmed • {stats.needed} needed
            </CardDescription>
          </div>
          {!compact && (
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-200">
                {stats.confirmed} Confirmed
              </Badge>
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200">
                {stats.worked} Worked
              </Badge>
              <Badge variant="outline" className="bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                {stats.needed} Needed
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {showFilters && (
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search entities or prefixes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as DXCCStatus | 'all')}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="worked">Worked</SelectItem>
                <SelectItem value="needed">Needed</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={continentFilter} onValueChange={setContinentFilter}>
              <SelectTrigger className="w-[140px]">
                <Map className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Continents</SelectItem>
                {DXCC_CONTINENTS.map(continent => (
                  <SelectItem key={continent} value={continent}>{continent}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Status</TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    className="h-auto p-0 font-semibold"
                    onClick={() => handleSort('name')}
                  >
                    Entity {getSortIcon('name')}
                  </Button>
                </TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    className="h-auto p-0 font-semibold"
                    onClick={() => handleSort('continent')}
                  >
                    Continent {getSortIcon('continent')}
                  </Button>
                </TableHead>
                {!compact && (
                  <>
                    <TableHead className="text-center">
                      <Button 
                        variant="ghost" 
                        className="h-auto p-0 font-semibold"
                        onClick={() => handleSort('count')}
                      >
                        QSOs {getSortIcon('count')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        className="h-auto p-0 font-semibold"
                        onClick={() => handleSort('lastWorked')}
                      >
                        Last Worked {getSortIcon('lastWorked')}
                      </Button>
                    </TableHead>
                    <TableHead>Details</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedEntities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={compact ? 4 : 7} className="text-center py-8 text-muted-foreground">
                    No entities found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedEntities.map((entity) => (
                  <TableRow key={entity.adif} className="hover:bg-muted/50">
                    <TableCell>
                      {getStatusIcon(entity.status)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{entity.entity_name}</div>
                      <div className="text-sm text-muted-foreground">ADIF: {entity.adif}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entity.prefix}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{entity.continent}</Badge>
                    </TableCell>
                    {!compact && (
                      <>
                        <TableCell className="text-center">
                          {entity.contact_count}
                        </TableCell>
                        <TableCell>
                          {entity.last_worked_date ? (
                            <div>
                              <div className="text-sm">
                                {new Date(entity.last_worked_date).toLocaleDateString()}
                              </div>
                              {entity.callsign && (
                                <div className="text-xs text-muted-foreground">
                                  {entity.callsign}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Never</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(entity.status)}
                            {entity.band && (
                              <Badge variant="outline" className="text-xs">
                                {entity.band}
                              </Badge>
                            )}
                            {entity.mode && (
                              <Badge variant="outline" className="text-xs">
                                {entity.mode}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {filteredAndSortedEntities.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground text-center">
            Showing {filteredAndSortedEntities.length} of {entities.length} entities
          </div>
        )}
      </CardContent>
    </Card>
  );
}