import { Link } from 'react-router-dom';
import { ArrowRight, Cpu, Workflow, Calendar } from 'lucide-react';

export default function About() {
  return (
    <div data-testid="about-page">
      <section className="py-14 md:py-24 px-6 md:px-12" style={{ background: '#1C0A30' }}>
        <div className="max-w-4xl mx-auto">
          <span className="block font-inter font-semibold text-xs tracking-[0.2em] uppercase mb-4" style={{ color: '#D4880A' }}>WHY CREW EXISTS</span>
          <h1 className="font-inter font-[800] text-4xl sm:text-5xl lg:text-6xl text-white leading-[1.05] mb-8" style={{ letterSpacing: '-2px' }}>
            We solve the hardest part of training. Finding the right person.
          </h1>
          <p className="font-inter text-base mb-16" style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.8 }}>
            GrapeLabs AI built CREW to fix a problem every endurance athlete knows: finding someone who trains at your level, targets the same race, and is actually available when you are. Generic WhatsApp groups and gym notice boards do not work. CREW matches you by sport, location, pace, goal, and the race you are targeting. No noise. No strangers. Just athletes who are ready to train.
          </p>

          <h2 className="font-inter font-bold text-2xl sm:text-3xl text-white tracking-tight mb-6">Built by GrapeLabs <span style={{ color: '#D4880A' }}>AI</span></h2>

          <p className="font-inter text-base mb-12" style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.8 }}>
            GrapeLabs AI automates the repetitive work that slows businesses down: orders, leads, follow-ups, payments, internal workflows. We build AI-powered systems that run in the background so teams can focus on what actually matters. CREW is what we build for fun.
          </p>

          <div className="rounded-[20px] p-8 border mb-12" style={{ background: 'rgba(42,26,69,0.60)', borderColor: 'rgba(74,61,143,0.25)' }}>
            <h3 className="font-inter font-bold text-xl text-white mb-8">Built using AI-powered systems</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: '#4A3D8F' }}>
                  <Cpu size={18} className="text-white" />
                </div>
                <h4 className="font-inter font-semibold text-sm text-white mb-2">AI-powered matching</h4>
                <p className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                  The matching engine scores athletes by proximity, level, sport, category, training intent, and race goals. No manual shortlisting.
                </p>
              </div>
              <div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: '#4A3D8F' }}>
                  <Workflow size={18} className="text-white" />
                </div>
                <h4 className="font-inter font-semibold text-sm text-white mb-2">Fully automated workflows</h4>
                <p className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                  Every notification, connection update, match confirmation, and event sync runs on automated pipelines. No manual intervention needed.
                </p>
              </div>
              <div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: '#4A3D8F' }}>
                  <Calendar size={18} className="text-white" />
                </div>
                <h4 className="font-inter font-semibold text-sm text-white mb-2">Live event intelligence</h4>
                <p className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                  Upcoming races are automatically sourced and synced so athletes always see accurate, current events.
                </p>
              </div>
            </div>
          </div>

          <p className="font-inter text-base mb-8" style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.8 }}>
            This is the same type of work we do for businesses every day. Just applied to a problem we love.
          </p>

          <div className="flex flex-col gap-3">
            <a href="https://www.grapelabs.in" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-pill font-inter font-bold text-sm transition-all hover:scale-[1.02] self-start"
              style={{ background: '#D4880A', color: '#fff' }} data-testid="about-cta">
              See What We Automate <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
