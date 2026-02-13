import { config } from '@/config';

export default function Dates() {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const dates = [
    { label: 'Registration Opens', value: config.registrationStart },
    { label: 'Hacking Starts', value: config.hackingStart },
    { label: 'Submission Deadline', value: config.submissionDeadline }
  ];

  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-center text-sm font-bold tracking-widest text-white/50 uppercase mb-12">
          Important Dates
        </h2>
        
        <div className="grid md:grid-cols-3 gap-6">
          {dates.map((item, index) => (
            <div 
              key={index}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              <div 
                className="text-sm font-medium mb-2"
                style={{ color: config.accentColor }}
              >
                {item.label}
              </div>
              <div className="text-lg font-semibold text-white/90">
                {formatDate(item.value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
