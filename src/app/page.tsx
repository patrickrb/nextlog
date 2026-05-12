'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  Globe,
  Upload,
  Award,
  Radio,
  Antenna,
  Building2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Dot } from '@/components/ui/dot';
import { BrandLockup } from '@/components/ui/brand-mark';
import { WorldBackdrop } from '@/components/ui/world-backdrop';

const FEATURES = [
  {
    icon: Globe,
    title: 'Smart callsign lookup',
    body: 'Type a call, get name, grid, DXCC, distance and bearing instantly. QRZ and HamQTH in one query.',
  },
  {
    icon: Upload,
    title: 'LoTW & QRZ sync',
    body: 'Every QSO auto-uploads in the background. No CSV files, no ADIF wrangling — just confirmed contacts rolling in.',
  },
  {
    icon: Award,
    title: 'Awards on autopilot',
    body: 'DXCC, WAS, WAZ — tracked the moment you log a new one. See exactly what you need to work next.',
  },
  {
    icon: Radio,
    title: 'Cloudlog API compatible',
    body: 'Drop-in replacement for Cloudlog. Works with N1MM+, JTDX, WSJT-X, Log4OM, and every contest logger you already own.',
  },
  {
    icon: Antenna,
    title: 'Live propagation',
    body: 'Solar flux, A/K-index, and band conditions update in the dashboard so you know what to spin up to.',
  },
  {
    icon: Building2,
    title: 'Stations & portable ops',
    body: 'Manage multiple stations, club calls, and rover trips. Each QSO knows where it came from.',
  },
];

const RECENT_PREVIEW = [
  { call: 'DL5XYZ', meta: '20m · SSB · 23:14' },
  { call: 'JA1QRP', meta: '20m · CW · 22:48' },
  { call: 'VK3FOO', meta: '15m · FT8 · 22:31' },
  { call: 'ZS6ABC', meta: '17m · SSB · 21:05' },
  { call: 'EA8/DL4NN', meta: '20m · SSB · 20:22' },
];

const PREVIEW_PINS = [
  { x: 14, y: 62, tone: 'ok' as const },
  { x: 62, y: 42, tone: 'accent' as const },
  { x: 50, y: 65, tone: 'accent' as const },
  { x: 72, y: 38, tone: 'accent' as const },
  { x: 38, y: 28, tone: 'accent' as const },
  { x: 84, y: 60, tone: 'accent' as const },
  { x: 28, y: 75, tone: 'accent' as const },
];

const PREVIEW_ARCS = [
  { d: 'M 100 300 Q 300 80 600 220' },
  { d: 'M 100 300 Q 250 400 500 340' },
  { d: 'M 100 300 Q 400 100 720 200' },
  { d: 'M 100 300 Q 200 180 360 140' },
];

export default function Home() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  const checkInstallationStatus = useCallback(async () => {
    try {
      const userResponse = await fetch('/api/user');

      if (userResponse.status === 500) {
        const errorText = await userResponse.text();
        if (
          errorText.includes('relation "users" does not exist') ||
          errorText.includes('42P01')
        ) {
          router.push('/install');
          setTimeout(() => {
            window.location.href = '/install';
          }, 1000);
          return;
        }
        router.push('/install');
        setTimeout(() => {
          window.location.href = '/install';
        }, 1000);
        return;
      }
    } catch (error) {
      console.error('Installation check failed:', error);
      router.push('/install');
      return;
    }
    setIsChecking(false);
  }, [router]);

  useEffect(() => {
    checkInstallationStatus();
  }, [checkInstallationStatus]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-accent" />
          <p className="text-fg-2">Checking system status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1">
      {/* Transparent landing topbar */}
      <header className="flex items-center gap-4 sm:gap-7 px-4 sm:px-6 lg:px-10 py-4 sm:py-6">
        <BrandLockup href="/" />
        <nav className="hidden md:flex items-center gap-1 ml-2">
          <a
            href="#features"
            className="px-3.5 py-2 rounded-[8px] text-[15px] text-fg-1 hover:bg-white/5 hover:text-fg transition-colors"
          >
            Features
          </a>
          <Link
            href="/dashboard"
            className="px-3.5 py-2 rounded-[8px] text-[15px] text-fg-1 hover:bg-white/5 hover:text-fg transition-colors"
          >
            Dashboard
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-10 pt-12 sm:pt-20 pb-12 sm:pb-16 max-w-[1280px] mx-auto text-center">
        <Chip variant="accent" className="mb-7">
          <Dot tone="ok" live />
          Open source · self-host or cloud
        </Chip>
        <h1
          className="font-semibold leading-[1.02] mb-6"
          style={{
            fontSize: 'clamp(48px, 7vw, 92px)',
            letterSpacing: '-0.035em',
            background: 'linear-gradient(180deg, #ffffff 0%, #98a6bc 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          Your logbook,
          <br />
          <em
            className="not-italic"
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, #a78bfa 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            at the speed of light.
          </em>
        </h1>
        <p
          className="text-fg-1 mx-auto mb-10 leading-relaxed"
          style={{
            fontSize: 'clamp(18px, 2vw, 22px)',
            maxWidth: 640,
          }}
        >
          Modern amateur radio logging built for hams who actually operate.
          Log a QSO in three keystrokes, sync to LoTW &amp; QRZ automatically,
          and watch your contacts light up the world.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center sm:items-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/register">Try it free</Link>
          </Button>
          <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
            <Link href="/dashboard">See live logging</Link>
          </Button>
        </div>
      </section>

      {/* Preview mockup */}
      <div className="relative max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 pb-16 sm:pb-24">
        <div
          className="absolute pointer-events-none"
          style={{
            inset: '-20px -40px 40px',
            background:
              'radial-gradient(800px 280px at 50% 0%, rgba(77,208,255,0.22), transparent 60%), radial-gradient(600px 240px at 70% 100%, rgba(167,139,250,0.18), transparent 60%)',
            zIndex: 0,
          }}
        />
        <div
          className="relative z-10 rounded-[24px] border border-line-hi bg-card overflow-hidden"
          style={{
            boxShadow:
              '0 1px 0 rgba(255,255,255,0.05) inset, 0 60px 120px -30px rgba(0,0,0,0.7), 0 0 0 1px var(--accent-glow)',
          }}
        >
          <div className="flex items-center gap-4 px-5 py-3.5 border-b border-line bg-bg-1">
            <div className="flex gap-1.5">
              <i className="block w-[11px] h-[11px] rounded-full bg-bg-3" />
              <i className="block w-[11px] h-[11px] rounded-full bg-bg-3" />
              <i className="block w-[11px] h-[11px] rounded-full bg-bg-3" />
            </div>
            <span className="text-fg-2 font-mono text-[13px]">
              nextlog.app/dashboard
            </span>
            <div className="ml-auto">
              <Chip>
                <Dot tone="ok" live />
                K4ABC · live
              </Chip>
            </div>
          </div>
          <div className="grid min-h-[460px] grid-cols-1 lg:[grid-template-columns:1.6fr_1fr]">
            <WorldBackdrop
              pins={PREVIEW_PINS}
              arcs={PREVIEW_ARCS}
              className="border-b lg:border-b-0 lg:border-r border-line min-h-[260px]"
            >
              <div className="absolute top-4 left-4 z-10">
                <Chip>
                  <Dot tone="ok" live />
                  487 QSOs · last 30 days
                </Chip>
              </div>
            </WorldBackdrop>

            <div className="p-6 flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-[12px] bg-bg-1 border border-line px-4 py-3.5">
                  <div className="text-xs uppercase tracking-[0.08em] text-fg-2">
                    Total QSOs
                  </div>
                  <div className="font-mono text-2xl font-semibold mt-1">
                    12,847
                  </div>
                </div>
                <div className="rounded-[12px] bg-bg-1 border border-line px-4 py-3.5">
                  <div className="text-xs uppercase tracking-[0.08em] text-fg-2">
                    DXCC
                  </div>
                  <div className="font-mono text-2xl font-semibold mt-1">
                    214 <span className="text-sm text-fg-2">/340</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.08em] text-fg-2 mb-2.5">
                  Recent contacts
                </div>
                <div className="flex flex-col gap-2">
                  {RECENT_PREVIEW.map((c) => (
                    <div
                      key={c.call}
                      className="flex justify-between items-center px-3.5 py-2.5 rounded-[10px] bg-bg-1 border border-line text-sm"
                    >
                      <span className="font-mono font-semibold">{c.call}</span>
                      <span className="text-xs text-fg-2 font-mono">
                        {c.meta}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <section
        id="features"
        className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 py-12 sm:py-20"
      >
        <div className="text-[13px] font-mono text-accent uppercase tracking-[0.12em] mb-3.5">
          Built for operators
        </div>
        <h2
          className="font-semibold leading-[1.05] mb-4 text-fg"
          style={{
            fontSize: 'clamp(32px, 4vw, 56px)',
            letterSpacing: '-0.025em',
            maxWidth: 900,
          }}
        >
          Everything between you and the next contact, gone.
        </h2>
        <p className="text-lg text-fg-2 max-w-[600px] mb-12">
          Auto-lookup, auto-grid, auto-DXCC, auto-upload. You type the callsign
          and hit enter — Nextlog handles the rest.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="group p-7 rounded-[18px] bg-card border border-line transition-all hover:border-line-hi hover:-translate-y-0.5"
            >
              <div className="w-11 h-11 rounded-[11px] bg-accent-soft border border-accent-glow grid place-items-center text-accent mb-5">
                <Icon className="h-[22px] w-[22px]" />
              </div>
              <h3 className="text-[19px] font-semibold mb-2 text-fg">
                {title}
              </h3>
              <p className="text-[15px] text-fg-2 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        className="relative mx-4 sm:mx-6 lg:mx-10 mb-12 sm:mb-20 px-5 sm:px-10 py-12 sm:py-20 rounded-[28px] overflow-hidden border border-line-hi text-center"
        style={{
          background:
            'radial-gradient(800px 400px at 50% 100%, rgba(77,208,255,0.18), transparent 60%), radial-gradient(600px 300px at 50% 0%, rgba(167,139,250,0.12), transparent 60%), linear-gradient(180deg, #131923, #0e131c)',
        }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'repeating-linear-gradient(0deg, transparent 0 39px, rgba(255,255,255,0.02) 39px 40px), repeating-linear-gradient(90deg, transparent 0 39px, rgba(255,255,255,0.02) 39px 40px)',
          }}
        />
        <div className="relative">
          <h2
            className="font-semibold leading-[1.05] mb-4"
            style={{
              fontSize: 'clamp(36px, 5vw, 64px)',
              letterSpacing: '-0.025em',
            }}
          >
            Get on the air.
            <br />
            We&rsquo;ll keep the log.
          </h2>
          <p className="text-lg text-fg-1 mb-8">
            Free to self-host. Open source. Ready when you are.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center sm:items-center">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/register">Start logging</Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
              <a
                href="https://github.com/patrickrb/nextlog"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
