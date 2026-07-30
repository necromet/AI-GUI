import React from 'react';
import type { SectionType } from './types';

interface MockContentProps {
  type: SectionType;
  prompt: string;
  cols: number;
}

export const MockContent: React.FC<MockContentProps> = ({ type, prompt, cols }) => {
  return (
    <div className="opacity-0 animate-[fadeIn_0.4s_ease_forwards] flex-1 flex flex-col">
      {type === 'navbar' && <MockNavbar cols={cols} />}
      {type === 'hero' && <MockHero cols={cols} />}
      {type === 'features' && <MockFeatures cols={cols} />}
      {type === 'testimonials' && <MockTestimonials cols={cols} />}
      {type === 'pricing' && <MockPricing cols={cols} />}
      {type === 'cta' && <MockCTA />}
      {type === 'footer' && <MockFooter />}
      {type === 'form' && <MockForm />}
      {type === 'text' && <MockText />}
      {type === 'image' && <MockImage prompt={prompt} />}
      {type === 'generic' && <MockGeneric prompt={prompt} />}
    </div>
  );
};

const MockNavbar: React.FC<{ cols: number }> = ({ cols }) => (
  <div className="flex items-center justify-between px-3 py-1.5 rounded-md h-full" style={{ background: 'var(--bg-200)' }}>
    <div className="flex items-center gap-1">
      <div className="w-3.5 h-3.5 rounded-sm" style={{ background: 'var(--neon-color)' }} />
      <span className="text-[11px] font-bold" style={{ color: 'var(--text-100)' }}>FlowBoard</span>
    </div>
    {cols > 4 && (
      <div className="flex gap-3 text-[9px]" style={{ color: 'var(--text-300)' }}>
        <span>Features</span><span>Pricing</span><span>Docs</span>
      </div>
    )}
    <div className="text-[9px] px-2.5 py-1 rounded font-semibold" style={{ background: 'var(--neon-color)', color: '#000' }}>Get Started</div>
  </div>
);

const MockHero: React.FC<{ cols: number }> = ({ cols }) => (
  <div className="flex items-center gap-3 h-full p-2">
    <div className="flex-1 flex flex-col justify-center gap-1.5">
      <div className="text-sm font-bold leading-tight" style={{ color: 'var(--text-100)' }}>
        Ship projects faster with FlowBoard
      </div>
      <div className="text-[10px] leading-relaxed" style={{ color: 'var(--text-300)' }}>
        The modern PM tool for teams that hate busywork.
      </div>
      <div className="flex gap-1.5 mt-1">
        <div className="text-[9px] px-2.5 py-1 rounded font-semibold" style={{ background: 'var(--neon-color)', color: '#000' }}>Start Free Trial</div>
        <div className="text-[9px] px-2.5 py-1 rounded border" style={{ borderColor: 'var(--border-300)', color: 'var(--text-300)' }}>Watch Demo</div>
      </div>
    </div>
    <div className="flex-1 rounded-md h-full min-h-[50px] border flex flex-col overflow-hidden" style={{ background: 'var(--bg-200)', borderColor: 'var(--border-200)' }}>
      <div className="flex gap-1 p-1.5" style={{ background: 'var(--bg-300)', borderBottom: '1px solid var(--border-200)' }}>
        <div className="w-1 h-1 rounded-full" style={{ background: 'var(--border-300)' }} />
        <div className="w-1 h-1 rounded-full" style={{ background: 'var(--border-300)' }} />
        <div className="w-1 h-1 rounded-full" style={{ background: 'var(--border-300)' }} />
      </div>
      <div className="flex-1 p-1.5 grid grid-cols-2 gap-1">
        <div className="rounded-sm" style={{ background: 'var(--bg-300)' }} />
        <div className="rounded-sm" style={{ background: 'var(--bg-300)' }} />
        <div className="rounded-sm" style={{ background: 'var(--bg-300)' }} />
        <div className="rounded-sm" style={{ background: 'var(--bg-300)' }} />
      </div>
    </div>
  </div>
);

const MockFeatures: React.FC<{ cols: number }> = ({ cols }) => {
  const count = Math.max(1, Math.min(Math.floor(cols / 2), 4));
  const items = [
    { icon: '📋', title: 'Kanban Boards', desc: 'Drag and drop tasks across columns.' },
    { icon: '📊', title: 'Timeline Views', desc: 'Plan sprints with Gantt charts.' },
    { icon: '📈', title: 'Smart Reports', desc: 'Auto dashboards track velocity.' },
    { icon: '🎯', title: 'Goal Tracking', desc: 'Set and track team OKRs.' },
  ];
  return (
    <div className="flex flex-col gap-1.5 h-full p-1">
      <div className="text-center text-[11px] font-semibold mt-0.5" style={{ color: 'var(--text-100)' }}>Why teams choose FlowBoard</div>
      <div className="grid gap-1.5 flex-1" style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
        {items.slice(0, count).map((item, i) => (
          <div key={i} className="rounded-md p-2 border text-center flex flex-col items-center justify-center gap-1" style={{ background: 'var(--bg-200)', borderColor: 'var(--border-200)' }}>
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs" style={{ background: 'rgba(var(--neon-rgb), 0.1)' }}>{item.icon}</div>
            <div className="text-[9px] font-semibold" style={{ color: 'var(--text-100)' }}>{item.title}</div>
            <div className="text-[7px] leading-tight" style={{ color: 'var(--text-400)' }}>{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MockTestimonials: React.FC<{ cols: number }> = ({ cols }) => {
  const count = Math.max(1, Math.min(Math.floor(cols / 4), 3));
  const items = [
    { quote: '"FlowBoard transformed how our team ships."', name: 'Sarah Chen', role: 'CTO at Meridian' },
    { quote: '"The best PM tool we\'ve used."', name: 'Mike Torres', role: 'VP Eng at Ripple' },
    { quote: '"Simple, powerful, and beautiful."', name: 'Lisa Park', role: 'PM at Nova' },
  ];
  return (
    <div className="flex flex-col gap-1.5 h-full p-1">
      <div className="text-center text-[11px] font-semibold mt-0.5" style={{ color: 'var(--text-100)' }}>Trusted by teams</div>
      <div className="grid gap-1.5 flex-1" style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
        {items.slice(0, count).map((item, i) => (
          <div key={i} className="rounded-md p-2.5 border flex flex-col justify-center gap-1.5" style={{ background: 'var(--bg-200)', borderColor: 'var(--border-200)' }}>
            <div className="text-[8px] italic leading-relaxed" style={{ color: 'var(--text-300)' }}>{item.quote}</div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full" style={{ background: 'var(--bg-300)' }} />
              <div>
                <div className="text-[8px] font-semibold" style={{ color: 'var(--text-100)' }}>{item.name}</div>
                <div className="text-[7px]" style={{ color: 'var(--text-400)' }}>{item.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MockPricing: React.FC<{ cols: number }> = ({ cols }) => {
  const count = Math.max(1, Math.min(Math.floor(cols / 3), 3));
  const plans = [
    { name: 'Free', price: '$0', popular: false },
    { name: 'Pro', price: '$12', popular: true },
    { name: 'Team', price: '$29', popular: false },
  ];
  return (
    <div className="flex flex-col gap-1.5 h-full p-1">
      <div className="text-center text-[11px] font-semibold mt-0.5" style={{ color: 'var(--text-100)' }}>Simple pricing</div>
      <div className="grid gap-1.5 flex-1" style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
        {plans.slice(0, count).map((plan, i) => (
          <div key={i} className={`rounded-md p-2 border text-center flex flex-col items-center justify-center gap-0.5 ${plan.popular ? 'border-[var(--neon-color)]' : ''}`} style={{ background: 'var(--bg-200)', borderColor: plan.popular ? 'var(--neon-color)' : 'var(--border-200)' }}>
            {plan.popular && <div className="text-[7px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--neon-color)', color: '#000' }}>Popular</div>}
            <div className="text-[9px] font-semibold" style={{ color: 'var(--text-100)' }}>{plan.name}</div>
            <div className="text-sm font-bold" style={{ color: 'var(--text-100)' }}>{plan.price}<span className="text-[7px]" style={{ color: 'var(--text-400)' }}>/mo</span></div>
            <div className="text-[7px] leading-relaxed" style={{ color: 'var(--text-300)' }}>Core features<br />Team collab<br />Analytics</div>
            <div className="text-[8px] px-2 py-0.5 rounded font-semibold mt-1 w-full text-center" style={{ background: 'var(--neon-color)', color: '#000' }}>Choose</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MockCTA: React.FC = () => (
  <div className="flex flex-col items-center justify-center text-center h-full p-2.5 gap-1.5">
    <div className="text-sm font-bold" style={{ color: 'var(--text-100)' }}>Ready to ship faster?</div>
    <div className="text-[10px]" style={{ color: 'var(--text-300)' }}>Join 10,000+ teams. Start free.</div>
    <div className="text-[9px] px-3 py-1 rounded font-semibold" style={{ background: 'var(--neon-color)', color: '#000' }}>Get Started — Free</div>
  </div>
);

const MockFooter: React.FC = () => (
  <div className="grid grid-cols-[1.5fr_repeat(auto-fit,1fr)] gap-2.5 h-full p-2.5 content-center">
    <div>
      <div className="text-[10px] font-bold mb-0.5" style={{ color: 'var(--text-100)' }}>◼ FlowBoard</div>
      <div className="text-[7px] leading-relaxed" style={{ color: 'var(--text-400)' }}>Modern PM tool for teams.</div>
    </div>
    <div>
      <div className="text-[7px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-300)' }}>Product</div>
      <div className="text-[7px] mb-0.5" style={{ color: 'var(--text-400)' }}>Features</div>
      <div className="text-[7px] mb-0.5" style={{ color: 'var(--text-400)' }}>Pricing</div>
    </div>
    <div>
      <div className="text-[7px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-300)' }}>Company</div>
      <div className="text-[7px] mb-0.5" style={{ color: 'var(--text-400)' }}>About</div>
      <div className="text-[7px] mb-0.5" style={{ color: 'var(--text-400)' }}>Blog</div>
    </div>
    <div>
      <div className="text-[7px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-300)' }}>Legal</div>
      <div className="text-[7px] mb-0.5" style={{ color: 'var(--text-400)' }}>Privacy</div>
      <div className="text-[7px] mb-0.5" style={{ color: 'var(--text-400)' }}>Terms</div>
    </div>
  </div>
);

const MockForm: React.FC = () => (
  <div className="flex flex-col gap-1.5 h-full p-2 justify-center">
    <div className="text-[12px] font-semibold text-center" style={{ color: 'var(--text-100)' }}>Get in touch</div>
    <div className="h-6 rounded-md border" style={{ background: 'var(--bg-200)', borderColor: 'var(--border-200)' }} />
    <div className="h-6 rounded-md border" style={{ background: 'var(--bg-200)', borderColor: 'var(--border-200)' }} />
    <div className="flex-1 rounded-md border" style={{ background: 'var(--bg-200)', borderColor: 'var(--border-200)' }} />
    <div className="h-7 rounded-md" style={{ background: 'var(--neon-color)' }} />
  </div>
);

const MockText: React.FC = () => (
  <div className="p-2 h-full flex flex-col justify-center gap-1">
    <div className="text-[12px] font-semibold" style={{ color: 'var(--text-100)' }}>Section heading</div>
    <div className="h-[3px] rounded-full w-full" style={{ background: 'var(--bg-200)' }} />
    <div className="h-[3px] rounded-full" style={{ background: 'var(--bg-200)', width: '95%' }} />
    <div className="h-[3px] rounded-full" style={{ background: 'var(--bg-200)', width: '88%' }} />
    <div className="h-[3px] rounded-full" style={{ background: 'var(--bg-200)', width: '70%' }} />
  </div>
);

const MockImage: React.FC<{ prompt: string }> = ({ prompt }) => (
  <div className="h-full flex items-center justify-center rounded-md border border-dashed" style={{ background: 'var(--bg-200)', borderColor: 'var(--border-300)' }}>
    <div className="text-center" style={{ color: 'var(--text-400)' }}>
      <div className="text-lg mb-1">🖼</div>
      <div className="text-[10px]">{prompt || 'Image placeholder'}</div>
    </div>
  </div>
);

const MockGeneric: React.FC<{ prompt: string }> = ({ prompt }) => (
  <div className="flex flex-col gap-1.5 h-full p-2.5 justify-center">
    <div className="rounded-md border flex-1 flex items-center justify-center text-[10px]" style={{ background: 'var(--bg-200)', borderColor: 'var(--border-200)', color: 'var(--text-400)' }}>
      {prompt || 'Generic section'}
    </div>
  </div>
);
