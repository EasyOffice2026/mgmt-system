import { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

interface CalendarProps {
  selected?: Date;
  onSelect: (date: Date) => void;
}

export function Calendar({ selected, onSelect }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(selected || new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days: Date[] = [];
  let day = startDate;
  while (day <= endDate) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className="p-3 w-[280px]">
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{format(currentMonth, 'MMMM yyyy')}</span>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-0">
        {weekDays.map(d => (
          <div key={d} className="h-8 flex items-center justify-center text-xs font-medium text-slate-500">{d}</div>
        ))}
        {days.map((d, i) => {
          const isCurrentMonth = isSameMonth(d, currentMonth);
          const isSelected = selected && isSameDay(d, selected);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(d)}
              className={`h-8 w-8 mx-auto flex items-center justify-center text-sm rounded-md transition-colors
                ${!isCurrentMonth ? 'text-slate-300' : 'text-slate-700 hover:bg-blue-100'}
                ${isSelected ? 'bg-blue-600 text-white hover:bg-blue-600' : ''}
              `}
            >
              {format(d, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
