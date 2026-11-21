import PDFDocument from "pdfkit";

export interface TicketData {
  pnr: string;
  flightNo: string;
  origin: string;
  destination: string;
  departAt: string | Date;
  arriveAt: string | Date;
  passengerName: string;
  seatNo: string;
  cabinClass: string;
  farePaid: number;
}

/** Renders a simple e-ticket PDF and returns a Buffer */
export function renderTicketPdf(data: TicketData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("Horizon Airways", { align: "center" });

    doc.moveDown(0.5);
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor("#1a56db")
      .text("E-Ticket / Boarding Pass", { align: "center" });

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.5);

    // PNR
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .fillColor("#111827")
      .text(`PNR: ${data.pnr}`, { align: "center" });

    doc.moveDown(1);

    // Flight info
    doc.font("Helvetica-Bold").fontSize(12).text("Flight Details");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(11);
    doc.text(`Flight Number : ${data.flightNo}`);
    doc.text(`From          : ${data.origin}`);
    doc.text(`To            : ${data.destination}`);
    doc.text(`Departure     : ${new Date(data.departAt).toUTCString()}`);
    doc.text(`Arrival       : ${new Date(data.arriveAt).toUTCString()}`);

    doc.moveDown(1);

    // Passenger info
    doc.font("Helvetica-Bold").fontSize(12).text("Passenger Details");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(11);
    doc.text(`Passenger     : ${data.passengerName}`);
    doc.text(`Seat          : ${data.seatNo} (${data.cabinClass})`);
    doc.text(`Fare Paid     : INR ${data.farePaid.toFixed(2)}`);

    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.5);

    doc
      .fontSize(9)
      .fillColor("#6b7280")
      .text(
        "This is an auto-generated e-ticket. Please carry a photo ID for verification at the airport.",
        { align: "center" }
      );

    doc.end();
  });
}
