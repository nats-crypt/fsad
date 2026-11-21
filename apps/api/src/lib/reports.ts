import { prisma } from "@horizon/db";

type ReportResult = {
  summary: Record<string, number | string>;
  series: Array<{ label: string; value: number }>;
};

type DateRange = { from?: string; to?: string };

function makeDateFilter(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
  const f: { gte?: Date; lte?: Date } = {};
  if (from) f.gte = new Date(from);
  if (to) f.lte = new Date(to);
  return Object.keys(f).length > 0 ? f : undefined;
}

export async function revenueReport({ from, to }: DateRange): Promise<ReportResult> {
  const dateFilter = makeDateFilter(from, to);
  const where = {
    status: "CONFIRMED" as const,
    ...(dateFilter ? { createdAt: dateFilter } : {}),
  };

  const agg = await prisma.booking.aggregate({
    _sum: { farePaid: true },
    _count: { id: true },
    where,
  });

  const grouped = await prisma.booking.groupBy({
    by: ["flightId"],
    _sum: { farePaid: true },
    where,
  });

  const flightIds = grouped.map((g) => g.flightId);
  const flights = await prisma.flight.findMany({
    where: { id: { in: flightIds } },
    select: { id: true, flightNo: true },
  });
  const flightMap = new Map(flights.map((f) => [f.id, f.flightNo]));

  const series = grouped.map((g) => ({
    label: flightMap.get(g.flightId) ?? g.flightId,
    value: Number(g._sum.farePaid ?? 0),
  }));

  return {
    summary: {
      total: Number(agg._sum.farePaid ?? 0),
      count: agg._count.id,
    },
    series,
  };
}

export async function flightsReport({ from, to }: DateRange): Promise<ReportResult> {
  const dateFilter = makeDateFilter(from, to);
  const where = {
    ...(dateFilter ? { departAt: dateFilter } : {}),
  };

  const flights = await prisma.flight.findMany({
    where,
    select: { flightNo: true, status: true, seatsBooked: true },
  });

  const summary = {
    total: flights.length,
    scheduled: flights.filter((f) => f.status === "SCHEDULED").length,
    departed: flights.filter((f) => f.status === "DEPARTED").length,
    arrived: flights.filter((f) => f.status === "ARRIVED").length,
    cancelled: flights.filter((f) => f.status === "CANCELLED").length,
  };

  const series = flights.map((f) => ({
    label: f.flightNo,
    value: f.seatsBooked,
  }));

  return { summary, series };
}

export async function reservationsReport({ from, to }: DateRange): Promise<ReportResult> {
  const dateFilter = makeDateFilter(from, to);
  const where = {
    status: "CONFIRMED" as const,
    ...(dateFilter ? { createdAt: dateFilter } : {}),
  };

  const grouped = await prisma.booking.groupBy({
    by: ["flightId"],
    _count: { _all: true },
    where,
  });

  const total = grouped.reduce((acc, g) => acc + g._count._all, 0);

  const flightIds = grouped.map((g) => g.flightId);
  const flights = await prisma.flight.findMany({
    where: { id: { in: flightIds } },
    select: { id: true, flightNo: true },
  });
  const flightMap = new Map(flights.map((f) => [f.id, f.flightNo]));

  const series = grouped.map((g) => ({
    label: flightMap.get(g.flightId) ?? g.flightId,
    value: g._count._all,
  }));

  return { summary: { total }, series };
}

export async function cancellationsReport({ from, to }: DateRange): Promise<ReportResult> {
  const dateFilter = makeDateFilter(from, to);
  const where = {
    status: "CANCELLED" as const,
    ...(dateFilter ? { createdAt: dateFilter } : {}),
  };

  const grouped = await prisma.booking.groupBy({
    by: ["flightId"],
    _count: { _all: true },
    where,
  });

  const total = grouped.reduce((acc, g) => acc + g._count._all, 0);

  const flightIds = grouped.map((g) => g.flightId);
  const flights = await prisma.flight.findMany({
    where: { id: { in: flightIds } },
    select: { id: true, flightNo: true },
  });
  const flightMap = new Map(flights.map((f) => [f.id, f.flightNo]));

  const series = grouped.map((g) => ({
    label: flightMap.get(g.flightId) ?? g.flightId,
    value: g._count._all,
  }));

  return { summary: { total }, series };
}

export async function aircraftReport({ from, to }: DateRange): Promise<ReportResult> {
  const dateFilter = makeDateFilter(from, to);
  const where = {
    ...(dateFilter ? { departAt: dateFilter } : {}),
  };

  const totalAircraft = await prisma.aircraft.count();
  const activeAircraft = await prisma.aircraft.count({ where: { status: "ACTIVE" } });

  const grouped = await prisma.flight.groupBy({
    by: ["aircraftId"],
    _count: { _all: true },
    where,
  });

  const aircraftIds = grouped.map((g) => g.aircraftId);
  const aircrafts = await prisma.aircraft.findMany({
    where: { id: { in: aircraftIds } },
    select: { id: true, registration: true },
  });
  const aircraftMap = new Map(aircrafts.map((a) => [a.id, a.registration]));

  const series = grouped.map((g) => ({
    label: aircraftMap.get(g.aircraftId) ?? g.aircraftId,
    value: g._count._all,
  }));

  return {
    summary: { total: totalAircraft, active: activeAircraft },
    series,
  };
}

export async function salaryReport(_: DateRange): Promise<ReportResult> {
  const grouped = await prisma.employee.groupBy({
    by: ["designation"],
    _sum: { salary: true },
  });

  const total = grouped.reduce((acc, g) => acc + Number(g._sum.salary ?? 0), 0);

  const series = grouped.map((g) => ({
    label: g.designation,
    value: Number(g._sum.salary ?? 0),
  }));

  return { summary: { total }, series };
}

export async function employeesReport(_: DateRange): Promise<ReportResult> {
  const grouped = await prisma.employee.groupBy({
    by: ["designation"],
    _count: { _all: true },
  });

  const total = grouped.reduce((acc, g) => acc + g._count._all, 0);

  const series = grouped.map((g) => ({
    label: g.designation,
    value: g._count._all,
  }));

  return { summary: { total }, series };
}

export async function attendanceReport({ from, to }: DateRange): Promise<ReportResult> {
  const dateFilter = makeDateFilter(from, to);
  const where = {
    ...(dateFilter ? { date: dateFilter } : {}),
  };

  const grouped = await prisma.attendance.groupBy({
    by: ["status"],
    _count: { _all: true },
    where,
  });

  const total = grouped.reduce((acc, g) => acc + g._count._all, 0);

  const series = grouped.map((g) => ({
    label: g.status,
    value: g._count._all,
  }));

  return { summary: { total }, series };
}

export async function performanceReport({ from, to }: DateRange): Promise<ReportResult> {
  const dateFilter = makeDateFilter(from, to);
  const where = {
    status: "CONFIRMED" as const,
    ...(dateFilter ? { createdAt: dateFilter } : {}),
  };

  const grouped = await prisma.booking.groupBy({
    by: ["flightId"],
    _sum: { farePaid: true },
    where,
  });

  const flightIds = grouped.map((g) => g.flightId);
  const flights = await prisma.flight.findMany({
    where: { id: { in: flightIds } },
    select: { id: true, flightNo: true },
  });
  const flightMap = new Map(flights.map((f) => [f.id, f.flightNo]));

  const series = grouped.map((g) => ({
    label: flightMap.get(g.flightId) ?? g.flightId,
    value: Number(g._sum.farePaid ?? 0),
  }));

  const avgRevenuePerFlight =
    series.length > 0 ? series.reduce((acc, s) => acc + s.value, 0) / series.length : 0;

  return {
    summary: { avgRevenuePerFlight },
    series,
  };
}
