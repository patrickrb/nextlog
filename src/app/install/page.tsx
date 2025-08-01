'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertCircle, Radio } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface InstallStep {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  message?: string;
}

export default function InstallPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    callsign: '',
    gridLocator: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isInstalling, setIsInstalling] = useState(false);
  const [installComplete, setInstallComplete] = useState(false);
  const [installSteps, setInstallSteps] = useState<InstallStep[]>([
    { id: 'validate', title: 'Validating installation requirements', status: 'pending' },
    { id: 'database', title: 'Setting up database schema', status: 'pending' },
    { id: 'migrate', title: 'Running database migrations', status: 'pending' },
    { id: 'reference', title: 'Loading DXCC entities and reference data', status: 'pending' },
    { id: 'user', title: 'Creating administrator account', status: 'pending' },
    { id: 'finalize', title: 'Finalizing installation', status: 'pending' }
  ]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.callsign.trim()) {
      newErrors.callsign = 'Callsign is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const updateStepStatus = (stepId: string, status: InstallStep['status'], message?: string) => {
    setInstallSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, message }
        : step
    ));
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleInstall = async () => {
    if (!validateForm()) return;

    setIsInstalling(true);

    try {
      // Step 1: Validate requirements
      updateStepStatus('validate', 'running');
      await sleep(1000);
      
      const validateResponse = await fetch('/api/install/validate', {
        method: 'POST'
      });
      
      if (!validateResponse.ok) {
        const errorData = await validateResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to validate system requirements. Please check your database connection.');
      }
      
      updateStepStatus('validate', 'completed', 'System requirements validated');

      // Step 2: Setup database
      updateStepStatus('database', 'running');
      await sleep(1500);
      
      const dbResponse = await fetch('/api/install/database', {
        method: 'POST'
      });
      
      if (!dbResponse.ok) {
        const errorData = await dbResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create database schema. Please ensure PostgreSQL is running and accessible.');
      }
      
      updateStepStatus('database', 'completed', 'Database schema created successfully');

      // Step 3: Run schema migrations
      updateStepStatus('migrate', 'running');
      await sleep(1000);
      
      const migrateResponse = await fetch('/api/install/migrate-schema', {
        method: 'POST'
      });
      
      if (!migrateResponse.ok) {
        const errorData = await migrateResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to run database migrations. Some features may not work properly.');
      }
      
      const migrateResult = await migrateResponse.json();
      updateStepStatus('migrate', 'completed', 
        `Applied ${migrateResult.migrationsExecuted} database migrations`);

      // Step 4: Load reference data
      updateStepStatus('reference', 'running');
      await sleep(3000); // This step takes longer
      
      const refDataResponse = await fetch('/api/install/reference-data', {
        method: 'POST'
      });
      
      if (!refDataResponse.ok) {
        const errorData = await refDataResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load DXCC entities and reference data. This may be due to missing data files.');
      }
      
      const refDataResult = await refDataResponse.json();
      updateStepStatus('reference', 'completed', 
        `Loaded ${refDataResult.dxccCount} DXCC entities and ${refDataResult.statesCount} states/provinces`);

      // Step 5: Create admin user
      updateStepStatus('user', 'running');
      await sleep(1000);
      
      const userResponse = await fetch('/api/install/create-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          callsign: formData.callsign,
          gridLocator: formData.gridLocator
        }),
      });
      
      if (!userResponse.ok) {
        const errorData = await userResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create administrator account. The email may already be in use.');
      }
      
      updateStepStatus('user', 'completed', 'Administrator account created');

      // Step 6: Finalize
      updateStepStatus('finalize', 'running');
      await sleep(500);
      
      const finalizeResponse = await fetch('/api/install/finalize', {
        method: 'POST'
      });
      
      if (!finalizeResponse.ok) {
        const errorData = await finalizeResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to finalize installation. The system may be partially configured.');
      }
      
      updateStepStatus('finalize', 'completed', 'Installation completed successfully');
      
      setInstallComplete(true);
      
      // Automatically redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login?installed=true');
      }, 3000);

    } catch (error) {
      console.error('Installation failed:', error);
      const currentRunningStep = installSteps.find(step => step.status === 'running');
      if (currentRunningStep) {
        updateStepStatus(currentRunningStep.id, 'error', error instanceof Error ? error.message : 'Installation failed');
      }
      setIsInstalling(false);
    }
  };

  const getStepIcon = (status: InstallStep['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
    }
  };

  if (installComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-background text-foreground">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl text-green-700 dark:text-green-400">Installation Complete!</CardTitle>
            <CardDescription className="text-muted-foreground">
              Nextlog has been successfully installed and configured.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              You will be redirected to the login page in a few seconds...
            </p>
            <Button onClick={() => router.push('/login')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-background text-foreground">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
            <Radio className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-3xl text-blue-700 dark:text-blue-400">Welcome to Nextlog</CardTitle>
          <CardDescription className="text-muted-foreground">
            Set up your amateur radio logging station by creating your administrator account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isInstalling ? (
            <>
              <Alert className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This setup will initialize your database, load all DXCC entities and reference data, 
                  and create your administrator account. This process may take a few minutes.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Your full name"
                    className="bg-background text-foreground border-border"
                  />
                  {errors.name && <p className="text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="your@email.com"
                    className="bg-background text-foreground border-border"
                  />
                  {errors.email && <p className="text-sm text-red-600 dark:text-red-400">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="At least 8 characters"
                    className="bg-background text-foreground border-border"
                  />
                  {errors.password && <p className="text-sm text-red-600 dark:text-red-400">{errors.password}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Confirm your password"
                    className="bg-background text-foreground border-border"
                  />
                  {errors.confirmPassword && <p className="text-sm text-red-600 dark:text-red-400">{errors.confirmPassword}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="callsign" className="text-foreground">Callsign *</Label>
                  <Input
                    id="callsign"
                    value={formData.callsign}
                    onChange={(e) => setFormData(prev => ({ ...prev, callsign: e.target.value.toUpperCase() }))}
                    placeholder="Your amateur radio callsign"
                    className="bg-background text-foreground border-border"
                  />
                  {errors.callsign && <p className="text-sm text-red-600 dark:text-red-400">{errors.callsign}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gridLocator" className="text-foreground">Grid Locator</Label>
                  <Input
                    id="gridLocator"
                    value={formData.gridLocator}
                    onChange={(e) => setFormData(prev => ({ ...prev, gridLocator: e.target.value.toUpperCase() }))}
                    placeholder="e.g., FN20"
                    className="bg-background text-foreground border-border"
                  />
                </div>
              </div>

              <Button onClick={handleInstall} className="w-full" size="lg">
                Install Nextlog
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-foreground">Installing Nextlog...</h3>
                <p className="text-sm text-muted-foreground">Please wait while we set up your amateur radio logging station</p>
              </div>

              {installSteps.map((step, index) => (
                <div key={step.id} className="flex items-start space-x-3 p-3 rounded-lg bg-secondary/50">
                  <div className="flex-shrink-0 mt-0.5">
                    {getStepIcon(step.status)}
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-foreground">{step.title}</h4>
                      <span className="text-xs text-muted-foreground">Step {index + 1} of {installSteps.length}</span>
                    </div>
                    {step.message && (
                      <p className={`text-xs mt-1 ${
                        step.status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                      }`}>
                        {step.message}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}