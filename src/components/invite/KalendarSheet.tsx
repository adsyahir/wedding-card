"use client";

import type { WeddingConfig } from "@/config/wedding";
import { isoToParts } from "@/lib/datetime-my";
import { trackEvent } from "@/lib/track";

import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { buildIcs, toIcsUtcDate } from "./ics";

function buildGoogleCalendarUrl(config: WeddingConfig): string {
  const title = `Walimatul Urus ${config.groom.shortName} & ${config.bride.shortName}`;
  const location = config.venue.addressLines.length
    ? `${config.venue.name}, ${config.venue.addressLines.join(" ")}`
    : config.venue.name;
  const dates = `${toIcsUtcDate(config.date)}/${toIcsUtcDate(config.endTime)}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates,
    details: `Jemputan perkahwinan ${config.groom.shortName} & ${config.bride.shortName}.`,
    location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function downloadIcs(config: WeddingConfig) {
  const location = config.venue.addressLines.length
    ? `${config.venue.name}, ${config.venue.addressLines.join(" ")}`
    : config.venue.name;

  const ics = buildIcs({
    uid: `wedding-card-${config.groom.shortName}-${config.bride.shortName}@invite`.replace(
      /\s+/g,
      "-",
    ),
    title: `Walimatul Urus ${config.groom.shortName} & ${config.bride.shortName}`,
    description: `Jemputan perkahwinan ${config.groom.shortName} & ${config.bride.shortName}.`,
    location,
    startIso: config.date,
    endIso: config.endTime,
  });

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "walimatul-urus.ics";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function KalendarSheet({
  config,
  showGrid,
}: {
  config: WeddingConfig;
  showGrid: boolean;
}) {
  const { date: isoDate } = isoToParts(config.date);
  const [yearStr, monthStr, dayStr] = isoDate.split("-");
  const eventDate =
    yearStr && monthStr && dayStr
      ? { year: Number(yearStr), month: Number(monthStr), day: Number(dayStr) }
      : null;

  return (
    <div className="flex flex-col gap-4 text-center">
      <p className="font-serif text-lg text-brown-deep">
        {config.dayNameMs}, {config.displayDate}
      </p>
      <p className="text-sm text-brown">{config.venue.name}</p>

      {showGrid && eventDate && <CalendarMonthGrid event={eventDate} />}

      <div className="mt-2 flex flex-col gap-3">
        <a
          href={buildGoogleCalendarUrl(config)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("calendar_add")}
          className="inline-flex items-center justify-center rounded-full border border-goldenrod bg-tan px-6 py-3 text-sm font-medium text-brown-deep transition-transform hover:scale-[1.02]"
        >
          Google Calendar
        </a>
        <button
          type="button"
          onClick={() => {
            trackEvent("calendar_add");
            downloadIcs(config);
          }}
          className="inline-flex items-center justify-center rounded-full border border-goldenrod bg-sand px-6 py-3 text-sm font-medium text-brown-deep transition-transform hover:scale-[1.02]"
        >
          Apple Calendar
        </button>
      </div>
    </div>
  );
}
