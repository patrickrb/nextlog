'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Moon, Sun, Monitor } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const getIcon = (themeName: string) => {
    switch (themeName) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      case 'system':
        return <Monitor className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getLabel = (themeName: string) => {
    switch (themeName) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
        return 'System';
      default:
        return 'System';
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="theme">Theme</Label>
      <Select value={theme} onValueChange={(value: 'light' | 'dark' | 'system') => setTheme(value)}>
        <SelectTrigger className="w-full">
          <SelectValue>
            <div className="flex items-center space-x-2">
              {getIcon(theme)}
              <span>{getLabel(theme)}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="light">
            <div className="flex items-center space-x-2">
              <Sun className="h-4 w-4" />
              <span>Light</span>
            </div>
          </SelectItem>
          <SelectItem value="dark">
            <div className="flex items-center space-x-2">
              <Moon className="h-4 w-4" />
              <span>Dark</span>
            </div>
          </SelectItem>
          <SelectItem value="system">
            <div className="flex items-center space-x-2">
              <Monitor className="h-4 w-4" />
              <span>System</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      <p className="text-sm text-muted-foreground">
        Choose your preferred theme or let the system decide
      </p>
    </div>
  );
}