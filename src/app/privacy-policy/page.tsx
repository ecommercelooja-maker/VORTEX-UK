import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage from "@/components/PolicyPage";
import { company } from "@/data/company";

export const metadata: Metadata = {
  title: "Privacy Policy – Vortex UK",
  description: "How Vortex UK collects, uses and protects your personal data under the UK GDPR and the Data Protection Act 2018.",
  alternates: { canonical: "/privacy-policy" },
};

export default function PrivacyPolicy() {
  return (
    <PolicyPage
      title="Privacy Policy"
      intro={`This policy explains how ${company.legalName}, trading as ${company.tradingName} ("we", "us", "our"), collects, uses, shares and protects your personal data when you visit ${company.website}, buy from us or contact us. It is written to meet the UK General Data Protection Regulation (UK GDPR), the Data Protection Act 2018 and the Privacy and Electronic Communications Regulations 2003 (PECR).`}
    >
      <h2>1. Who we are (the data controller)</h2>
      <p>
        {company.legalName} (company number {company.companyNumber}), registered office {company.registeredOffice}, is the data controller responsible for your personal data. We are registered with the Information Commissioner&apos;s Office (ICO) under number {company.icoNumber}.
      </p>
      <p>
        Questions about this policy or your data: <a href={`mailto:${company.email}`}>{company.email}</a>. We have not appointed a Data Protection Officer because we are not legally required to, but our privacy contact will handle all data protection enquiries.
      </p>

      <h2>2. What personal data we collect</h2>
      <p>Depending on how you interact with us, we may collect:</p>
      <ul>
        <li><b>Identity and contact data</b> — name, e-mail address, phone number, billing and delivery address.</li>
        <li><b>Order and transaction data</b> — products ordered, order number, price paid, delivery status, returns and refunds. Card details are entered directly with our payment processor; we never see or store your full card number.</li>
        <li><b>Customer service data</b> — the content of e-mails, chat or phone conversations you have with us, including any photos you send us for a warranty or return.</li>
        <li><b>Technical and usage data</b> — IP address, browser type and version, device type, operating system, pages visited, time spent, referring website, approximate location (city/country) derived from your IP address, and the cookie identifiers described in our <Link href="/cookie-policy">Cookie Policy</Link>.</li>
        <li><b>Marketing data</b> — your newsletter subscription, your consent choices, and how you interact with our e-mails (opens and clicks).</li>
        <li><b>Review data</b> — if you leave a product review, your name (or the name you choose to display), the review text and any photos you upload.</li>
      </ul>
      <p>We do not knowingly collect special category data (such as health data) and we do not collect data from children (see section 11).</p>

      <h2>3. How we collect it</h2>
      <ul>
        <li>Directly from you when you place an order, subscribe to our newsletter, leave a review or contact us.</li>
        <li>Automatically through cookies and similar technologies when you browse the site (see the Cookie Policy).</li>
        <li>From third parties such as our payment processor (payment confirmation, fraud checks) and our delivery partners (delivery status).</li>
      </ul>

      <h2>4. Why we use your data and our lawful bases</h2>
      <p>Under the UK GDPR we must have a lawful basis for every use of your personal data. We rely on the following:</p>
      <table>
        <thead>
          <tr>
            <th>Purpose</th>
            <th>Data used</th>
            <th>Lawful basis</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Processing and delivering your order, taking payment, handling returns and refunds</td>
            <td>Identity, contact, order and transaction data</td>
            <td>Performance of a contract (Art. 6(1)(b))</td>
          </tr>
          <tr>
            <td>Providing the 3-year warranty and the 60-day money-back guarantee</td>
            <td>Identity, contact, order and customer service data</td>
            <td>Performance of a contract (Art. 6(1)(b))</td>
          </tr>
          <tr>
            <td>Answering your questions and complaints</td>
            <td>Identity, contact and customer service data</td>
            <td>Legitimate interests (Art. 6(1)(f)) — running our business and serving customers well</td>
          </tr>
          <tr>
            <td>Keeping accounting, tax and consumer-law records</td>
            <td>Order and transaction data</td>
            <td>Legal obligation (Art. 6(1)(c)) — e.g. Companies Act 2006, VAT Act 1994</td>
          </tr>
          <tr>
            <td>Preventing fraud and keeping the site secure</td>
            <td>Technical, order and transaction data</td>
            <td>Legitimate interests (Art. 6(1)(f)) — protecting our business and customers</td>
          </tr>
          <tr>
            <td>Sending our newsletter and offers by e-mail</td>
            <td>Contact and marketing data</td>
            <td>Consent (Art. 6(1)(a)); or the PECR &quot;soft opt-in&quot; for existing customers, with an opt-out in every message</td>
          </tr>
          <tr>
            <td>Measuring how the site is used (Google Analytics)</td>
            <td>Technical and usage data</td>
            <td>Consent (Art. 6(1)(a)) — collected through the cookie banner</td>
          </tr>
          <tr>
            <td>Measuring our advertising and showing you relevant ads (Google Ads, remarketing)</td>
            <td>Technical and usage data, hashed e-mail for conversion matching</td>
            <td>Consent (Art. 6(1)(a)) — collected through the cookie banner</td>
          </tr>
          <tr>
            <td>Publishing product reviews</td>
            <td>Review data</td>
            <td>Consent (Art. 6(1)(a))</td>
          </tr>
        </tbody>
      </table>
      <p>Where we rely on legitimate interests we have balanced them against your rights and interests. You can ask us for details of that assessment.</p>

      <h2>5. Google services and advertising</h2>
      <p>
        We use services provided by Google Ireland Limited and Google LLC. These only place cookies or read identifiers once you have given consent through our cookie banner (we use Google Consent Mode, so Google tags run in a restricted, cookieless mode until you accept).
      </p>
      <ul>
        <li>
          <b>Google Analytics 4</b> — produces statistics about visits (pages viewed, device, approximate location). IP addresses are not logged or stored by Google Analytics 4. Data is retained in Google Analytics for 14 months. You can also opt out with the{" "}
          <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener noreferrer" target="_blank">Google Analytics opt-out browser add-on</a>.
        </li>
        <li>
          <b>Google Ads conversion tracking and remarketing</b> — lets us know whether an ad led to a purchase and lets us show you Vortex ads on Google and partner sites after you have visited us. You can manage ad personalisation at{" "}
          <a href="https://adssettings.google.com" rel="noopener noreferrer" target="_blank">adssettings.google.com</a> and learn how Google uses data at{" "}
          <a href="https://policies.google.com/technologies/partner-sites" rel="noopener noreferrer" target="_blank">policies.google.com/technologies/partner-sites</a>.
        </li>
        <li>
          <b>Enhanced conversions</b> — if enabled, we send Google a hashed (one-way encrypted) version of the e-mail address you enter at checkout so that conversions can be matched more accurately. Google cannot reverse the hash.
        </li>
      </ul>
      <p>
        We also sell through and advertise on Google Shopping. Google&apos;s privacy policy applies to data processed by Google:{" "}
        <a href="https://policies.google.com/privacy" rel="noopener noreferrer" target="_blank">policies.google.com/privacy</a>.
      </p>

      <h2>6. Who we share your data with</h2>
      <p>We share personal data only where necessary and only with providers bound by contract to protect it:</p>
      <ul>
        <li><b>Payment processors</b> — to take payment and run fraud and 3-D Secure checks.</li>
        <li><b>Delivery partners and couriers</b> — name, address, phone and e-mail so they can deliver your order and send tracking updates.</li>
        <li><b>Hosting and IT providers</b> — the site is hosted by Vercel Inc.; e-mails and customer service tools may be provided by third-party platforms.</li>
        <li><b>E-mail marketing platform</b> — to send our newsletter, if you have subscribed.</li>
        <li><b>Google</b> — as described in section 5.</li>
        <li><b>Professional advisers</b> — accountants, lawyers and insurers where needed.</li>
        <li><b>Authorities</b> — HMRC, courts, regulators or the police where the law requires it.</li>
      </ul>
      <p>We do not sell your personal data.</p>

      <h2>7. International transfers</h2>
      <p>
        Some of our providers (for example Google and Vercel) process data in the United States or other countries outside the UK. Where this happens we make sure an appropriate safeguard is in place: an adequacy regulation issued by the UK Government (including the UK Extension to the EU-US Data Privacy Framework), or the ICO&apos;s International Data Transfer Agreement / Addendum to the EU Standard Contractual Clauses. You can ask us for a copy of the relevant safeguard.
      </p>

      <h2>8. How long we keep your data</h2>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Retention period</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Order, invoice and payment records</td>
            <td>6 years after the end of the financial year of the order (HMRC and Companies Act requirements)</td>
          </tr>
          <tr>
            <td>Warranty and returns correspondence</td>
            <td>Duration of the 3-year warranty plus 12 months</td>
          </tr>
          <tr>
            <td>Customer service e-mails (no order)</td>
            <td>24 months after the last contact</td>
          </tr>
          <tr>
            <td>Newsletter subscription</td>
            <td>Until you unsubscribe, then a suppression record so we do not e-mail you again</td>
          </tr>
          <tr>
            <td>Cookie consent record</td>
            <td>12 months, after which we ask you again</td>
          </tr>
          <tr>
            <td>Google Analytics data</td>
            <td>14 months</td>
          </tr>
          <tr>
            <td>Product reviews</td>
            <td>While the product is sold, or until you ask us to remove your review</td>
          </tr>
        </tbody>
      </table>

      <h2>9. Your rights</h2>
      <p>Under the UK GDPR you have the right to:</p>
      <ul>
        <li><b>Access</b> — get a copy of the personal data we hold about you.</li>
        <li><b>Rectification</b> — have inaccurate or incomplete data corrected.</li>
        <li><b>Erasure</b> — ask us to delete your data where there is no good reason for us to keep it.</li>
        <li><b>Restriction</b> — ask us to pause the use of your data in certain circumstances.</li>
        <li><b>Portability</b> — receive the data you gave us in a machine-readable format, or have it sent to another provider.</li>
        <li><b>Object</b> — object to processing based on legitimate interests, and object at any time to direct marketing.</li>
        <li><b>Withdraw consent</b> — at any time where we rely on consent (for example cookies or the newsletter), without affecting the lawfulness of processing before withdrawal.</li>
        <li><b>Not be subject to automated decisions</b> — we do not make decisions with legal or similarly significant effects based solely on automated processing.</li>
      </ul>
      <p>
        To exercise any right, e-mail <a href={`mailto:${company.email}`}>{company.email}</a>. We will respond within one month (extendable by two further months for complex requests, in which case we will tell you). We do not charge a fee unless a request is manifestly unfounded or excessive. We may ask you to confirm your identity first.
      </p>

      <h2>10. Complaints</h2>
      <p>
        We would like the chance to resolve any concern, so please contact us first. You also have the right to lodge a complaint with the UK supervisory authority: Information Commissioner&apos;s Office, Wycliffe House, Water Lane, Wilmslow, Cheshire SK9 5AF; helpline 0303 123 1113;{" "}
        <a href="https://ico.org.uk/make-a-complaint/" rel="noopener noreferrer" target="_blank">ico.org.uk/make-a-complaint</a>.
      </p>

      <h2>11. Children</h2>
      <p>
        Our products and website are intended for adults. We do not knowingly collect personal data from anyone under 18, and orders may only be placed by people aged 18 or over. If you believe a child has given us personal data, contact us and we will delete it.
      </p>

      <h2>12. Security</h2>
      <p>
        We use appropriate technical and organisational measures to protect your data, including HTTPS encryption across the whole site, PCI DSS-compliant payment processing (we never store card numbers), access controls and staff confidentiality obligations. No method of transmission over the internet is completely secure, so we cannot guarantee absolute security, but we will notify you and the ICO of any personal data breach where the law requires it.
      </p>

      <h2>13. Marketing</h2>
      <p>
        We will only send you marketing e-mails if you have subscribed, or if you are an existing customer and did not opt out when you gave us your details (the PECR &quot;soft opt-in&quot;). Every marketing e-mail contains an unsubscribe link. You can also e-mail us to stop at any time. We do not send marketing by SMS or post, and we never share your details with other companies for their own marketing.
      </p>

      <h2>14. Cookies</h2>
      <p>
        Details of every cookie we use, why, and how to change your choices are in our <Link href="/cookie-policy">Cookie Policy</Link>.
      </p>

      <h2>15. Third-party links</h2>
      <p>
        Our site may link to third-party websites (for example our payment provider or social networks). We are not responsible for their privacy practices — please read their policies.
      </p>

      <h2>16. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. The &quot;last updated&quot; date at the top shows the current version. If a change is significant we will tell existing customers by e-mail or with a notice on the site.
      </p>

      <h2>17. Contact</h2>
      <p>
        {company.legalName}, trading as {company.tradingName}
        <br />
        {company.registeredOffice}
        <br />
        E-mail: <a href={`mailto:${company.email}`}>{company.email}</a>
        <br />
        Phone: {company.phone} ({company.serviceHours})
      </p>
    </PolicyPage>
  );
}
