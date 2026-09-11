import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage from "@/components/PolicyPage";
import { company } from "@/data/company";

export const metadata: Metadata = {
  title: "Legal Notice – Vortex UK",
  description: "Company information for Vortex UK as required by the Companies Act 2006 and the Electronic Commerce (EC Directive) Regulations 2002.",
  alternates: { canonical: "/legal-notice" },
};

export default function LegalNotice() {
  return (
    <PolicyPage
      title="Legal Notice"
      intro="The information on this page is provided in accordance with the Companies Act 2006, the Company, Limited Liability Partnership and Business (Names and Trading Disclosures) Regulations 2015 and the Electronic Commerce (EC Directive) Regulations 2002."
    >
      <h2>Website operator</h2>
      <table>
        <tbody>
          <tr>
            <th>Trading name</th>
            <td>{company.tradingName}</td>
          </tr>
          <tr>
            <th>Legal entity</th>
            <td>{company.legalName}</td>
          </tr>
          <tr>
            <th>Company number</th>
            <td>{company.companyNumber} (registered in England and Wales)</td>
          </tr>
          <tr>
            <th>Registered office</th>
            <td>{company.registeredOffice}</td>
          </tr>
          <tr>
            <th>VAT number</th>
            <td>{company.vatNumber}</td>
          </tr>
          <tr>
            <th>ICO registration</th>
            <td>{company.icoNumber}</td>
          </tr>
          <tr>
            <th>E-mail</th>
            <td>
              <a href={`mailto:${company.email}`}>{company.email}</a>
            </td>
          </tr>
          <tr>
            <th>Phone</th>
            <td>
              {company.phone} — {company.serviceHours}
            </td>
          </tr>
          <tr>
            <th>Website</th>
            <td>{company.website}</td>
          </tr>
        </tbody>
      </table>

      <h2>Hosting</h2>
      <p>This website is hosted by Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, United States.</p>

      <h2>Trade marks</h2>
      <p>
        VORTEX and the VORTEX logo are trade marks of their respective owner. {company.tradingName} is an authorised reseller. All other trade marks mentioned belong to their owners.
      </p>

      <h2>Product safety</h2>
      <p>
        The VORTEX Z10 is supplied with a UK charger and user manual. Please read the manual before first use. Private e-scooters may only be ridden on private land with the landowner&apos;s permission in the United Kingdom; see our <Link href="/terms-of-service">Terms of Service</Link>. Report any safety concern to <a href={`mailto:${company.email}`}>{company.email}</a>.
      </p>

      <h2>Dispute resolution</h2>
      <p>
        We try to resolve every complaint directly. Consumers may also seek free advice from the Citizens Advice consumer service on 0808 223 1133. The European Commission online dispute resolution platform no longer applies to UK traders.
      </p>

      <h2>Our policies</h2>
      <ul>
        <li>
          <Link href="/privacy-policy">Privacy Policy</Link>
        </li>
        <li>
          <Link href="/cookie-policy">Cookie Policy</Link>
        </li>
        <li>
          <Link href="/terms-of-service">Terms of Service</Link>
        </li>
        <li>
          <Link href="/refund-policy">Refund &amp; Returns Policy</Link>
        </li>
        <li>
          <Link href="/shipping-policy">Shipping Policy</Link>
        </li>
      </ul>
    </PolicyPage>
  );
}
