import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Paperclip, Camera, X, FileText, Image } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLang } from '@/contexts/LangContext';

interface FileAttachmentProps {
  bucket: string;
  folder: string;
  files: string[];
  onFilesChange: (files: string[]) => void;
  disabled?: boolean;
}

export function FileAttachment({ bucket, folder, files, onFilesChange, disabled }: FileAttachmentProps) {
  const { t } = useLang();
  const [showDialog, setShowDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function handleFileUpload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${folder}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) {
        if (error.message?.includes('not found') || error.message?.includes('Bucket')) {
          alert('Storage bucket "' + bucket + '" not found. Please run the migration SQL (migration-v6) in Supabase SQL Editor to create storage buckets.');
        } else if (error.message?.includes('security') || error.message?.includes('policy') || error.message?.includes('RLS') || error.message?.includes('violates')) {
          alert('Storage permission error. Please run this SQL in Supabase SQL Editor:\n\nDROP POLICY IF EXISTS "Allow all operations" ON storage.objects;\nCREATE POLICY "Allow all operations" ON storage.objects FOR ALL USING (true) WITH CHECK (true);');
        } else {
          alert('Upload failed: ' + error.message);
        }
        throw error;
      }
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      onFilesChange([...files, urlData.publicUrl]);
    } catch (err) {
      console.error('Upload error:', err);
    }
    setUploading(false);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      Array.from(selectedFiles).forEach(handleFileUpload);
    }
  }

  async function startCamera() {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera error:', err);
      setShowCamera(false);
    }
  }

  function capturePhoto() {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob(blob => {
        if (blob) {
          const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
          handleFileUpload(file);
        }
      }, 'image/jpeg');
    }
    stopCamera();
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  }

  function removeFile(index: number) {
    onFilesChange(files.filter((_, i) => i !== index));
  }

  function getFileIcon(url: string) {
    if (url.match(/\.(jpg|jpeg|png|gif|webp)/i)) return <Image className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
        >
          <Paperclip className="h-4 w-4 me-1" />
          {t('attachFiles')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={startCamera}
          disabled={disabled || uploading}
        >
          <Camera className="h-4 w-4 me-1" />
          {t('takePhoto')}
        </Button>
        {files.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowDialog(true)}
          >
            {t('viewAttachments')} ({files.length})
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileSelect}
      />

      {uploading && <p className="text-sm text-muted-foreground mt-1">{t('loading')}</p>}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {files.map((url, i) => (
            <div key={i} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded px-2 py-1 text-xs">
              {getFileIcon(url)}
              <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate max-w-[150px]">
                File {i + 1}
              </a>
              {!disabled && (
                <button onClick={() => removeFile(i)} className="text-red-500 hover:text-red-700">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showCamera && (
        <Dialog open={showCamera} onOpenChange={() => stopCamera()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('takePhoto')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg" />
              <div className="flex gap-2 justify-center">
                <Button onClick={capturePhoto}>{t('takePhoto')}</Button>
                <Button variant="outline" onClick={stopCamera}>{t('cancel')}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('attachments')}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-auto">
            {files.map((url, i) => (
              <div key={i} className="border rounded-lg p-2">
                {url.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                  <img src={url} alt={`Attachment ${i + 1}`} className="w-full h-40 object-cover rounded" />
                ) : (
                  <div className="flex items-center justify-center h-40 bg-slate-100 rounded">
                    <FileText className="h-12 w-12 text-slate-400" />
                  </div>
                )}
                <div className="flex justify-between items-center mt-2">
                  <a href={url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                    File {i + 1}
                  </a>
                  {!disabled && (
                    <button onClick={() => removeFile(i)} className="text-red-500 hover:text-red-700">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
