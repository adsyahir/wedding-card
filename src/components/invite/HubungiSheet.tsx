"use client";

import type { wedding } from "@/config/wedding";

function whatsappUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/^\+/, "").replace(/\D/g, "")}`;
}

export function HubungiSheet({ config }: { config: typeof wedding }) {
  return (
    <div className="flex flex-col gap-4">
      {config.contacts.map((contact) => (
        <div
          key={contact.phone}
          className="flex flex-col gap-2 rounded-2xl bg-sand px-4 py-3 text-left"
        >
          <div>
            <p className="font-serif text-base text-brown-deep">{contact.name}</p>
            <p className="text-xs text-brown">{contact.role}</p>
          </div>
          <div className="flex gap-2">
            <a
              href={`tel:${contact.phone}`}
              className="inline-flex flex-1 items-center justify-center rounded-full border border-goldenrod bg-tan px-4 py-2 text-sm font-medium text-brown-deep"
            >
              Telefon
            </a>
            <a
              href={whatsappUrl(contact.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center rounded-full border border-goldenrod bg-cream px-4 py-2 text-sm font-medium text-brown-deep"
            >
              WhatsApp
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
