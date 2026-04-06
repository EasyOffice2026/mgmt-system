import { Button } from '@/components/ui/button';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { exportToPdf, exportToExcel } from '@/lib/export-utils';
import { useLang } from '@/contexts/LangContext';

interface DataExportProps {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  filename: string;
}

export function DataExport({ title, headers, rows, filename }: DataExportProps) {
  const { t } = useLang();

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportToPdf(title, headers, rows, filename)}
      >
        <FileDown className="h-4 w-4 me-1" />
        {t('exportPdf')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportToExcel(headers, rows, filename)}
      >
        <FileSpreadsheet className="h-4 w-4 me-1" />
        {t('exportExcel')}
      </Button>
    </div>
  );
}
