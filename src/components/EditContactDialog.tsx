'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, Image as ImageIcon, Trash2, AlertCircle, CheckCircle } from 'lucide-react';

interface Contact {
  id: number;
  callsign: string;
  frequency: number;
  mode: string;
  band: string;
  datetime: string;
  rst_sent?: string;
  rst_received?: string;
  name?: string;
  qth?: string;
  grid_locator?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  confirmed?: boolean;
}

interface QSLImage {
  id: number;
  contact_id: number;
  image_type: 'front' | 'back';
  filename: string;
  original_filename: string;
  file_size: number;
  storage_url?: string;
  description?: string;
  created_at: string;
}

interface EditContactDialogProps {
  contact: Contact | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (contact: Contact) => void;
}

const modeOptions = [
  'SSB', 'CW', 'FM', 'AM', 'FT8', 'FT4', 'PSK31', 'RTTY', 'JT65', 'JT9', 'MFSK'
];

export default function EditContactDialog({ contact, isOpen, onClose, onSave }: EditContactDialogProps) {
  const [formData, setFormData] = useState<Partial<Contact>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qslImages, setQslImages] = useState<QSLImage[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [imageSuccess, setImageSuccess] = useState('');
  const [storageAvailable, setStorageAvailable] = useState(false);
  const [uploadingType, setUploadingType] = useState<'front' | 'back' | null>(null);

  const isValidDate = (dateString: string): boolean => {
    const parsedDate = Date.parse(dateString);
    return !isNaN(parsedDate);
  };

  useEffect(() => {
    if (contact) {
      setFormData({
        ...contact,
        datetime: contact.datetime && isValidDate(contact.datetime) 
          ? new Date(contact.datetime).toISOString().slice(0, 16) 
          : ''
      });
      fetchQSLImages();
    }
  }, [contact]);

  const fetchQSLImages = async () => {
    if (!contact) return;
    
    try {
      const response = await fetch(`/api/contacts/${contact.id}/qsl-images`);
      const data = await response.json();
      
      if (response.ok) {
        setQslImages(data.images || []);
        setStorageAvailable(data.storage_available || false);
      }
    } catch (error) {
      console.error('Error fetching QSL images:', error);
    }
  };

  const calculateBand = (frequency: number): string => {
    if (frequency >= 1.8 && frequency <= 2.0) return '160m';
    if (frequency >= 3.5 && frequency <= 4.0) return '80m';
    if (frequency >= 7.0 && frequency <= 7.3) return '40m';
    if (frequency >= 14.0 && frequency <= 14.35) return '20m';
    if (frequency >= 21.0 && frequency <= 21.45) return '15m';
    if (frequency >= 28.0 && frequency <= 29.7) return '10m';
    if (frequency >= 50.0 && frequency <= 54.0) return '6m';
    if (frequency >= 144.0 && frequency <= 148.0) return '2m';
    if (frequency >= 420.0 && frequency <= 450.0) return '70cm';
    return 'Unknown';
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      if (field === 'frequency' && typeof value === 'number' && !Number.isNaN(value)) {
        updated.band = calculateBand(value);
      }
      
      return updated;
    });
  };

  const handleImageUpload = async (file: File, imageType: 'front' | 'back') => {
    if (!contact || !storageAvailable) return;

    setUploadingType(imageType);
    setImageLoading(true);
    setImageError('');
    setImageSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('image_type', imageType);

      const response = await fetch(`/api/contacts/${contact.id}/qsl-images`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setImageSuccess(data.message);
        await fetchQSLImages(); // Refresh images
      } else {
        setImageError(data.error || 'Failed to upload image');
      }
    } catch (error) {
      setImageError('Network error occurred');
    } finally {
      setImageLoading(false);
      setUploadingType(null);
    }
  };

  const handleImageDelete = async (imageType: 'front' | 'back') => {
    if (!contact) return;

    setImageLoading(true);
    setImageError('');
    setImageSuccess('');

    try {
      const response = await fetch(`/api/contacts/${contact.id}/qsl-images?type=${imageType}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        setImageSuccess(data.message);
        await fetchQSLImages(); // Refresh images
      } else {
        setImageError(data.error || 'Failed to delete image');
      }
    } catch (error) {
      setImageError('Network error occurred');
    } finally {
      setImageLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          datetime: formData.datetime ? new Date(formData.datetime).toISOString() : undefined
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update contact');
      }

      const updatedContact = await response.json();
      onSave(updatedContact);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update contact');
    } finally {
      setLoading(false);
    }
  };

  if (!contact) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle>Edit Contact - {contact.callsign}</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="contact" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="contact">Contact Details</TabsTrigger>
            <TabsTrigger value="qsl">QSL Cards</TabsTrigger>
          </TabsList>

          <TabsContent value="contact">
            <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/15 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="callsign">Callsign *</Label>
              <Input
                id="callsign"
                value={formData.callsign || ''}
                onChange={(e) => handleInputChange('callsign', e.target.value.toUpperCase())}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency (MHz) *</Label>
              <Input
                id="frequency"
                type="number"
                step="0.001"
                value={formData.frequency || ''}
                onChange={(e) => {
                  const inputValue = e.target.value.trim();
                  const frequency = inputValue === '' || isNaN(Number(inputValue)) ? 0 : Number(inputValue);
                  handleInputChange('frequency', frequency);
                }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="band">Band</Label>
              <Input
                id="band"
                value={formData.band || ''}
                readOnly
                className="bg-muted"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mode">Mode *</Label>
              <Select 
                value={formData.mode || ''} 
                onValueChange={(value) => handleInputChange('mode', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  {modeOptions.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {mode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="datetime">Date/Time *</Label>
              <Input
                id="datetime"
                type="datetime-local"
                value={formData.datetime || ''}
                onChange={(e) => handleInputChange('datetime', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rst_sent">RST Sent</Label>
              <Input
                id="rst_sent"
                value={formData.rst_sent || ''}
                onChange={(e) => handleInputChange('rst_sent', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rst_received">RST Received</Label>
              <Input
                id="rst_received"
                value={formData.rst_received || ''}
                onChange={(e) => handleInputChange('rst_received', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qth">QTH</Label>
              <Input
                id="qth"
                value={formData.qth || ''}
                onChange={(e) => handleInputChange('qth', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="grid_locator">Grid Locator</Label>
              <Input
                id="grid_locator"
                value={formData.grid_locator || ''}
                onChange={(e) => handleInputChange('grid_locator', e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
            />
          </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="qsl" className="space-y-4">
            {imageError && (
              <Alert className="border-destructive/20 bg-destructive/10">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-destructive">{imageError}</AlertDescription>
              </Alert>
            )}

            {imageSuccess && (
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-200">{imageSuccess}</AlertDescription>
              </Alert>
            )}

            {!storageAvailable && (
              <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <AlertDescription className="text-orange-800 dark:text-orange-200">
                  File uploads are disabled. Please contact your administrator to configure storage.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Front Image */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center">
                    <ImageIcon className="mr-2 h-4 w-4" />
                    QSL Card Front
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {qslImages.find(img => img.image_type === 'front') ? (
                    <div className="space-y-2">
                      <div className="aspect-[3/2] bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                        {qslImages.find(img => img.image_type === 'front')?.storage_url ? (
                          <img
                            src={qslImages.find(img => img.image_type === 'front')?.storage_url}
                            alt="QSL Card Front"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p>{qslImages.find(img => img.image_type === 'front')?.original_filename}</p>
                        <p>{formatFileSize(qslImages.find(img => img.image_type === 'front')?.file_size || 0)}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleImageDelete('front')}
                        disabled={imageLoading || !storageAvailable}
                        className="w-full"
                      >
                        {imageLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        Delete Front Image
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="aspect-[3/2] bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                        <div className="text-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">No front image</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          disabled={!storageAvailable || imageLoading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleImageUpload(file, 'front');
                              e.target.value = '';
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!storageAvailable || imageLoading}
                          className="w-full"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/jpeg,image/jpg,image/png,image/webp';
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) handleImageUpload(file, 'front');
                            };
                            input.click();
                          }}
                        >
                          {uploadingType === 'front' ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="mr-2 h-4 w-4" />
                          )}
                          Upload Front Image
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Back Image */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center">
                    <ImageIcon className="mr-2 h-4 w-4" />
                    QSL Card Back
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {qslImages.find(img => img.image_type === 'back') ? (
                    <div className="space-y-2">
                      <div className="aspect-[3/2] bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                        {qslImages.find(img => img.image_type === 'back')?.storage_url ? (
                          <img
                            src={qslImages.find(img => img.image_type === 'back')?.storage_url}
                            alt="QSL Card Back"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p>{qslImages.find(img => img.image_type === 'back')?.original_filename}</p>
                        <p>{formatFileSize(qslImages.find(img => img.image_type === 'back')?.file_size || 0)}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleImageDelete('back')}
                        disabled={imageLoading || !storageAvailable}
                        className="w-full"
                      >
                        {imageLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        Delete Back Image
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="aspect-[3/2] bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                        <div className="text-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">No back image</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          disabled={!storageAvailable || imageLoading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleImageUpload(file, 'back');
                              e.target.value = '';
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!storageAvailable || imageLoading}
                          className="w-full"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/jpeg,image/jpg,image/png,image/webp';
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) handleImageUpload(file, 'back');
                            };
                            input.click();
                          }}
                        >
                          {uploadingType === 'back' ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="mr-2 h-4 w-4" />
                          )}
                          Upload Back Image
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}