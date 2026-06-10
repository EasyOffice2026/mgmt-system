import { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, setMonth, setYear, isSameMonth, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

interface CalendarProps {
  selected?: Date;
  onSelect: (date: Date) => void;
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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

  const currentYear = currentMonth.getFullYear();
  const currentMonthIdx = currentMonth.getMonth();

  // Generate year range: 2020 to current year + 2
  const years: number[] = [];
  for (let y = 2020; y <= new Date().getFullYear() + 2; y++) {
    years.push(y);
  }

  return (
    <div className="p-3 w-[280px]">
      {/* Month & Year Selectors */}
      <div className="flex items-center gap-2 mb-3">
        <select
          value={currentMonthIdx}
          onChange={(e) => setCurrentMonth(setMonth(currentMonth, Number(e.target.value)))}
          className="flex-1 h-8 text-sm rounded-md border border-slate-200 bg-white px-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {months.map((m, i) => (
            <option key={i} value={i}>{m}</option>
          ))}
        </select>
        <select
          value={currentYear}
          onChange={(e) => setCurrentMonth(setYear(currentMonth, Number(e.target.value)))}
          className="w-20 h-8 text-sm rounded-md border border-slate-200 bg-white px-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Navigation arrows */}
      <div className="flex items-center justify-between mb-2">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentMonth(prev => {
          const d = new Date(prev);
          d.setMonth(d.getMonth() - 1);
          return d;
        })}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-slate-700">{format(currentMonth, 'MMMM yyyy')}</span>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentMonth(prev => {
          const d = new Date(prev);
          d.setMonth(d.getMonth() + 1);
          return d;
        })}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0">
        {weekDays.map(d => (
          <div key={d} className="h-8 flex items-center justify-center text-xs font-medium text-slate-500">{d}</div>
        ))}
        {days.map((d, i) => {
          const isCurrentMonth = isSameMonth(d, currentMonth);
          const isSelected = selected && isSameDay(d, selected);
          const isToday = isSameDay(d, new Date());
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(d)}
              className={`h-8 w-8 mx-auto flex items-center justify-center text-sm rounded-md transition-colors
                ${!isCurrentMonth ? 'text-slate-300' : 'text-slate-700 hover:bg-blue-100'}
                ${isToday && !isSelected ? 'bg-slate-100 font-bold' : ''}
                ${isSelected ? 'bg-blue-600 text-white hover:bg-blue-600 font-bold' : ''}
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
