import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function PrivacyPolicyPage() {
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
            Privacy <span className="text-[#CCFF00]">Policy</span>
          </h1>
          <p className="text-white/40 mt-3 text-sm">Last Updated: February 19, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        <p className="text-white/60 leading-relaxed">
          Welcome to DevSage ("we," "our," or "us"). We are committed to protecting your personal
          information and your right to privacy. This Privacy Policy explains how we collect, use,
          disclose, and safeguard your information when you visit our website and use our hackathon
          management platform (the "Service").
        </p>

        {/* Section 1 */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            1. Information We Collect
          </h2>
          <p className="text-white/50 leading-relaxed">
            We collect information that you voluntarily provide to us when you register on the
            Service, participate in hackathons, or otherwise contact us.
          </p>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white/80">A. Personal Information</h3>
            <ul className="space-y-2 text-white/50 leading-relaxed ml-4">
              <li className="flex gap-2">
                <span className="text-[#CCFF00] shrink-0">•</span>
                <span><strong className="text-white/70">Account Data:</strong> When you register, we collect your Name, Email Address, and Password (which is securely hashed).</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#CCFF00] shrink-0">•</span>
                <span><strong className="text-white/70">Profile Data:</strong> We may collect your Avatar URL and GitHub Username.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#CCFF00] shrink-0">•</span>
                <span><strong className="text-white/70">Hackathon Data:</strong> We collect information related to your participation in hackathons, including team memberships, roles (e.g., organizer, participant), and project submissions.</span>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white/80">B. User Content</h3>
            <ul className="space-y-2 text-white/50 leading-relaxed ml-4">
              <li className="flex gap-2">
                <span className="text-[#CCFF00] shrink-0">•</span>
                <span><strong className="text-white/70">Submissions:</strong> When you submit a project, we collect the Project Title, Description, Repository URL, Demo URL, Video URL, and Slide URL.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#CCFF00] shrink-0">•</span>
                <span><strong className="text-white/70">Code Access:</strong> By linking your GitHub account, you grant us access to read your public repositories for the purpose of code analysis and verification. We do not modify your code.</span>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white/80">C. Automatically Collected Information</h3>
            <ul className="space-y-2 text-white/50 leading-relaxed ml-4">
              <li className="flex gap-2">
                <span className="text-[#CCFF00] shrink-0">•</span>
                <span><strong className="text-white/70">Log and Usage Data:</strong> We collect log data such as your IP address, browser type, and access times.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#CCFF00] shrink-0">•</span>
                <span><strong className="text-white/70">Cookies:</strong> We use cookies to manage your session (access_token, refresh_token).</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            2. How We Use Your Information
          </h2>
          <ul className="space-y-2 text-white/50 leading-relaxed ml-4">
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span>To facilitate account creation and logon process.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span>To facilitate hackathon participation: Managing teams, submissions, and judging.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span>To provide AI-powered features: We use third-party AI services (Google Gemini) to analyze your code submissions for automated reviews and scoring.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span>To send administrative information: We may send you notifications regarding your account, security alerts, and policy updates.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span>To protect our Services: We monitor for fraud and unauthorized activity (e.g., through audit logs).</span>
            </li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            3. Sharing Your Information
          </h2>
          <p className="text-white/50 leading-relaxed">
            We do not sell your personal information. We may share information with:
          </p>
          <ul className="space-y-2 text-white/50 leading-relaxed ml-4">
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span><strong className="text-white/70">Service Providers:</strong> We may share your data with third-party vendors, service providers, contractors, or agents who perform services for us (e.g., Cloudflare for hosting/database, Google Gemini for AI analysis).</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span><strong className="text-white/70">GitHub:</strong> We interact with the GitHub API to fetch your repository data as authorized by you.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span><strong className="text-white/70">Hackathon Organizers:</strong> If you participate in a hackathon, your name, email, and submission details may be visible to the organizers of that specific event.</span>
            </li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            4. Third-Party Services
          </h2>
          <div className="space-y-4">
            <div className="bg-white/[0.03] border border-white/8 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white/80 mb-2">GitHub</h3>
              <p className="text-white/50 leading-relaxed text-sm">
                Our Service integrates with GitHub. By authenticating with GitHub, you are subject to GitHub's Privacy Policy. We store your GitHub username and access public repository data only as needed for the Service.
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/8 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white/80 mb-2">Google Gemini AI</h3>
              <p className="text-white/50 leading-relaxed text-sm">
                We use Google's Gemini AI to analyze code submissions. Code snippets or repository contents may be processed by Google's servers for the purpose of generating reviews and scores.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            5. Data Retention and Security
          </h2>
          <p className="text-white/50 leading-relaxed">
            We retain your personal information only for as long as is necessary for the purposes set out in this Privacy Policy.
            We use industry-standard security measures, including hashing passwords and using secure HTTP cookies.
            However, no electronic transmission or storage is 100% secure, so we cannot guarantee absolute security.
          </p>
        </section>

        {/* Section 6 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            6. Your Privacy Rights
          </h2>
          <ul className="space-y-2 text-white/50 leading-relaxed ml-4">
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span><strong className="text-white/70">Access and Update:</strong> You can review and change your account information by logging into your account settings.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span><strong className="text-white/70">Account Deletion:</strong> You may request to delete your account directly through the application. Upon confirmation, your account and associated personal data will be permanently removed from our active databases.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#CCFF00] shrink-0">•</span>
              <span><strong className="text-white/70">Session Management:</strong> You can view and revoke active sessions from your account dashboard.</span>
            </li>
          </ul>
        </section>

        {/* Section 7 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            7. Children's Privacy
          </h2>
          <p className="text-white/50 leading-relaxed">
            Our Service is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13.
          </p>
        </section>

        {/* Section 8 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            8. Updates to This Policy
          </h2>
          <p className="text-white/50 leading-relaxed">
            We may update this privacy policy from time to time. The updated version will be indicated by an updated "Revised" date and will be effective as soon as it is accessible.
          </p>
        </section>

        {/* Section 9 */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            9. Contact Us
          </h2>
          <p className="text-white/50 leading-relaxed">
            If you have questions or comments about this policy, you may email us at:{' '}
            <a
              href="https://mail.google.com/mail/?view=cm&fs=1&to=support@devsage.org&su=Privacy%20Policy%20Inquiry"
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

export default PrivacyPolicyPage;
