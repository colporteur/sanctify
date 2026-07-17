import type { Schedule } from "./types";
import { dayOfWeek, daysBetween, dayOfMonth, monthOf, lastDayOfMonth } from "./dates";

/** Is an item/task with this schedule due on this effective date? */
export function isDue(schedule: Schedule, isoDate: string): boolean {
  const dow = dayOfWeek(isoDate);
  switch (schedule.kind) {
    case "daily":
      return true;
    case "weekdays":
      return dow >= 1 && dow <= 5;
    case "daysOfWeek":
      return schedule.days.includes(dow);
    case "weekly":
      return dow === schedule.day;
    case "everyNWeeks": {
      if (dow !== schedule.day) return false;
      const anchorDow = dayOfWeek(schedule.anchor);
      // First occurrence of schedule.day on/after anchor
      const offset = (schedule.day - anchorDow + 7) % 7;
      const first = daysBetween("1970-01-01", schedule.anchor) + offset;
      const today = daysBetween("1970-01-01", isoDate);
      const diff = today - first;
      return diff >= 0 && diff % (schedule.n * 7) === 0;
    }
    case "monthly": {
      const target = Math.min(schedule.day, lastDayOfMonth(isoDate));
      return dayOfMonth(isoDate) === target;
    }
    case "quarterly": {
      if (!schedule.months.includes(monthOf(isoDate))) return false;
      const target = Math.min(schedule.day, lastDayOfMonth(isoDate));
      return dayOfMonth(isoDate) === target;
    }
  }
}
