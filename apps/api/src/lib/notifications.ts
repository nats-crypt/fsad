import { prisma } from "@horizon/db";
import { sendMail } from "./mailer.js";

function flightEmailHtml(opts: {
  passengerName: string;
  pnr: string;
  flightNo: string;
  origin: string;
  destination: string;
  departAt: Date;
  seatNo: string;
  hoursUntil: number;
}) {
  const dep = opts.departAt.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "short",
  });

  const headline =
    opts.hoursUntil <= 2
      ? `Your flight departs in about 2 hours!`
      : `Your flight departs tomorrow`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;background:#0a0f1e;color:#e8dfc8;margin:0;padding:24px;">
  <div style="max-width:520px;margin:auto;background:#111827;border:1px solid #2a3a5c;border-radius:12px;overflow:hidden;">
    <div style="background:#b8972a;padding:20px 28px;">
      <h1 style="margin:0;font-size:22px;color:#0a0f1e;letter-spacing:2px;text-transform:uppercase;">
        ✈ Horizon Airways
      </h1>
    </div>
    <div style="padding:28px;">
      <h2 style="color:#b8972a;margin-top:0;">${headline}</h2>
      <p style="color:#a0aec0;">Hello ${opts.passengerName},</p>
      <p style="color:#a0aec0;">Here are your flight details:</p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px 0;color:#a0aec0;width:140px;">PNR</td>
            <td style="padding:8px 0;color:#e8dfc8;font-weight:bold;font-family:monospace;">${opts.pnr}</td></tr>
        <tr><td style="padding:8px 0;color:#a0aec0;">Flight</td>
            <td style="padding:8px 0;color:#e8dfc8;">${opts.flightNo}</td></tr>
        <tr><td style="padding:8px 0;color:#a0aec0;">Route</td>
            <td style="padding:8px 0;color:#e8dfc8;">${opts.origin} → ${opts.destination}</td></tr>
        <tr><td style="padding:8px 0;color:#a0aec0;">Departure</td>
            <td style="padding:8px 0;color:#e8dfc8;">${dep} IST</td></tr>
        <tr><td style="padding:8px 0;color:#a0aec0;">Seat</td>
            <td style="padding:8px 0;color:#e8dfc8;">${opts.seatNo}</td></tr>
      </table>

      <div style="background:#1a2535;border:1px solid #2a3a5c;border-radius:8px;padding:16px;margin-top:16px;">
        <p style="margin:0;color:#a0aec0;font-size:13px;">
          Please arrive at the airport at least 2 hours before departure.
          Have your PNR and a valid photo ID ready.
        </p>
      </div>

      <p style="color:#a0aec0;font-size:12px;margin-top:24px;">
        Safe travels,<br/>
        <strong style="color:#b8972a;">Horizon Airways Team</strong>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// Tracks which (bookingId, type) pairs have already been notified this run.
// In production you'd persist this in the DB; for now an in-memory set is fine
// since the cron job runs in the same process and duplicates are low-risk.
const notified = new Set<string>();

async function runNotifications() {
  const now = new Date();

  // Look ahead window: flights departing between now and now+25h
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const bookings = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      flight: {
        departAt: { gte: now, lte: windowEnd },
        status: { not: "CANCELLED" },
      },
    },
    include: {
      flight: { include: { origin: true, destination: true } },
      seat: true,
      passenger: { include: { user: true } },
    },
  });

  for (const booking of bookings) {
    const { flight, passenger, seat } = booking;
    if (!passenger?.user?.email) continue;

    const msUntil = flight.departAt.getTime() - now.getTime();
    const hoursUntil = msUntil / (1000 * 60 * 60);

    // 24h reminder: between 23h and 25h before departure
    const key24 = `${booking.id}:24h`;
    if (hoursUntil >= 23 && hoursUntil <= 25 && !notified.has(key24)) {
      const sent = await sendMail({
        to: passenger.user.email,
        subject: `Reminder: Your Horizon flight ${flight.flightNo} departs tomorrow`,
        html: flightEmailHtml({
          passengerName: passenger.fullName,
          pnr: booking.pnr,
          flightNo: flight.flightNo,
          origin: flight.origin.code,
          destination: flight.destination.code,
          departAt: flight.departAt,
          seatNo: seat.seatNo,
          hoursUntil: 24,
        }),
      });
      if (sent) {
        notified.add(key24);
        console.log(`[notifications] 24h reminder sent → ${passenger.user.email} (${booking.pnr})`);
      }
    }

    // 2h reminder: between 1.5h and 2.5h before departure
    const key2 = `${booking.id}:2h`;
    if (hoursUntil >= 1.5 && hoursUntil <= 2.5 && !notified.has(key2)) {
      const sent = await sendMail({
        to: passenger.user.email,
        subject: `Heads up! Your Horizon flight ${flight.flightNo} departs in 2 hours`,
        html: flightEmailHtml({
          passengerName: passenger.fullName,
          pnr: booking.pnr,
          flightNo: flight.flightNo,
          origin: flight.origin.code,
          destination: flight.destination.code,
          departAt: flight.departAt,
          seatNo: seat.seatNo,
          hoursUntil: 2,
        }),
      });
      if (sent) {
        notified.add(key2);
        console.log(`[notifications] 2h reminder sent → ${passenger.user.email} (${booking.pnr})`);
      }
    }
  }
}

export function startNotificationScheduler() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl.startsWith("postgresql://") && !dbUrl.startsWith("postgres://")) {
    console.warn("[notifications] DATABASE_URL not set correctly — scheduler disabled");
    return;
  }
  // Dynamic import to keep cron out of test environments
  import("node-cron").then(({ default: cron }) => {
    // Run every 15 minutes
    cron.schedule("*/15 * * * *", () => {
      runNotifications().catch(err =>
        console.error("[notifications] scheduler error:", err)
      );
    });
    console.log("[notifications] scheduler started (every 15 min)");
    // Delay first run by 5s to let DB connections settle
    setTimeout(() => {
      runNotifications().catch(err =>
        console.error("[notifications] initial run error:", err)
      );
    }, 5000);
  });
}
