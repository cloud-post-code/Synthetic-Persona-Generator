
import React from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus,
  MessageSquare,
  Play,
  LayoutGrid,
  Building2,
  Settings2,
  TrendingUp,
  Heart,
  ShieldCheck,
  ArrowRight,
  LucideIcon,
} from 'lucide-react';

const HomePage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Welcome header */}
      <header className="mb-10">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight sm:text-4xl">
          Welcome back
        </h1>
        <p className="mt-2 text-gray-500 font-medium max-w-xl">
          Jump to where you need to go — build personas, run simulations, or convene a panel.
        </p>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        <StatStrip
          icon={Heart}
          value="94%"
          label="Emotional Correlation"
          color="pink"
        />
        <StatStrip
          icon={TrendingUp}
          value="3.2x"
          label="Behavioral Fidelity"
          color="indigo"
        />
        <StatStrip
          icon={ShieldCheck}
          value="88%"
          label="Simulation Reliability"
          color="violet"
        />
      </div>

      {/* Navigation hub */}
      <section>
        <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.25em] mb-6">
          Where do you want to go?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <NavCard
            to="/build"
            title="Build Persona"
            description="Create a new synthetic user or advisor with need-based logic."
            icon={UserPlus}
            primary
          />
          <NavCard
            to="/chat"
            title="Panel Session"
            description="Chat with up to five personas in a single conversation."
            icon={MessageSquare}
            accent="violet"
          />
          <NavCard
            to="/simulations"
            title="Simulations"
            description="Run and review scenario-based behavioral simulations."
            icon={Play}
            accent="pink"
          />
          <NavCard
            to="/gallery"
            title="Gallery"
            description="Browse personas, sessions, and your saved library."
            icon={LayoutGrid}
            accent="amber"
          />
          <NavCard
            to="/business-profile"
            title="Business Profile"
            description="Define your company context for sharper persona outputs."
            icon={Building2}
            accent="emerald"
          />
          <NavCard
            to="/settings"
            title="Settings"
            description="Account preferences, API usage, and configuration."
            icon={Settings2}
            accent="gray"
          />
        </div>
      </section>
    </div>
  );
};

type AccentColor = 'indigo' | 'violet' | 'pink' | 'amber' | 'emerald' | 'gray';

const StatStrip: React.FC<{
  icon: LucideIcon;
  value: string;
  label: string;
  color: 'indigo' | 'violet' | 'pink';
}> = ({ icon: Icon, value, label, color }) => {
  const colorMap: Record<string, string> = {
    indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    violet: 'text-violet-600 bg-violet-50 border-violet-100',
    pink: 'text-pink-600 bg-pink-50 border-pink-100',
  };

  return (
    <div className="bg-white px-6 py-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center border ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-black text-gray-900 leading-none">{value}</div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">{label}</p>
      </div>
    </div>
  );
};

const NavCard: React.FC<{
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  primary?: boolean;
  accent?: AccentColor;
}> = ({ to, title, description, icon: Icon, primary, accent = 'indigo' }) => {
  const accentStyles: Record<AccentColor, { icon: string; hover: string }> = {
    indigo: {
      icon: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white',
      hover: 'group-hover:border-indigo-200',
    },
    violet: {
      icon: 'bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white',
      hover: 'group-hover:border-violet-200',
    },
    pink: {
      icon: 'bg-pink-50 text-pink-600 group-hover:bg-pink-600 group-hover:text-white',
      hover: 'group-hover:border-pink-200',
    },
    amber: {
      icon: 'bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white',
      hover: 'group-hover:border-amber-200',
    },
    emerald: {
      icon: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
      hover: 'group-hover:border-emerald-200',
    },
    gray: {
      icon: 'bg-gray-100 text-gray-600 group-hover:bg-gray-700 group-hover:text-white',
      hover: 'group-hover:border-gray-300',
    },
  };

  if (primary) {
    return (
      <Link
        to={to}
        className="group relative flex flex-col p-8 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-200/50 hover:shadow-xl hover:shadow-indigo-300/40 hover:-translate-y-1 transition-all min-h-[180px]"
      >
        <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center mb-6 group-hover:bg-white/25 transition-colors">
          <Icon className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-black tracking-tight mb-2">{title}</h3>
        <p className="text-indigo-100 text-sm font-medium leading-relaxed flex-grow">{description}</p>
        <div className="mt-6 flex items-center text-xs font-black uppercase tracking-widest text-white/90 group-hover:text-white">
          Get started <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </Link>
    );
  }

  const styles = accentStyles[accent];

  return (
    <Link
      to={to}
      className={`group flex flex-col p-8 rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all min-h-[180px] ${styles.hover}`}
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-all shadow-sm ${styles.icon}`}>
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-black text-gray-900 tracking-tight mb-2">{title}</h3>
      <p className="text-gray-500 text-sm font-medium leading-relaxed flex-grow">{description}</p>
      <div className="mt-6 flex items-center text-xs font-black uppercase tracking-widest text-gray-400 group-hover:text-gray-900 transition-colors">
        Open <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
};

export default HomePage;
