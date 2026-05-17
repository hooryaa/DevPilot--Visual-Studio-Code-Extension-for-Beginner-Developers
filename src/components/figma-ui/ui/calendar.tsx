"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DayPicker,
  type DayPickerProps,
  type ModifiersClassNames,
} from "react-day-picker";

import { cn } from "./utils.js";
import { buttonVariants } from "./button.js";
import "react-day-picker/dist/style.css";

type CalendarProps = DayPickerProps & {
  className?: string;
};

export function Calendar({ className, ...props }: CalendarProps) {
  const defaultModifiersClassNames: ModifiersClassNames = {
    selected:
      "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
    today: "bg-accent text-accent-foreground",
    disabled: "text-muted-foreground opacity-50",
    outside: "text-muted-foreground",
  };

  return (
    <div className={cn("p-3", className)}>
      <DayPicker
        {...props}
        showOutsideDays
        modifiersClassNames={{
          ...defaultModifiersClassNames,
          ...(props.modifiersClassNames ?? {}),
        }}
        components={{
          Nav: ({ onPreviousClick, onNextClick, previousMonth, nextMonth }) => (
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={onPreviousClick}
                disabled={!previousMonth}
                aria-label="Previous month"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "size-7 bg-transparent p-0 opacity-50 hover:opacity-100"
                )}
              >
                <ChevronLeft className="size-4" />
              </button>

              <button
                type="button"
                onClick={onNextClick}
                disabled={!nextMonth}
                aria-label="Next month"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "size-7 bg-transparent p-0 opacity-50 hover:opacity-100"
                )}
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          ),
        }}
      />
    </div>
  );
}
