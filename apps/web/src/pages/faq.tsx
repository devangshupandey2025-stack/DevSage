import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  items: FAQItem[];
}

const faqData: FAQCategory[] = [
  {
    title: 'General & Account',
    items: [
      {
        question: 'What is DevSage?',
        answer:
          'DevSage is a platform that simplifies hackathon management and project submission. We use AI to analyze code, provide feedback, and assist organizers in running successful developer events.',
      },
      {
        question: 'Do I need a GitHub account to use DevSage?',
        answer:
          'Yes. Since our platform is centered around code submissions and analysis, we require a valid GitHub account. This allows us to verify your repositories and analyze your projects directly from the source.',
      },
      {
        question: 'Is DevSage free to use?',
        answer:
          'Generally yes! Creating an account and participating in public hackathons is free. Some advanced features for organizers or premium hackathon hosting may require specific permissions or plans.',
      },
      {
        question: 'How do I delete my account?',
        answer:
          'You can request account deletion from your profile settings. Once confirmed, we will permanently remove your personal data and revoke all access tokens. Please note that this action is irreversible.',
      },
    ],
  },
  {
    title: 'For Participants',
    items: [
      {
        question: 'Can I participate in a hackathon alone?',
        answer:
          'Absolutely! You can participate as a solo developer or form a team with others. Our platform supports both modes.',
      },
      {
        question: 'How do I submit my project?',
        answer:
          'Once you are registered for a hackathon, go to your team dashboard. You will see an option to submit your project details, including the GitHub repository URL, a demo link, and a brief description.',
      },
      {
        question: 'Can I edit my submission after submitting?',
        answer:
          'You can edit your submission details (like description or demo URL) anytime before the submission deadline defined by the hackathon organizers.',
      },
      {
        question: 'Who can see my code?',
        answer:
          'Your repository URL will be shared with the hackathon organizers and judges. If your repository is public on GitHub, anyone with the link can view it. We do not modify your code.',
      },
    ],
  },
  {
    title: 'For Organizers',
    items: [
      {
        question: 'How do I create a hackathon?',
        answer:
          'Only users with the \'Organizer\' role can create hackathons. If you wish to host an event, please contact our support team or apply for organizer status through the platform.',
      },
      {
        question: 'Can I add co-organizers?',
        answer:
          'Yes! As a lead organizer, you can invite other users to help manage your event by assigning them \'co-organizer\' roles through the organizer dashboard.',
      },
    ],
  },
  {
    title: 'Artificial Intelligence & Scoring',
    items: [
      {
        question: 'How does the AI scoring work?',
        answer:
          'We use Google\'s Gemini AI to analyze aspects of your codebase such as project complexity, code structure and organization, usage of frameworks and libraries, and completeness (presence of README, tests, etc.). The AI provides a score and a review, but this is intended to assist human judges, not replace them.',
      },
      {
        question: 'Is the AI score the final result?',
        answer:
          'No. The AI score is a tool for organizers to quickly gauge the technical depth of a project. Final winners are determined by the hackathon organizers and human judges based on their specific criteria.',
      },
      {
        question: 'My project uses a rare language. Will the AI understand it?',
        answer:
          'Our AI models are trained on a vast amount of code in many languages. While it performs best with popular languages (JavaScript, Python, Java, etc.), it can generally analyze the structure and quality of code in most modern programming languages.',
      },
    ],
  },
  {
    title: 'Technical Support',
    items: [
      {
        question: 'I found a bug! Where do I report it?',
        answer:
          'We appreciate your help in improving DevSage! Please report any issues directly to the support email listed on our About Us page or open an issue on our public GitHub repository if applicable.',
      },
      {
        question: 'Why is my repository not showing up?',
        answer:
          'Ensure your GitHub account is correctly linked and that the repository you are looking for is public (unless you have granted private repo access). You may also need to refresh the list in your dashboard.',
      },
    ],
  },
];

function FAQAccordionItem({ item }: { item: FAQItem }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-white/8 rounded-xl overflow-hidden bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-6 py-5 text-left cursor-pointer bg-transparent border-none"
      >
        <span className="text-white/80 font-medium text-[15px] pr-4">{item.question}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-[#CCFF00] shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-white/30 shrink-0" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <p className="px-6 pb-5 text-white/45 text-sm leading-relaxed">{item.answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQPage() {
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
            Frequently Asked <span className="text-[#CCFF00]">Questions</span>
          </h1>
          <p className="text-white/40 mt-3 text-sm">
            Everything you need to know about DevSage
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        {faqData.map((category) => (
          <section key={category.title} className="space-y-4">
            <h2 className="text-xl font-bold text-white border-l-4 border-[#CCFF00] pl-4">
              {category.title}
            </h2>
            <div className="space-y-3">
              {category.items.map((item) => (
                <FAQAccordionItem key={item.question} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default FAQPage;
