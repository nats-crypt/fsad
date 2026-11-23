import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const POLICIES: Record<string, { title: string; sections: { heading: string; body: string }[] }> = {
  contact: {
    title: 'Contact Us',
    sections: [
      {
        heading: 'Customer Support',
        body: 'Available 24/7 for all booking, baggage, and travel queries.\n\nEmail: support@horizonairways.in\nPhone: 1800-103-4567 (Toll Free)\nWhatsApp: +91 98100 45678',
      },
      {
        heading: 'Registered Office',
        body: 'Horizon Airways Pvt. Ltd.\nTerminal 3, Indira Gandhi International Airport\nNew Delhi – 110037, India',
      },
      {
        heading: 'Feedback & Complaints',
        body: 'We value your experience. For formal complaints, write to grievances@horizonairways.in. We respond within 48 hours.\n\nFor DGCA-related escalations, visit the official DGCA Air Sewa portal.',
      },
    ],
  },
  baggage: {
    title: 'Baggage Policy',
    sections: [
      {
        heading: 'Free Check-in Allowance',
        body: 'Economy Class: 15 kg per passenger\nBusiness Class: 25 kg per passenger\nFirst Class: 32 kg per passenger\n\nInfants (below 2 years): 10 kg + 1 collapsible stroller',
      },
      {
        heading: 'Cabin (Hand) Baggage',
        body: 'All classes: 1 bag up to 7 kg\nDimensions must not exceed 55 × 35 × 25 cm\n\nOne personal item (laptop bag, handbag) is permitted in addition to the cabin bag.',
      },
      {
        heading: 'Excess Baggage',
        body: 'Excess baggage is charged at ₹350 per kg for domestic routes.\nPre-booking additional baggage online is 40% cheaper than at the airport counter.',
      },
      {
        heading: 'Prohibited Items',
        body: 'Flammable liquids, explosives, lithium batteries above 160 Wh, and sharp objects are not permitted in cabin or checked baggage as per DGCA / BCAS regulations.',
      },
    ],
  },
  refund: {
    title: 'Refund Policy',
    sections: [
      {
        heading: 'Cancellation Fees',
        body: 'More than 7 days before departure: ₹500 flat fee\n2–7 days before departure: ₹1,500 flat fee\nWithin 24 hours of departure: ₹3,000 flat fee\n\nNo-show (missed flight without cancellation): No refund.',
      },
      {
        heading: 'Government Taxes',
        body: 'All applicable government taxes and airport charges are always fully refunded, regardless of when you cancel. These are never retained by Horizon Airways.',
      },
      {
        heading: 'Refund Timeline',
        body: 'Refunds are processed within 7–10 business days to your original payment method.\n\nFor credit/debit cards, your bank may take an additional 3–5 days to reflect the amount.',
      },
      {
        heading: 'Non-Refundable Fares',
        body: 'Promotional and sale fares marked "Non-Refundable" at time of booking are not eligible for a cash refund but may be converted to Horizon Travel Credits valid for 12 months.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      {
        heading: 'Data We Collect',
        body: 'We collect your name, email address, phone number, travel preferences, and payment information when you create an account or make a booking.',
      },
      {
        heading: 'How We Use Your Data',
        body: 'Your data is used to process bookings, send e-tickets and flight updates, improve our services, and comply with DGCA and government regulations.\n\nWe do not sell your personal data to third parties.',
      },
      {
        heading: 'Data Retention',
        body: 'Booking and payment records are retained for 7 years as required by Indian tax law. Account data is deleted within 30 days of account closure upon request.',
      },
      {
        heading: 'Your Rights',
        body: 'You may request access to, correction of, or deletion of your personal data at any time by writing to privacy@horizonairways.in.\n\nThis policy is governed by the Information Technology Act, 2000 and the DPDP Act, 2023.',
      },
    ],
  },
};

export default function PolicyPage() {
  const { slug } = useParams<{ slug: string }>();
  const policy = POLICIES[slug ?? ''];

  if (!policy) {
    return (
      <div className="min-h-screen art-deco-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-runway text-lg mb-4">Page not found.</p>
          <Link to="/" className="btn-primary btn-sm">Go Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen art-deco-bg pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-runway hover:text-cloud mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="gold-line mb-6" />

        <h1 className="font-heading text-3xl font-bold text-cloud tracking-wide mb-2">
          {policy.title}
        </h1>
        <p className="text-xs font-heading tracking-widest uppercase text-gold mb-10">
          Horizon Airways · Last updated Nov 2026
        </p>

        <div className="space-y-8">
          {policy.sections.map(s => (
            <div key={s.heading} className="card border border-sky-light/20 p-6">
              <h2 className="font-heading text-lg font-semibold text-gold mb-3 tracking-wide">
                {s.heading}
              </h2>
              <div className="text-sm text-runway/90 leading-relaxed whitespace-pre-line font-body">
                {s.body}
              </div>
            </div>
          ))}
        </div>

        <div className="gold-line mt-10" />
        <p className="text-xs text-runway/50 text-center mt-4 font-heading tracking-widest">
          HORIZON AIRWAYS PVT. LTD. · IATA · DGCA · BCAS COMPLIANT
        </p>
      </div>
    </div>
  );
}
