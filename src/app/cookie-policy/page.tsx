import type { Metadata } from "next";
import Link from "next/link";
import CookieSettingsButton from "@/components/CookieSettingsButton";
import PolicyPage from "@/components/PolicyPage";
import { company } from "@/data/company";

export const metadata: Metadata = {
  title: "Cookie Policy – Vortex UK",
  description: "The cookies and similar technologies used on the Vortex UK website, and how to manage your choices (PECR / UK GDPR).",
  alternates: { canonical: "/cookie-policy" },
};

export default function CookiePolicy() {
  return (
    <PolicyPage
      title="Cookie Policy"
      intro={`This policy explains what cookies and similar technologies ${company.tradingName} uses on ${company.website}, why, and how you can control them. It complements our Privacy Policy and is written to comply with the Privacy and Electronic Communications Regulations 2003 (PECR) and the UK GDPR, following the guidance of the Information Commissioner's Office (ICO).`}
    >
      <h2>1. What are cookies?</h2>
      <p>
        Cookies are small text files placed on your device by a website. Similar technologies include local storage, pixels and tags. They let a site remember your actions and preferences, measure usage or deliver advertising. Some cookies are placed by us (first-party) and some by other organisations whose services we use (third-party), such as Google.
      </p>

      <h2>2. Your consent</h2>
      <p>
        Under PECR we may only place cookies that are <b>not</b> strictly necessary once you have given consent. When you first visit, our cookie banner sets every non-essential category to &quot;denied&quot; and asks you to choose. Nothing non-essential is loaded until you click &quot;Accept all&quot; or save custom preferences. We record your choice for 12 months, after which we ask again. You can change your mind at any time:
      </p>
      <p>
        <CookieSettingsButton />
      </p>
      <p>
        We implement Google Consent Mode v2, which means Google tags respect your choice: with consent denied they do not set advertising or analytics cookies and only send cookieless, aggregated signals.
      </p>

      <h2>3. Cookies we use</h2>

      <h3>3.1 Strictly necessary (always on)</h3>
      <p>These are needed for the site to work and cannot be switched off. They do not require consent under PECR.</p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Provider</th>
            <th>Purpose</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>vortex-uk-consent</td>
            <td>{company.tradingName} (local storage)</td>
            <td>Stores your cookie choices so we do not ask on every page</td>
            <td>12 months</td>
          </tr>
          <tr>
            <td>__cf_bm, _vercel_*</td>
            <td>Vercel / hosting</td>
            <td>Security, bot protection and load balancing</td>
            <td>Session to 30 minutes</td>
          </tr>
          <tr>
            <td>Checkout and payment cookies</td>
            <td>Our checkout and payment provider</td>
            <td>Keeping your basket, completing payment, 3-D Secure fraud checks</td>
            <td>Session to 1 year</td>
          </tr>
        </tbody>
      </table>

      <h3>3.2 Analytics (with your consent)</h3>
      <p>Help us understand how visitors use the site so we can improve it. Data is aggregated and does not identify you personally.</p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Provider</th>
            <th>Purpose</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>_ga</td>
            <td>Google Analytics</td>
            <td>Distinguishes visitors with a random identifier</td>
            <td>2 years</td>
          </tr>
          <tr>
            <td>_ga_&lt;container-id&gt;</td>
            <td>Google Analytics</td>
            <td>Keeps the session state</td>
            <td>2 years</td>
          </tr>
          <tr>
            <td>_gid</td>
            <td>Google Analytics</td>
            <td>Distinguishes visitors</td>
            <td>24 hours</td>
          </tr>
        </tbody>
      </table>

      <h3>3.3 Advertising (with your consent)</h3>
      <p>Used to measure whether our Google Ads led to a purchase and to show you Vortex ads on Google and partner sites (remarketing).</p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Provider</th>
            <th>Purpose</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>_gcl_au</td>
            <td>Google Ads</td>
            <td>Conversion measurement (which ad led to a sale)</td>
            <td>90 days</td>
          </tr>
          <tr>
            <td>_gcl_aw, _gcl_gb</td>
            <td>Google Ads</td>
            <td>Stores the click identifier from a Google ad</td>
            <td>90 days</td>
          </tr>
          <tr>
            <td>IDE, test_cookie</td>
            <td>Google (doubleclick.net)</td>
            <td>Remarketing and ad frequency capping</td>
            <td>13 months / 15 minutes</td>
          </tr>
          <tr>
            <td>NID, 1P_JAR</td>
            <td>Google</td>
            <td>Ad personalisation on Google services</td>
            <td>6 months / 1 month</td>
          </tr>
        </tbody>
      </table>
      <p>
        Google&apos;s own information about these cookies:{" "}
        <a href="https://policies.google.com/technologies/cookies" rel="noopener noreferrer" target="_blank">policies.google.com/technologies/cookies</a>. Manage Google ad personalisation at{" "}
        <a href="https://adssettings.google.com" rel="noopener noreferrer" target="_blank">adssettings.google.com</a>.
      </p>

      <h2>4. Managing cookies in your browser</h2>
      <p>
        Besides our banner, you can block or delete cookies in your browser settings. Blocking strictly necessary cookies may stop the checkout from working. Instructions:{" "}
        <a href="https://support.google.com/chrome/answer/95647" rel="noopener noreferrer" target="_blank">Chrome</a>,{" "}
        <a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" rel="noopener noreferrer" target="_blank">Firefox</a>,{" "}
        <a href="https://support.apple.com/en-gb/guide/safari/sfri11471/mac" rel="noopener noreferrer" target="_blank">Safari</a>,{" "}
        <a href="https://support.microsoft.com/en-gb/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-abed-3e6c-3bdf-2f5f4d8b6dda" rel="noopener noreferrer" target="_blank">Edge</a>. More guidance from the ICO:{" "}
        <a href="https://ico.org.uk/for-the-public/online/cookies/" rel="noopener noreferrer" target="_blank">ico.org.uk/for-the-public/online/cookies</a>.
      </p>

      <h2>5. Changes</h2>
      <p>
        We review this list regularly and update it when we add or remove a service. The date at the top shows the latest version. For how we use the data collected by cookies, see our <Link href="/privacy-policy">Privacy Policy</Link>.
      </p>

      <h2>6. Contact</h2>
      <p>
        Questions about cookies: <a href={`mailto:${company.email}`}>{company.email}</a>.
      </p>
    </PolicyPage>
  );
}
