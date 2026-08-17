import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function DateTimePicker({ date, setDate, disabled }) {
  const initialDate = date ? new Date(date) : undefined;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [hour, setHour] = useState(initialDate ? format(initialDate, 'HH') : '12');
  const [minute, setMinute] = useState(initialDate ? format(initialDate, 'mm') : '00');

  useEffect(() => {
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setHours(parseInt(hour, 10));
      newDate.setMinutes(parseInt(minute, 10));
      setDate(newDate.toISOString());
    } else {
      setDate('');
    }
  }, [selectedDate, hour, minute, setDate]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full sm:flex-1 md:min-w-[240px] justify-start text-left font-normal bg-background",
            !selectedDate && "text-muted-foreground",
            disabled && "opacity-50 pointer-events-none"
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? (
            format(selectedDate, "PPP") + ` ${hour}:${minute}`
          ) : (
            <span>Pick a date & time</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          initialFocus
        />
        <div className="p-3 border-t border-border flex items-center gap-2 bg-muted/20">
          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex flex-1 items-center gap-2">
            <Select value={hour} onValueChange={setHour}>
              <SelectTrigger className="h-8 flex-1">
                <SelectValue placeholder="Hr" />
              </SelectTrigger>
              <SelectContent position="popper">
                {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map((h) => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">:</span>
            <Select value={minute} onValueChange={setMinute}>
              <SelectTrigger className="h-8 flex-1">
                <SelectValue placeholder="Min" />
              </SelectTrigger>
              <SelectContent position="popper">
                {Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')).map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
