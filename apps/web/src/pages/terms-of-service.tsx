import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-[#CCFF00] transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            Terms of <span className="text-[#CCFF00]">Service</span>
          </h1>
          <p className="text-white/40 mt-3 text-sm">Last Updated: February 19, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        <p className="text-white/60 leading-relaxed">
          Please read these Terms of Service ("Terms", "ToS") carefully before using the DevSage
          website and hackathon platform (the "Service") operated by DevSage ("us", "we", or "our").
          By accessing or using the Service, you agree to be bound by these Terms. If you disagree
          with any part of the terms, you may not access the Service.
        </p>

        {/* Section 1 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            1. Account Registration
          </h2>
          <ul className="space-y-3 text-white/50 leading-relaxed ml-4">
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span><strong className="text-white/70">Eligibility:</strong> You must be at least 13 years of age to use this Service.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span><strong className="text-white/70">Account Security:</strong> You are responsible for maintaining the confidentiality of your account credentials. You agree to accept responsibility for all activities that occur under your account.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span><strong className="text-white/70">GitHub Integration:</strong> To use certain features, you must link a valid GitHub account. You represent that you have the right to grant us access to the repositories you submit for analysis.</span>
            </li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            2. Hackathon Participation & Submissions
          </h2>
          <ul className="space-y-3 text-white/50 leading-relaxed ml-4">
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span><strong className="text-white/70">Ownership:</strong> You retain all intellectual property rights to the code and content you submit. By submitting a project, you grant DevSage and the specific hackathon organizers a non-exclusive license to review, score, and display your submission.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span><strong className="text-white/70">Prohibited Content:</strong> You may not submit projects that contain malicious code, malware, or content that violates third-party intellectual property rights.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span><strong className="text-white/70">Automated Analysis:</strong> You acknowledge that DevSage uses Google Gemini AI to analyze and score submissions. While we strive for accuracy, AI-generated scores are provided "as-is" and are subject to the final discretion of hackathon organizers.</span>
            </li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            3. Code of Conduct
          </h2>
          <p className="text-white/50 leading-relaxed">
            Users agree to use the Service in a manner consistent with professional and ethical standards. You agree not to:
          </p>
          <ul className="space-y-2 text-white/50 leading-relaxed ml-4">
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span>Circumvent or attempt to circumvent any security features of the Service.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span>Use automated scripts or "bots" to scrape data or manipulate hackathon results.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span>Impersonate other users or provide false information during registration.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span>Harass, threaten, or intimidate other participants or organizers.</span>
            </li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            4. Platform Usage & AI Disclaimer
          </h2>
          <ul className="space-y-3 text-white/50 leading-relaxed ml-4">
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span><strong className="text-white/70">Service Availability:</strong> We strive for 24/7 uptime but do not guarantee that the Service will be uninterrupted or error-free.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span><strong className="text-white/70">AI Limitations:</strong> AI analysis (via Gemini) is an assistive tool. DevSage is not liable for any perceived inaccuracies in automated code reviews, scoring discrepancies, or technical hallucinations generated by the AI model.</span>
            </li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            5. Intellectual Property
          </h2>
          <p className="text-white/50 leading-relaxed">
            The Service and its original content (excluding user-submitted projects), features, and functionality
            are and will remain the exclusive property of DevSage and its licensors. Our trademarks and trade dress
            may not be used in connection with any product or service without our prior written consent.
          </p>
        </section>

        {/* Section 6 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            6. Termination
          </h2>
          <p className="text-white/50 leading-relaxed">
            We may terminate or suspend your account immediately, without prior notice or liability, for any reason,
            including without limitation if you breach the Terms. Upon termination, your right to use the Service
            will cease immediately.
          </p>
        </section>

        {/* Section 7 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            7. Limitation of Liability
          </h2>
          <p className="text-white/50 leading-relaxed">
            In no event shall DevSage, nor its directors, employees, or partners, be liable for any indirect,
            incidental, special, or consequential damages resulting from (i) your access to or use of the Service;
            (ii) any conduct or content of any third party on the Service; or (iii) unauthorized access, use, or
            alteration of your transmissions or content.
          </p>
        </section>

        {/* Section 8 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            8. Governing Law
          </h2>
          <p className="text-white/50 leading-relaxed">
            These Terms shall be governed and construed in accordance with the applicable laws, without regard to
            conflict of law provisions.
          </p>
        </section>

        {/* Section 9 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            9. Changes to Terms
          </h2>
          <p className="text-white/50 leading-relaxed">
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will
            provide notice of any significant changes by posting the new Terms on this page.
          </p>
        </section>

        {/* Section 10 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            10. Contact Us
          </h2>
          <p className="text-white/50 leading-relaxed">
            If you have any questions about these Terms, please contact us at:{' '}
            <a
              href="https://mail.google.com/mail/?view=cm&fs=1&to=support@devsage.org&su=Terms%20of%20Service%20Inquiry"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#CCFF00] hover:underline"
            >
              support@devsage.org
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}

export default TermsOfServicePage;
