'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, X } from 'lucide-react';

type PipState = 'ok' | 'pending' | 'bad' | 'none';
type Direction = 'up' | 'down';

interface QslMatrixProps {
  // LoTW
  lotw_qsl_sent?: string;
  lotw_qsl_rcvd?: string;
  qsl_lotw?: boolean;
  qsl_lotw_date?: string;
  lotw_match_status?: 'confirmed' | 'partial' | 'mismatch' | null;

  // QRZ
  qrz_qsl_sent?: string;
  qrz_qsl_sent_date?: string;
  qrz_qsl_rcvd?: string;
  qrz_qsl_rcvd_date?: string;

  // For click-to-upload (LoTW only — existing capability)
  contact_id?: number;
  station_id?: number;
  onStatusChange?: () => void;
}

const PIP_CLASSES: Record<PipState, string> = {
  ok: 'text-ok border-ok/30 bg-ok/10',
  pending: 'text-warn border-warn/25 bg-warn/10',
  bad: 'text-bad border-bad/30 bg-bad/10',
  none: 'text-fg-3 border-dashed border-line bg-transparent',
};

function formatDate(date?: string) {
  if (!date) return '';
  return ` on ${new Date(date).toLocaleDateString()}`;
}

function Pip({
  state,
  direction,
  tooltip,
  onClick,
  loading,
}: {
  state: PipState;
  direction: Direction;
  tooltip: string;
  onClick?: (e: React.MouseEvent) => void;
  loading?: boolean;
}) {
  const Icon = loading
    ? Loader2
    : state === 'bad' && direction === 'up'
      ? X
      : direction === 'up'
        ? ArrowUp
        : ArrowDown;

  const clickable = Boolean(onClick);
  const isPendingUp = state === 'pending' && direction === 'up' && !loading;

  return (
    <span
      title={tooltip}
      onClick={onClick}
      className={[
        'relative inline-flex items-center justify-center w-[26px] h-[22px] rounded-[5px] border',
        PIP_CLASSES[state],
        clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-help',
      ].join(' ')}
    >
      <Icon className={loading ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} strokeWidth={2.2} />
      {isPendingUp && (
        <span
          aria-hidden
          className="absolute top-[3px] right-[3px] w-[4px] h-[4px] rounded-full bg-warn animate-pulse"
          style={{ boxShadow: '0 0 6px var(--warn)' }}
        />
      )}
    </span>
  );
}

export default function QslMatrix({
  lotw_qsl_sent,
  lotw_qsl_rcvd,
  qsl_lotw,
  qsl_lotw_date,
  lotw_match_status,
  qrz_qsl_sent,
  qrz_qsl_sent_date,
  qrz_qsl_rcvd,
  qrz_qsl_rcvd_date,
  contact_id,
  station_id,
  onStatusChange,
}: QslMatrixProps) {
  const [uploadingLotw, setUploadingLotw] = useState(false);

  // ── LoTW upload ──
  let lotwUp: { state: PipState; tooltip: string };
  if (lotw_qsl_sent === 'Y') {
    lotwUp = { state: 'ok', tooltip: 'Uploaded to LoTW' };
  } else if (lotw_qsl_sent === 'R') {
    lotwUp = { state: 'pending', tooltip: 'LoTW upload queued' };
  } else {
    lotwUp = { state: 'none', tooltip: 'Not uploaded to LoTW' };
  }

  // ── LoTW confirmation ──
  let lotwDown: { state: PipState; tooltip: string };
  const lotwConfirmed = qsl_lotw === true || lotw_qsl_rcvd === 'Y';
  if (lotwConfirmed) {
    if (lotw_match_status === 'mismatch') {
      lotwDown = { state: 'pending', tooltip: `LoTW mismatch found${formatDate(qsl_lotw_date)}` };
    } else if (lotw_match_status === 'partial') {
      lotwDown = { state: 'pending', tooltip: `LoTW partial match${formatDate(qsl_lotw_date)}` };
    } else {
      lotwDown = { state: 'ok', tooltip: `Confirmed via LoTW${formatDate(qsl_lotw_date)}` };
    }
  } else if (lotw_qsl_sent === 'Y') {
    lotwDown = { state: 'pending', tooltip: 'Awaiting LoTW confirmation' };
  } else {
    lotwDown = { state: 'none', tooltip: 'Awaiting confirmation' };
  }

  // ── QRZ upload ──
  let qrzUp: { state: PipState; tooltip: string };
  if (qrz_qsl_sent === 'Y') {
    qrzUp = { state: 'ok', tooltip: `Uploaded to QRZ${formatDate(qrz_qsl_sent_date)}` };
  } else if (qrz_qsl_sent === 'R') {
    qrzUp = { state: 'bad', tooltip: 'QRZ upload failed' };
  } else {
    qrzUp = { state: 'none', tooltip: 'Not uploaded to QRZ' };
  }

  // ── QRZ confirmation ──
  let qrzDown: { state: PipState; tooltip: string };
  if (qrz_qsl_rcvd === 'Y') {
    qrzDown = { state: 'ok', tooltip: `Confirmed via QRZ${formatDate(qrz_qsl_rcvd_date)}` };
  } else if (qrz_qsl_sent === 'Y') {
    qrzDown = { state: 'pending', tooltip: 'Awaiting QRZ confirmation' };
  } else if (qrz_qsl_sent === 'R') {
    qrzDown = { state: 'none', tooltip: 'No data — upload failed' };
  } else {
    qrzDown = { state: 'none', tooltip: 'Awaiting confirmation' };
  }

  const canUploadLotw =
    Boolean(contact_id) && Boolean(station_id) && lotw_qsl_sent !== 'Y' && !uploadingLotw;

  const handleLotwUpload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canUploadLotw) return;
    setUploadingLotw(true);
    try {
      const response = await fetch('/api/lotw/upload-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        onStatusChange?.();
      } else {
        console.error('LoTW upload failed:', data.error);
      }
    } catch (err) {
      console.error('LoTW upload error:', err);
    } finally {
      setUploadingLotw(false);
    }
  };

  return (
    <div
      className="inline-grid items-center font-mono"
      style={{ gridTemplateColumns: '36px repeat(2, 26px)', gap: '4px 6px' }}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-[10px] font-semibold text-fg-1 tracking-[0.04em]">LoTW</span>
      <Pip
        state={lotwUp.state}
        direction="up"
        tooltip={lotwUp.tooltip}
        loading={uploadingLotw}
        onClick={canUploadLotw ? handleLotwUpload : undefined}
      />
      <Pip state={lotwDown.state} direction="down" tooltip={lotwDown.tooltip} />

      <span className="text-[10px] font-semibold text-fg-1 tracking-[0.04em]">QRZ</span>
      <Pip state={qrzUp.state} direction="up" tooltip={qrzUp.tooltip} />
      <Pip state={qrzDown.state} direction="down" tooltip={qrzDown.tooltip} />
    </div>
  );
}
