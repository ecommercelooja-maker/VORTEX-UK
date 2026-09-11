import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage from "@/components/PolicyPage";
import { company } from "@/data/company";

export const metadata: Metadata = {
  title: "Terms of Service – Vortex UK",
  description: "Terms and conditions of sale for orders placed with Vortex UK, including your rights under the Consumer Rights Act 2015.",
  alternates: { canonical: "/terms-of-service" },
};

export default function Terms() {
  return (
    <PolicyPage
      title="Terms of Service"
      intro={`These terms apply to every order placed on ${company.website} with ${company.legalName}, trading as ${company.tradingName}. Please read them before ordering. Nothing in these terms affects your statutory rights as a consumer under the Consumer Rights Act 2015 and the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013.`}
    >
      <h2>1. About us</h2>
      <p>
        {company.legalName} is a company registered in England and Wales under number {company.companyNumber}, with its registered office at {company.registeredOffice}. VAT number: {company.vatNumber}. You can contact us at <a href={`mailto:${company.email}`}>{company.email}</a> or {company.phone} ({company.serviceHours}).
      </p>

      <h2>2. Who can order</h2>
      <p>
        You must be at least 18 years old and a consumer (buying for personal use) to place an order. Business customers should contact us for separate terms. By ordering you confirm that the information you give us is accurate and that you are authorised to use the payment method.
      </p>

      <h2>3. How the contract is formed</h2>
      <ol>
        <li>Placing an order is an offer to buy. When you submit it we send an acknowledgement e-mail; this is not yet acceptance.</li>
        <li>A contract is formed only when we send you an e-mail confirming that your order has been dispatched. We may refuse an order before that point, for example because of a stock shortage, a pricing error, suspected fraud or a delivery address we cannot serve; if we do, we will refund any payment in full.</li>
        <li>Please check your order confirmation. Tell us immediately if anything is wrong.</li>
      </ol>

      <h2>4. Products</h2>
      <p>
        Images are for illustration; colours may vary slightly depending on your screen. Specifications such as range, top speed and power are maximum values measured in test conditions (75 kg rider, flat road, 20&nbsp;°C, Eco mode for range) and will vary with rider weight, terrain, temperature, tyre pressure and riding style.
      </p>
      <p>
        <b>Important legal notice about electric scooters in the UK.</b> Privately owned e-scooters are classed as &quot;powered transporters&quot; under the Road Traffic Act 1988. It is currently illegal to ride one on public roads, cycle lanes, pavements or other public spaces in Great Britain and Northern Ireland; they may only be used on private land with the landowner&apos;s permission. Riders are responsible for complying with the law where they ride. We recommend a helmet and protective equipment at all times.
      </p>

      <h2>5. Prices and payment</h2>
      <ul>
        <li>Prices are shown in pounds sterling and include VAT at the current UK rate. Delivery is free to UK mainland addresses (see the <Link href="/shipping-policy">Shipping Policy</Link>).</li>
        <li>Promotional prices and &quot;compare at&quot; prices are as shown at the time of ordering; the reference price is the price at which the product has previously been offered.</li>
        <li>If we discover an obvious pricing error we will contact you before dispatch and give you the choice of paying the correct price or cancelling for a full refund.</li>
        <li>Payment is taken in full when you place your order, by the card and wallet methods shown at checkout. Payments are processed by a PCI DSS-compliant provider; we do not store card details.</li>
      </ul>

      <h2>6. Delivery</h2>
      <p>
        Delivery times and areas are set out in the <Link href="/shipping-policy">Shipping Policy</Link>. Risk in the goods passes to you when they are delivered to the address you gave. Ownership passes when we receive payment in full. If nobody is available to receive the parcel the courier will leave instructions; if a parcel is returned to us undelivered after reasonable attempts we may deduct the cost of re-delivery.
      </p>

      <h2>7. Your right to cancel (14-day cooling-off period)</h2>
      <p>
        Under the Consumer Contracts Regulations 2013 you may cancel your order for any reason within 14 days of the day you (or someone you nominate) receive the goods. To cancel, e-mail us at <a href={`mailto:${company.email}`}>{company.email}</a> with your order number, or use the model cancellation form in the <Link href="/refund-policy">Refund Policy</Link>. You must return the goods within 14 days of telling us. We will refund the price and the standard delivery cost within 14 days of receiving the goods back (or of you providing proof of return). We may reduce the refund if the goods have been handled beyond what is needed to establish their nature, characteristics and functioning — for example if the scooter has been ridden outdoors and shows wear.
      </p>

      <h2>8. Our 60-day money-back guarantee</h2>
      <p>
        On top of your legal rights, we offer a 60-day money-back guarantee: if you are not satisfied you may return the product within 60 days of delivery for a refund, subject to the conditions in the <Link href="/refund-policy">Refund Policy</Link>.
      </p>

      <h2>9. Faulty goods and your statutory rights</h2>
      <p>Under the Consumer Rights Act 2015 goods must be of satisfactory quality, fit for purpose and as described. If they are not:</p>
      <ul>
        <li>Within 30 days of delivery you can reject the goods and get a full refund.</li>
        <li>After 30 days and up to 6 months, you can ask for a repair or replacement; if that fails or is impossible you can get a refund (which may be reduced for use after the first 6 months).</li>
        <li>Up to 6 years after purchase (5 in Scotland) you may still have a claim if the goods were faulty when delivered, although after 6 months you may need to show this.</li>
      </ul>
      <p>These rights are in addition to our 3-year warranty in section 10.</p>

      <h2>10. Three-year warranty</h2>
      <p>
        We warrant the VORTEX Z10 frame, motors, controller and display against manufacturing defects for 3 years from delivery, and the battery and charger for 12 months. The warranty does not cover normal wear (tyres, brake pads, grips), damage from accidents, misuse, water immersion beyond the IPX6 rating, unauthorised modification or repair, or use on public roads contrary to the law. To claim, contact us with your order number, a description and photos or video of the issue. We will repair, replace or, if neither is possible, refund.
      </p>

      <h2>11. Reviews and user content</h2>
      <p>
        If you submit a review or photo you grant us a non-exclusive, royalty-free licence to publish it on our site and marketing. You confirm it is your own honest opinion. We may remove content that is offensive, unlawful or unrelated to the product. We do not offer payment or incentives for reviews and we do not edit the substance of reviews.
      </p>

      <h2>12. Our liability</h2>
      <p>
        Nothing in these terms limits our liability for death or personal injury caused by negligence, fraud, or any liability that cannot be limited by law, including your rights under the Consumer Rights Act 2015. Subject to that, we are not liable for losses that were not foreseeable when the contract was made, for business losses, or for losses caused by your failure to follow the user manual or the law. Our total liability for any order is limited to the price you paid for it.
      </p>

      <h2>13. Events outside our control</h2>
      <p>
        We are not responsible for delays or failures caused by events outside our reasonable control (for example severe weather, strikes, carrier failures or supply problems). We will contact you as soon as possible and, if the delay is substantial, you may cancel for a full refund.
      </p>

      <h2>14. Intellectual property</h2>
      <p>
        The VORTEX name, logo, product images and the content of this site are owned by or licensed to us and are protected by copyright and trade mark law. You may not copy or use them without our written permission.
      </p>

      <h2>15. Complaints and disputes</h2>
      <p>
        If you have a complaint, contact us at <a href={`mailto:${company.email}`}>{company.email}</a> and we will aim to resolve it within 14 days. If you are not satisfied, you may use the Citizens Advice consumer service (0808 223 1133) for free advice. These terms are governed by the law of England and Wales, and you can bring proceedings in the courts of England and Wales (or of Scotland or Northern Ireland if you live there).
      </p>

      <h2>16. General</h2>
      <p>
        If any part of these terms is found unenforceable the rest remains in force. We may update these terms; the version in force when you order applies to that order. These terms and the policies they link to are the whole agreement between us for your order.
      </p>
    </PolicyPage>
  );
}
