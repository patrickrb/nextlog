'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useUser } from '@/contexts/UserContext';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Image as ImageIcon, Calendar, Radio, MapPin, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface QSLImageWithContact {
  id: number;
  contact_id: number;
  image_type: 'front' | 'back';
  filename: string;
  original_filename: string;
  file_size: number;
  storage_url?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  // Contact information
  callsign: string;
  datetime: string;
  frequency: string;
  mode: string;
  qth?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export default function QSLCardsPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [images, setImages] = useState<QSLImageWithContact[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [storageAvailable, setStorageAvailable] = useState(false);
  const [imageTypeFilter, setImageTypeFilter] = useState<'all' | 'front' | 'back'>('all');

  const fetchQSLImages = useCallback(async () => {
    try {
      setError('');
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      
      if (imageTypeFilter !== 'all') {
        params.append('type', imageTypeFilter);
      }

      const response = await fetch(`/api/qsl-images?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        setImages(data.images || []);
        setPagination(prev => data.pagination || prev);
        setStorageAvailable(data.storage_available || false);
      } else {
        setError(data.error || 'Failed to fetch QSL images');
      }
    } catch (fetchError) {
      console.error('Error fetching QSL images:', fetchError);
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, imageTypeFilter]);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
        return;
      }
      fetchQSLImages();
    }
  }, [user, loading, router, pagination.page, imageTypeFilter, fetchQSLImages]);

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatFrequency = (freq: string): string => {
    const frequency = parseFloat(freq);
    if (frequency >= 1000) {
      return `${(frequency / 1000).toFixed(3)} GHz`;
    } else {
      return `${frequency.toFixed(3)} MHz`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="QSL Cards Gallery" />
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        title="QSL Cards Gallery" 
        breadcrumbs={[{ label: 'QSL Cards' }]}
        actions={
          <div className="flex items-center space-x-2">
            <Select value={imageTypeFilter} onValueChange={(value: 'all' | 'front' | 'back') => setImageTypeFilter(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Images</SelectItem>
                <SelectItem value="front">Front Only</SelectItem>
                <SelectItem value="back">Back Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />
      
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {error && (
          <Alert className="mb-6 border-destructive/20 bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-destructive">{error}</AlertDescription>
          </Alert>
        )}

        {!storageAvailable && (
          <Alert className="mb-6 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
            <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              File uploads are disabled. Please contact your administrator to configure storage.
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="text-center py-8">Loading QSL images...</div>
        ) : images.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <ImageIcon className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No QSL card images found</h3>
              <p className="text-muted-foreground mb-4">
                {imageTypeFilter === 'all' 
                  ? 'You haven\'t uploaded any QSL card images yet.'
                  : `No ${imageTypeFilter} images found.`
                }
              </p>
              <p className="text-sm text-muted-foreground">
                Upload QSL card images from the contact details page by editing a contact.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">QSL Card Images</h2>
                <p className="text-muted-foreground">
                  Showing {images.length} of {pagination.total} images
                  {imageTypeFilter !== 'all' && ` (${imageTypeFilter} only)`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {images.map((image) => (
                <Card key={image.id} className="overflow-hidden">
                  <div className="aspect-[3/2] bg-muted relative group">
                    {image.storage_url ? (
                      <Image
                        src={image.storage_url}
                        alt={`QSL Card ${image.image_type} - ${image.callsign}`}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* Image type badge */}
                    <Badge 
                      variant={image.image_type === 'front' ? 'default' : 'secondary'}
                      className="absolute top-2 right-2"
                    >
                      {image.image_type}
                    </Badge>
                  </div>
                  
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{image.callsign}</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {image.mode}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center text-muted-foreground">
                        <Calendar className="mr-1 h-3 w-3" />
                        {formatDate(image.datetime)}
                      </div>
                      <div className="flex items-center text-muted-foreground">
                        <Radio className="mr-1 h-3 w-3" />
                        {formatFrequency(image.frequency)}
                      </div>
                    </div>
                    
                    {image.qth && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="mr-1 h-3 w-3" />
                        {image.qth}
                      </div>
                    )}
                    
                    <div className="pt-2 border-t text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>{image.original_filename}</span>
                        <span>{formatFileSize(image.file_size)}</span>
                      </div>
                      <div>Uploaded {formatDate(image.created_at)}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={!pagination.hasPrevPage}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                </div>
                
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasNextPage}
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}