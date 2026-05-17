import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  PlayCircle,
  Target,
  Sparkles,
  Clock,
  Users,
  ChevronRight,
  Plus
} from 'lucide-react';
import { Persona, ChatSession, SimulationSession } from '../types';
import { storageService } from '../services/storage';

const HomePage: React.FC = () => {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [simulations, setSimulations] = useState<SimulationSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [p, c, s] = await Promise.all([
          storageService.getPersonas(),
          storageService.getSessions(),
          storageService.getSimulationSessions(),
        ]);
        setPersonas(p);
        setChatSessions(c);
        setSimulations(s);
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const recentPersonas = [...personas].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 4);

  const recentChats = [...chatSessions].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 3);

  const recentSimulations = [...simulations].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 3);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="animate-pulse space-y-8">
          <div className="h-8 w-48 bg-gray-200 rounded-lg"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-100 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome + Quick Actions */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
        <p className="text-gray-500">Here's what's happening with your personas.</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <SummaryCard
          label="Personas"
          value={personas.length}
          icon={Users}
          link="/gallery"
        />
        <SummaryCard
          label="Chat Sessions"
          value={chatSessions.length}
          icon={MessageSquare}
          link="/chat"
        />
        <SummaryCard
          label="Simulations"
          value={simulations.length}
          icon={PlayCircle}
          link="/simulate"
        />
      </div>

      {/* Recent Personas */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Personas</h2>
          <Link to="/gallery" className="text-sm text-indigo-600 font-medium hover:underline flex items-center gap-1">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {recentPersonas.length === 0 ? (
          <EmptyState
            message="No personas yet. Create your first one to get started."
            actionLabel="Build Persona"
            actionLink="/build"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentPersonas.map(persona => (
              <PersonaCard key={persona.id} persona={persona} />
            ))}
          </div>
        )}
      </section>

      {/* Recent Activity: Chats + Simulations side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {/* Recent Chats */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Chats</h2>
            <Link to="/chat" className="text-sm text-indigo-600 font-medium hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {recentChats.length === 0 ? (
            <EmptyState
              message="No chat sessions yet."
              actionLabel="Start Chat"
              actionLink="/chat"
            />
          ) : (
            <div className="space-y-3">
              {recentChats.map(session => (
                <ActivityRow
                  key={session.id}
                  title={session.name}
                  subtitle={`${session.personaIds.length} persona${session.personaIds.length !== 1 ? 's' : ''}`}
                  date={session.createdAt}
                  link={`/chat/${session.id}`}
                  icon={MessageSquare}
                />
              ))}
            </div>
          )}
        </section>

        {/* Recent Simulations */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Simulations</h2>
            <Link to="/simulate" className="text-sm text-indigo-600 font-medium hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {recentSimulations.length === 0 ? (
            <EmptyState
              message="No simulations yet."
              actionLabel="Run Simulation"
              actionLink="/simulate"
            />
          ) : (
            <div className="space-y-3">
              {recentSimulations.map(sim => (
                <ActivityRow
                  key={sim.id}
                  title={sim.name}
                  subtitle={sim.mode.replace(/_/g, ' ')}
                  date={sim.createdAt}
                  link="/simulate"
                  icon={PlayCircle}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Feature Explainers */}
      <section>
        <div className="flex items-center gap-4 mb-6">
          <div className="h-px bg-gray-200 flex-grow"></div>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Persona Types</h2>
          <div className="h-px bg-gray-200 flex-grow"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FeatureCard
            title="Synthetic User"
            description="Built on 'Jobs-to-be-Done' and psychographic tension points. Experience the 'why' behind the click."
            icon={Target}
            link="/info/synthetic-user"
            color="indigo"
          />
          <FeatureCard
            title="Advisor"
            description="Create advisors from LinkedIn profile text or PDF upload. Transmute books and data into an entity that understands the intent of the source."
            icon={Sparkles}
            link="/info/advisor"
            color="violet"
          />
        </div>
      </section>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const SummaryCard: React.FC<{ label: string; value: number; icon: any; link: string }> = ({ label, value, icon: Icon, link }) => (
  <Link to={link} className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md transition-all hover:-translate-y-0.5">
    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
      <Icon className="w-5 h-5 text-indigo-600" />
    </div>
    <div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  </Link>
);

const PersonaCard: React.FC<{ persona: Persona }> = ({ persona }) => (
  <Link
    to="/gallery"
    className="bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-all hover:-translate-y-0.5 flex flex-col"
  >
    <div className="flex items-center gap-3 mb-3">
      <img
        src={persona.avatarUrl}
        alt={persona.name}
        className="w-10 h-10 rounded-full object-cover"
      />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-900 truncate">{persona.name}</div>
        <div className="text-xs text-gray-400 capitalize">{persona.type.replace('_', ' ')}</div>
      </div>
    </div>
    <p className="text-xs text-gray-500 line-clamp-2">{persona.description}</p>
  </Link>
);

const ActivityRow: React.FC<{ title: string; subtitle: string; date: string; link: string; icon: any }> = ({ title, subtitle, date, link, icon: Icon }) => (
  <Link to={link} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-4 hover:shadow-sm transition-all">
    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
      <Icon className="w-4 h-4 text-gray-500" />
    </div>
    <div className="min-w-0 flex-grow">
      <div className="text-sm font-medium text-gray-900 truncate">{title}</div>
      <div className="text-xs text-gray-400 capitalize">{subtitle}</div>
    </div>
    <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
      <Clock className="w-3 h-3" />
      {formatRelativeDate(date)}
    </div>
  </Link>
);

const EmptyState: React.FC<{ message: string; actionLabel: string; actionLink: string }> = ({ message, actionLabel, actionLink }) => (
  <div className="border border-dashed border-gray-200 rounded-2xl p-8 text-center">
    <p className="text-sm text-gray-400 mb-4">{message}</p>
    <Link
      to={actionLink}
      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
    >
      <Plus className="w-4 h-4" />
      {actionLabel}
    </Link>
  </div>
);

const FeatureCard: React.FC<{ title: string; description: string; icon: any; link: string; color: string }> = ({ title, description, icon: Icon, link, color }) => {
  const colorClasses: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white',
    violet: 'bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white',
  };

  return (
    <Link to={link} className="group flex items-start gap-5 bg-white border border-gray-100 p-6 rounded-2xl transition-all hover:shadow-lg hover:-translate-y-1">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${colorClasses[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h3 className="text-base font-bold text-gray-900 mb-1">{title}</h3>
        <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
      </div>
    </Link>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default HomePage;
