'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

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
    }
  }, [contact]);

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
      
      if (field === 'frequency' && typeof value === 'number') {
        updated.band = calculateBand(value);
      }
      
      return updated;
    });
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle>Edit Contact - {contact.callsign}</DialogTitle>
        </DialogHeader>
        
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
                onChange={(e) => handleInputChange('frequency', parseFloat(e.target.value))}
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
      </DialogContent>
    </Dialog>
  );
}