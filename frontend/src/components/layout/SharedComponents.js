// src/components/layout/SharedComponents.js
import React, { useRef, useState } from 'react';
import { useLang } from '../../contexts/LangContext';
import { supabase, exportToPDF, exportToExcel } from '../../utils/supabaseClient';
import toast from 'react-hot-toast';

// ── Attach Zone ────────────────────────────────────────────
export function AttachZone({ icon, label, bucket, path, onUploaded }) {
  const { t } = useLang();
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const filePath = `${path}/${Date.now()}_${file.name}`;
      const { data } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true });
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
      setFileName(file.name);
      onUploaded?.({ path: data.path, publicUrl: urlData.publicUrl, fileName: file.name });
      toast.success(t('attachFile') + ' ✓');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="attach-zone" onClick={() => fileRef.current?.click()}>
      <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFile} accept="image/*,.pdf,.doc,.docx" />
      <div className="attach-icon">{uploading ? '⏳' : (fileName ? '✅' : icon)}</div>
      <div className="attach-label">{fileName ? fileName.slice(0, 20) + (fileName.length > 20 ? '…' : '') : label}</div>
    </div>
  );
}

// ── Camera Attach ─────────────────────────────────────────
export function CameraZone({ label, bucket, path, onUploaded }) {
  const { t } = useLang();
  const ref = useRef();
  return (
    <div className="attach-zone" onClick={() => ref.current?.click()}>
      <input ref={ref} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
        onChange={async e => {
          const file = e.target.files[0];
          if (!file || !bucket) return;
          try {
            const fp = `${path}/${Date.now()}_${file.name}`;
            const { data } = await supabase.storage.from(bucket).upload(fp, file, { upsert: true });
            const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
            onUploaded?.({ path: data.path, publicUrl: urlData.publicUrl, fileName: file.name });
            toast.success(t('takePhoto') + ' ✓');
          } catch { toast.error('Upload failed'); }
        }}
      />
      <div className="attach-icon">📷</div>
      <div className="attach-label">{label || t('takePhoto')}</div>
    </div>
  );
}

// ── Standard attach + camera pair ─────────────────────────
export function AttachPair({ icon, label, bucket, pathPrefix }) {
  const { t } = useLang();
  return (
    <div className="attach-grid-2">
      <AttachZone icon={icon || '📁'} label={label || t('attachFile')} bucket={bucket} path={pathPrefix} />
      <CameraZone label={t('takePhoto')} bucket={bucket} path={pathPrefix} />
    </div>
  );
}

// ── Download Buttons ───────────────────────────────────────
export function DownloadButtons({ title, columns, getRows }) {
  const { t } = useLang();
  return (
    <div className="action-btns">
      <button className="btn btn-outline btn-sm" onClick={() => exportToPDF(title, columns, getRows())}>
        ⬇ {t('downloadPDF')}
      </button>
      <button className="btn btn-outline btn-sm" onClick={() => exportToExcel(title, title, columns, getRows())}>
        ⬇ {t('downloadExcel')}
      </button>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, size = '' }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size}`}>
        <div className="modal-header">
          <strong style={{ fontSize: 16 }}>{title}</strong>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────
export function StatusBadge({ status }) {
  const { t } = useLang();
  const map = {
    active: ['success', 'active'], inactive: ['gray', 'inactive'],
    terminated: ['danger', 'terminated'], leave: ['warning', 'onLeave'],
    ongoing: ['info', 'ongoing'], finished: ['success', 'finished'],
    legal: ['danger', 'legalCase'], in_stock: ['success', 'inStock'],
    assigned: ['warning', 'assigned'], sold: ['gray', 'sold'],
    paid: ['success', 'paid'], pending: ['warning', 'pending'],
    approved: ['success', 'approved'], rejected: ['danger', 'rejected'],
    present: ['success', 'present'], absent: ['danger', 'absent'],
    late: ['warning', 'late'], half_day: ['info', 'halfDay'],
    cancelled: ['danger', 'terminated'],
  };
  const [cls, key] = map[status] || ['gray', status];
  return <span className={`badge badge-${cls}`}>{t(key) || status}</span>;
}

// ── KPI Card ──────────────────────────────────────────────
export function KpiCard({ label, value, sub, icon, color = 'blue' }) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      {icon && <div className="kpi-icon">{icon}</div>}
    </div>
  );
}

// ── Confirm Dialog ─────────────────────────────────────────
export function useConfirm() {
  const [state, setState] = useState({ open: false, msg: '', resolve: null });
  function confirm(msg) {
    return new Promise(resolve => setState({ open: true, msg, resolve }));
  }
  function Dialog() {
    const { t } = useLang();
    if (!state.open) return null;
    function respond(val) {
      state.resolve(val);
      setState({ open: false, msg: '', resolve: null });
    }
    return (
      <div className="modal-overlay">
        <div className="modal" style={{ maxWidth: 380 }}>
          <div className="modal-body" style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{state.msg}</div>
          </div>
          <div className="modal-footer" style={{ justifyContent: 'center', gap: 12 }}>
            <button className="btn btn-outline" onClick={() => respond(false)}>{t('cancel')}</button>
            <button className="btn btn-danger" onClick={() => respond(true)}>{t('delete')}</button>
          </div>
        </div>
      </div>
    );
  }
  return { confirm, Dialog };
}

// ── Empty State ────────────────────────────────────────────
export function EmptyState({ icon = '📋', message }) {
  const { t } = useLang();
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text2)' }}>
      <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>{icon}</div>
      <div style={{ fontSize: 14 }}>{message || t('noData')}</div>
    </div>
  );
}

// ── Loading Spinner ────────────────────────────────────────
export function Spinner() {
  return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text2)', fontSize: 13 }}>
      ⏳ Loading...
    </div>
  );
}

// ── Info Row ──────────────────────────────────────────────
export function InfoRow({ label, value, mono }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value" style={mono ? { fontFamily: 'monospace', fontSize: 12 } : {}}>{value || '—'}</span>
    </div>
  );
}
