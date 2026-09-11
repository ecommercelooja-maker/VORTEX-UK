import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage from "@/components/PolicyPage";
import { company } from "@/data/company";

export const metadata: Metadata = {
  title: "Shipping Policy – Vortex UK",
  description: "Delivery areas, costs and times for VORTEX orders in the United Kingdom, tracking, and what to do if a parcel is late or damaged.",
  alternates: { canonical: "/shipping-policy" },
};

export default function ShippingPolicy() {
  return (
    <PolicyPage title="Shipping Policy" intro="Everything about how and when we deliver your VORTEX in the United Kingdom.">
      <h2>1. Where we deliver</h2>
      <table>
        <thead>
          <tr>
            <th>Area</th>
            <th>Cost</th>
            <th>Dispatch</th>
            <th>Delivery after dispatch</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>UK mainland (England, Wales, Scottish Lowlands)</td>
            <td>Free — express tracked</td>
            <td>2 to 3 working days</td>
            <td>3 to 4 working days</td>
          </tr>
          <tr>
            <td>Scottish Highlands &amp; Islands, Northern Ireland, Isle of Wight, Isle of Man, Channel Islands</td>
            <td>Free — tracked</td>
            <td>2 to 3 working days</td>
            <td>5 to 8 working days</td>
          </tr>
          <tr>
            <td>Outside the United Kingdom</td>
            <td colSpan={3}>Not currently available from this store</td>
          </tr>
        </tbody>
      </table>
      <p>
        Typical total time from order to door is 6 to 7 days for the UK mainland, as shown on the product page. Working days are Monday to Friday, excluding bank holidays. Orders placed after 2pm, or at weekends, are processed the next working day.
      </p>

      <h2>2. Tracking</h2>
      <p>
        When your order is dispatched we e-mail you the tracking number and a link to the courier&apos;s site. Most couriers also send SMS or e-mail updates and let you choose a safe place or a neighbour.
      </p>

      <h2>3. Large-item delivery</h2>
      <p>
        The VORTEX Z10 ships in a single box of about 125 × 30 × 55 cm weighing around 36 kg. It is delivered by a one-person courier to your door (or the building entrance for flats). Please make sure someone aged 18 or over is available to sign. The courier will not carry the parcel up stairs or install the product.
      </p>

      <h2>4. Delays</h2>
      <p>
        If we cannot dispatch within the time stated we will tell you and give you a new date. If the delay is more than 30 days from your order, or the new date does not suit you, you may cancel for a full refund. Delivery dates are estimates; we are not responsible for delays caused by events outside our control such as severe weather or carrier disruption, but we will always help you chase the parcel.
      </p>

      <h2>5. Missed or failed delivery</h2>
      <p>
        If you are out, the courier will leave a card or a message with re-delivery or collection options. Parcels that are not collected or accepted after the courier&apos;s attempts are returned to us; we will contact you to arrange re-delivery, and may charge the actual cost of the second delivery if the first failure was not our fault.
      </p>

      <h2>6. Damaged or missing items</h2>
      <p>
        Please check the box on delivery. If it is visibly damaged, note it with the courier or refuse the parcel. Contact us within 48 hours with photos of the packaging and the product; we will send a replacement or refund you and collect the damaged item free of charge. See the <Link href="/refund-policy">Refund Policy</Link>.
      </p>

      <h2>7. Address changes</h2>
      <p>
        We can change the delivery address only before dispatch. E-mail us as soon as possible quoting your order number. After dispatch, use the courier&apos;s redirect options where available.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions about delivery: <a href={`mailto:${company.email}`}>{company.email}</a> or {company.phone} ({company.serviceHours}).
      </p>
    </PolicyPage>
  );
}
