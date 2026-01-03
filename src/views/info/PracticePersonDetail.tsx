
import React from 'react';
import { Link } from 'react-router-dom';
import { Users, ArrowLeft, MessageSquare, Briefcase, GraduationCap, Scale } from 'lucide-react';

const PracticePersonDetail: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link to="/" className="inline-flex items-center text-sm font-black text-gray-400 uppercase tracking-widest mb-8 hover:text-pink-600 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
      </Link>

      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden mb-12">
        <div className="bg-pink-600 p-12 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Users className="w-64 h-64 -mr-20 -mt-20" />
          </div>
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mb-6">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-5xl font-black mb-4 tracking-tight">Practice Persons</h1>
            <p className="text-xl text-pink-100 max-w-2xl font-medium">
              Realistic roleplay for high-stakes moments. Synthesize personas from professional data to practice sales pitches, interviews, or difficult conversations.
            </p>
          </div>
        </div>

        <div className="p-12 space-y-12">
          <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-black text-gray-900 mb-6 uppercase tracking-tight">High-Fidelity Roleplay</h3>
              <p className="text-gray-600 leading-relaxed mb-6 font-medium">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </p>
              <p className="text-gray-600 leading-relaxed font-medium">
                Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
              </p>
            </div>
            <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
              <h4 className="text-sm font-black text-pink-600 uppercase tracking-widest mb-6">Training Modes</h4>
              <ul className="space-y-4">
                {[
                  { icon: MessageSquare, text: "Sales Pitch Rehearsal" },
                  { icon: Briefcase, text: "Executive Interview Sim" },
                  { icon: GraduationCap, text: "Skill Development Labs" },
                  { icon: Scale, text: "Negotiation Practice" }
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                      <item.icon className="w-4 h-4 text-pink-600" />
                    </div>
                    <span className="font-bold text-gray-700">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <h3 className="text-2xl font-black text-gray-900 mb-6 uppercase tracking-tight">Professional Dossier Logic</h3>
            <div className="bg-gray-900 rounded-[2rem] p-8 text-gray-300 font-mono text-sm leading-relaxed overflow-x-auto">
              <span className="text-pink-400"># Professional Identity Mapping</span><br />
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="mt-2">
                  <span className="text-gray-600">[{i+1}]</span> Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                </div>
              ))}
            </div>
          </section>

          <div className="pt-8 flex justify-center">
            <Link 
              to="/build?type=practice_person" 
              className="px-12 py-5 bg-pink-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-pink-100 hover:bg-pink-700 transition-all flex items-center gap-3"
            >
              Develop Practice Persona <Users className="w-6 h-6" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticePersonDetail;
