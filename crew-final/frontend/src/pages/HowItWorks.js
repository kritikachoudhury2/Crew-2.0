import { Link } from 'react-router-dom';
import { ArrowRight, Shield, CheckCircle, UserCheck, Search, MessageCircle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';

export default function HowItWorks() {
  const steps = [
    { icon: <UserCheck size={20} />, title: 'Create your profile', desc: 'Sport, level, target race, and goals. One question at a time. About 2 minutes.' },
    { icon: <CheckCircle size={20} />, title: 'Verify your email', desc: 'We send a magic link to confirm you are real. No SMS. No app download.' },
    { icon: <Search size={20} />, title: 'Share your location', desc: 'City and neighbourhood help us find athletes you can actually train with.' },
    { icon: <Search size={20} />, title: 'Browse your matches', desc: 'We score compatibility by sport, proximity, level, goals, and race timing. Best matches shown first.' },
    { icon: <MessageCircle size={20} />, title: 'Connect safely', desc: 'Send a request. They accept. WhatsApp opens. Your phone number is never shown on your profile.' },
  ];

  const faqs = [
    { q: 'Why do I need to sign up to browse?', a: 'Every profile on CREW is a real, verified person. Requiring sign-up keeps quality high and protects everyone\'s privacy.' },
    { q: 'How does verification work?', a: 'We send a magic link to your email address. Click it to sign in. No SMS, no app.' },
    { q: 'Does it cost anything to join?', a: 'No cost to join. CREW is built by GrapeLabs AI as a community tool for endurance athletes.' },
    { q: 'Can I list more than one sport?', a: 'Yes. Complete each sport\'s section during onboarding and you will appear in every relevant feed.' },
    { q: 'Is my phone number safe?', a: 'Completely. Stored securely, never shown publicly, only used to generate a WhatsApp link after a mutual connection.' },
    { q: 'How do you stop fake profiles?', a: 'Email verification is required. Profile completeness scoring, a report system, and activity-based ranking keep the community real.' },
    { q: 'Which sports does CREW support?', a: 'CREW currently supports HYROX and Marathon, including all distances from 5K to Ultra.' },
  ];

  return (
    <div data-testid="how-it-works-page">
      <section className="py-14 md:py-24 px-6 md:px-12" style={{ background: '#1C0A30' }}>
        <div className="max-w-4xl mx-auto">
          <h1 className="font-inter font-[800] text-4xl sm:text-5xl lg:text-6xl text-white leading-[1.05] mb-4" style={{ letterSpacing: '-2px' }}>
            Three steps to your race partner.
          </h1>
          <p className="font-inter text-base md:text-lg mb-16" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Every profile is verified. Every connection is private. Here is how it works.
          </p>

          <div className="space-y-8 mb-16">
            {steps.map((s, i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: '#4A3D8F' }}>
                    <span className="text-white">{s.icon}</span>
                  </div>
                  {i < steps.length - 1 && <div className="w-px h-12 mt-2" style={{ background: 'rgba(74,61,143,0.40)' }} />}
                </div>
                <div className="pt-2">
                  <h3 className="font-inter font-semibold text-lg text-white mb-1">{s.title}</h3>
                  <p className="font-inter text-sm" style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[20px] p-6 mb-16 border-l-4" style={{ background: 'rgba(42,26,69,0.60)', borderLeftColor: '#D4880A' }}>
            <div className="flex items-start gap-3">
              <Shield size={20} style={{ color: '#D4880A', flexShrink: 0, marginTop: 2 }} />
              <p className="font-inter text-sm" style={{ color: 'rgba(255,255,255,0.8)', lineHeight: 1.7 }}>
                Your phone number is stored securely and used only to open WhatsApp after both athletes accept a connection. It never appears on your profile, in search results, or anywhere visible on CREW.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mb-16">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-pill" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
              <span className="font-inter font-medium text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>2 Sports covered</span>
            </div>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-pill" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
              <span className="font-inter font-medium text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>HYROX and Marathon</span>
            </div>
          </div>

          <h2 className="font-inter font-bold text-2xl sm:text-3xl text-white tracking-tight mb-8">Frequently asked questions</h2>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-b" style={{ borderColor: 'rgba(74,61,143,0.25)' }}>
                <AccordionTrigger className="font-inter font-medium text-sm text-white py-4 hover:no-underline" data-testid={`faq-trigger-${i}`}>
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="font-inter text-sm pb-4" style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-12">
            <Link to="/get-started" className="inline-flex items-center gap-2 px-7 py-3 rounded-pill font-inter font-bold text-sm transition-all hover:scale-[1.02]"
              style={{ background: '#D4880A', color: '#fff' }} data-testid="hiw-get-started-cta">
              Get Started <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
