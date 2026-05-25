import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/50">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <span>Show</span>
        <select
          value={pageSize}
          onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {pageSizeOptions.map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
        <span>per page</span>
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-600">
        <span>{startItem}-{endItem} of {totalItems}</span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline ms-1">Previous</span>
        </Button>
        {totalPages <= 7 ? (
          Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <Button
              key={page}
              variant={page === currentPage ? 'default' : 'outline'}
              size="sm"
              className={`h-8 w-8 p-0 ${page === currentPage ? 'bg-blue-600' : ''}`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          ))
        ) : (
          <>
            {[1, 2, 3].map(page => (
              <Button
                key={page}
                variant={page === currentPage ? 'default' : 'outline'}
                size="sm"
                className={`h-8 w-8 p-0 ${page === currentPage ? 'bg-blue-600' : ''}`}
                onClick={() => onPageChange(page)}
              >
                {page}
              </Button>
            ))}
            {currentPage > 4 && <span className="px-1 text-slate-400">...</span>}
            {currentPage > 3 && currentPage < totalPages - 2 && (
              <Button variant="default" size="sm" className="h-8 w-8 p-0 bg-blue-600">{currentPage}</Button>
            )}
            {currentPage < totalPages - 3 && <span className="px-1 text-slate-400">...</span>}
            {[totalPages - 1, totalPages].filter(p => p > 3).map(page => (
              <Button
                key={page}
                variant={page === currentPage ? 'default' : 'outline'}
                size="sm"
                className={`h-8 w-8 p-0 ${page === currentPage ? 'bg-blue-600' : ''}`}
                onClick={() => onPageChange(page)}
              >
                {page}
              </Button>
            ))}
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <span className="hidden sm:inline me-1">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
