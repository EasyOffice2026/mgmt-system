import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableSelect({ options, value, onChange, placeholder = 'Select...', className = '', disabled = false }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(o => o.value === value);

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
      >
        <span className={selectedOption ? 'text-foreground truncate' : 'text-muted-foreground truncate'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-1 ms-2 shrink-0">
          {value && !disabled && (
            <span
              className="hover:text-destructive cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onChange(''); setSearch(''); }}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          <div className="flex items-center border-b px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground me-2 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">No results found</div>
            ) : (
              filtered.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={`flex w-full items-center rounded-sm px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground ${option.value === value ? 'bg-accent font-medium' : ''}`}
                  onClick={() => { onChange(option.value); setIsOpen(false); setSearch(''); }}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
