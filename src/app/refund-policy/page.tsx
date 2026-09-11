import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage from "@/components/PolicyPage";
import { company } from "@/data/company";

export const metadata: Metadata = {
  title: "Refund & Returns Policy – Vortex UK",
  description: "How to return a VORTEX product, our 60-day money-back guarantee, your 14-day cancellation right and how refunds are paid.",
  alternates: { canonical: "/refund-policy" },
};

export default function RefundPolicy() {
  return (
    <PolicyPage
      title="Refund & Returns Policy"
      intro="We want you to be completely happy with your VORTEX. This policy explains your legal cancellation right, our 60-day money-back guarantee, what to do if something is faulty, and how and when refunds are paid."
    >
      <h2>Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Situation</th>
            <th>Time limit</th>
            <th>What you get</th>
            <th>Who pays return postage</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Changed your mind (legal cooling-off)</td>
            <td>14 days from delivery</td>
            <td>Full refund incl. standard delivery</td>
            <td>You (we can arrange collection, cost deducted)</td>
          </tr>
          <tr>
            <td>Not satisfied (our guarantee)</td>
            <td>60 days from delivery</td>
            <td>Full refund of the product price</td>
            <td>You (we can arrange collection, cost deducted)</td>
          </tr>
          <tr>
            <td>Faulty, damaged or not as described</td>
            <td>30 days for a full refund; up to 6 months for repair/replacement; legal rights up to 6 years</td>
            <td>Repair, replacement or refund</td>
            <td>Us — free collection</td>
          </tr>
          <tr>
            <td>Wrong item sent</td>
            <td>Tell us within 14 days</td>
            <td>Correct item or full refund</td>
            <td>Us — free collection</td>
          </tr>
        </tbody>
      </table>

      <h2>1. Cancelling within 14 days (Consumer Contracts Regulations 2013)</h2>
      <ol>
        <li>Tell us you want to cancel within 14 days of receiving the goods: e-mail <a href={`mailto:${company.email}`}>{company.email}</a> with your order number, or send the model form below.</li>
        <li>Return the goods within 14 days of telling us. Please use the original box and packaging where possible.</li>
        <li>We refund the price and our standard delivery charge within 14 days of receiving the goods (or your proof of posting), using the payment method you used.</li>
        <li>You are responsible for the goods until they reach us; use a tracked, insured service. We can arrange collection by our courier for £[collection fee], deducted from the refund.</li>
        <li>You may inspect the scooter as you would in a shop. If it has been used beyond that — for example ridden outdoors, with worn tyres, scratches or dirt — we may deduct an amount reflecting the reduction in value.</li>
      </ol>

      <h2>2. Our 60-day money-back guarantee</h2>
      <p>If the cooling-off period has passed but you are still within 60 days of delivery and are not satisfied, you can return the product for a refund of the price paid, provided that:</p>
      <ul>
        <li>the scooter is complete (charger, tool kit, manual, key fob) and in its original packaging;</li>
        <li>it has no damage beyond light signs of use, and has not been modified;</li>
        <li>you contact us first so we can issue a returns number and instructions.</li>
      </ul>
      <p>Return postage under the guarantee is at your cost (or we can arrange collection and deduct the fee). Refunds are paid within 14 days of us receiving and checking the product.</p>

      <h2>3. Faulty, damaged or not as described (Consumer Rights Act 2015)</h2>
      <ul>
        <li><b>Damaged on arrival:</b> please photograph the box and the product before use and contact us within 48 hours so we can claim against the carrier. We will send a replacement or refund you in full and collect the damaged item free of charge.</li>
        <li><b>Within 30 days:</b> you have the right to reject a faulty product for a full refund.</li>
        <li><b>30 days to 6 months:</b> we will repair or replace it. If we cannot, or the repair fails, you can choose a refund.</li>
        <li><b>After 6 months:</b> your 3-year warranty applies (see the <Link href="/terms-of-service">Terms of Service</Link>), plus your statutory rights for up to 6 years where the fault was present at delivery.</li>
      </ul>
      <p>We always pay for the collection of faulty items. Please send photos or a short video of the problem to speed things up.</p>

      <h2>4. How to return</h2>
      <ol>
        <li>E-mail <a href={`mailto:${company.email}`}>{company.email}</a> with your order number, the reason and (if applicable) photos.</li>
        <li>We reply within 2 working days with a returns number and the return address or a collection date.</li>
        <li>Pack the scooter safely — folded, battery switched off, charger and accessories included — and attach the returns number to the outside of the box. Lithium batteries must be shipped by an approved courier; we will tell you which service to use.</li>
        <li>Keep your proof of posting or collection receipt until the refund is paid.</li>
      </ol>

      <h2>5. Refunds</h2>
      <ul>
        <li>Refunds are made to the original payment method. Card refunds usually appear within 3 to 5 working days of us processing them; your bank may take longer.</li>
        <li>We refund within 14 days of receiving the goods back or of you providing proof of return, whichever is earlier.</li>
        <li>Promotional discounts are applied proportionally; gift or voucher amounts are refunded as vouchers.</li>
      </ul>

      <h2>6. Exclusions</h2>
      <p>The cooling-off period and guarantee do not apply to products that have been customised at your request, or to consumables (tyres, brake pads) once opened, unless faulty. Nothing in this section limits your statutory rights.</p>

      <h2>7. Model cancellation form</h2>
      <p>Copy the text below into an e-mail to <a href={`mailto:${company.email}`}>{company.email}</a> if you wish to cancel:</p>
      <pre>
        {`To: ${company.legalName}, trading as ${company.tradingName}
${company.registeredOffice}
${company.email}

I/We hereby give notice that I/we cancel my/our contract of sale of the following goods:
Ordered on / received on: ____________
Order number: ____________
Name of consumer(s): ____________
Address of consumer(s): ____________
Signature (only if sent on paper): ____________
Date: ____________`}
      </pre>

      <h2>8. Contact</h2>
      <p>
        {company.tradingName} customer service — <a href={`mailto:${company.email}`}>{company.email}</a> — {company.phone} — {company.serviceHours}.
      </p>
    </PolicyPage>
  );
}
