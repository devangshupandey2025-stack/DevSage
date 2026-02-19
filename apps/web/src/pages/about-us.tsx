import { Link } from 'react-router-dom';
import { ArrowLeft, Brain, Github, Users } from 'lucide-react';

export function AboutUsPage() {
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
            About <span className="text-[#CCFF00]">DevSage</span>
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        {/* Mission */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            Our Mission
          </h2>
          <p className="text-white/55 leading-relaxed text-[15px]">
            At <strong className="text-white/80">DevSage</strong>, we believe that every line of code
            tells a story. Our mission is to empower developers, hackathon organizers, and communities
            by creating a seamless, intelligent, and transparent ecosystem for innovation. We aim to
            revolutionize how hackathons are managed and how projects are evaluated, ensuring that true
            skill and creativity are recognized.
          </p>
        </section>

        {/* What is DevSage */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            What is DevSage?
          </h2>
          <p className="text-white/55 leading-relaxed text-[15px]">
            DevSage is a cutting-edge <strong className="text-white/80">Hackathon Management Platform</strong>{' '}
            designed for the modern developer. Unlike traditional platforms that rely solely on manual review,
            DevSage integrates advanced Artificial Intelligence to provide deep insights into every submission.
          </p>
          <p className="text-white/55 leading-relaxed text-[15px]">
            By combining robust project management tools with the power of{' '}
            <strong className="text-white/80">Google Gemini AI</strong>, we offer a unique experience:
          </p>
          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            <div className="bg-white/[0.03] border border-white/8 rounded-xl p-6">
              <span className="text-[#CCFF00] text-xs font-bold uppercase tracking-widest">For Participants</span>
              <p className="text-white/50 mt-3 text-sm leading-relaxed">
                Get instant, AI-generated feedback on your code, structure, and tech stack.
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/8 rounded-xl p-6">
              <span className="text-[#CCFF00] text-xs font-bold uppercase tracking-widest">For Organizers</span>
              <p className="text-white/50 mt-3 text-sm leading-relaxed">
                Streamline the judging process with automated scoring assistance, ensuring no bug goes
                unnoticed and no genius innovation gets overlooked.
              </p>
            </div>
          </div>
        </section>

        {/* Key Features */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            Key Features
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="bg-white/[0.03] border border-white/8 rounded-xl p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[#CCFF00]/10 flex items-center justify-center mx-auto mb-4">
                <Brain className="w-6 h-6 text-[#CCFF00]" />
              </div>
              <h3 className="text-white/80 font-semibold mb-2">AI-Powered Analysis</h3>
              <p className="text-white/40 text-sm leading-relaxed">
                Leveraging LLMs to analyze repositories, detect frameworks, estimate complexity, and provide
                constructive code reviews automatically.
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/8 rounded-xl p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[#CCFF00]/10 flex items-center justify-center mx-auto mb-4">
                <Github className="w-6 h-6 text-[#CCFF00]" />
              </div>
              <h3 className="text-white/80 font-semibold mb-2">Seamless GitHub Integration</h3>
              <p className="text-white/40 text-sm leading-relaxed">
                Deep GitHub integration to fetch repositories, analyze commit history, and verify stack usage
                without you lifting a finger.
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/8 rounded-xl p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[#CCFF00]/10 flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-[#CCFF00]" />
              </div>
              <h3 className="text-white/80 font-semibold mb-2">Role-Based Ecosystem</h3>
              <p className="text-white/40 text-sm leading-relaxed">
                Tailored dashboards and tools for Participants, Organizers, and Judges — each role gets exactly
                what they need.
              </p>
            </div>
          </div>
        </section>

        {/* Our Story */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            Our Story
          </h2>
          <p className="text-white/55 leading-relaxed text-[15px]">
            DevSage started as a solution to a common problem: hackathon judging is hard, subjective,
            and often rushed. We wanted to build a tool that could objectively look at the code behind the pitch.
            What began as a simple script to count lines of code has evolved into a full-platform solution that
            understands the nuance of software development.
          </p>
        </section>

        {/* Contact */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
            Contact Us
          </h2>
          <p className="text-white/55 leading-relaxed text-[15px]">
            We are constantly evolving. If you have feedback, feature requests, or just want to say hi, reach out
            to us at:{' '}
            <a
              href="https://mail.google.com/mail/?view=cm&fs=1&to=support@devsage.org&su=Hello%20DevSage"
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

export default AboutUsPage;
