
import React, { useState, useEffect, useRef } from 'react';
import { 
  Monitor, 
  Megaphone, 
  TrendingUp, 
  Briefcase, 
  ChevronRight, 
  Upload, 
  User, 
  ArrowLeft, 
  Loader2, 
  Sparkles,
  Send,
  AlertCircle,
  History,
  Trash2,
  Plus,
  X as CloseIcon
} from 'lucide-react';
import { Persona, SimulationMode, Message, SimulationSession } from '../models/types.js';
import { usePersonas } from '../hooks/usePersonas.js';
import { simulationApi } from '../services/simulationApi.js';
import { personaApi } from '../services/personaApi.js';
import { geminiService } from '../services/gemini.js';

const MODES: { id: SimulationMode; label: string; icon: any; color: string; promptTemplate: string }[] = [
  {
    id: 'web_page',
    label: 'Web Page Response',
    icon: Monitor,
    color: 'indigo',
    promptTemplate: `### CORE DIRECTIVE
You must completely embody the persona defined in {{SELECTED_PROFILE}}. Do not break character. Do not act as an AI assistant.

### INPUTS
1. **Who You Are (Profile):** {{SELECTED_PROFILE_FULL}}
2. **Context:** {{BACKGROUND_INFO}}
3. **Visual Stimulus:** [User has uploaded an image of a webpage].

### INSTRUCTIONS
1. Analyze the uploaded image through the eyes of your Profile.
2. Considering your Profile's specific pain points, age, tech-savviness, and goals:
   - Does this page make sense to you?
   - Is the text readable for you?
   - Does the design appeal to your specific taste?
3. Simulate your internal monologue or a user-testing feedback session.

### INTERACTION
Begin by stating your first impression of the page shown in the image, speaking strictly in the voice and tone of {{SELECTED_PROFILE}}.`
  },
  {
    id: 'marketing',
    label: 'Marketing Material',
    icon: Megaphone,
    color: 'pink',
    promptTemplate: `### CORE DIRECTIVE
You are NOT a marketing expert. You are the target audience member described in {{SELECTED_PROFILE}}. React instinctively.

### INPUTS
1. **Who You Are (Profile):** {{SELECTED_PROFILE_FULL}}
2. **Product Context:** {{BACKGROUND_INFO}}
3. **Marketing Asset:** [User has uploaded an image/file].

### INSTRUCTIONS
1. Look at the uploaded marketing material.
2. Based *strictly* on your Profile's interests, budget, and personality:
   - Would you stop scrolling to look at this?
   - Do you understand what is being sold?
   - Does the visual style trust or annoy you?
3. If the ad doesn't fit your specific worldview, reject it. If it does, show interest.

### INTERACTION
Provide a raw, unfiltered reaction to the image as if you just saw it on your feed/email, using the slang and vocabulary of {{SELECTED_PROFILE}}.`
  },
  {
    id: 'sales_pitch',
    label: 'Sales Pitch',
    icon: TrendingUp,
    color: 'green',
    promptTemplate: `### CORE DIRECTIVE
Immerse yourself in the persona of {{SELECTED_PROFILE}}. The user is trying to sell to you. Respond exactly how this person would in real life.

### INPUTS
1. **Who You Are (Profile):** {{SELECTED_PROFILE_FULL}}
2. **Context:** {{BACKGROUND_INFO}}
3. **User's Opening Line:** {{OPENING_LINE}}

### INSTRUCTIONS
1. Analyze the User's opening line.
2. Consult your Profile: Are you busy? Are you skeptical? Do you have budget authority? What are your specific triggers?
3. Respond to the opening line.
   - If the line is weak or irrelevant to your Profile, shut them down or be dismissive.
   - If the line hooks your specific interests, engage cautiously.

### INTERACTION
Reply to the {{OPENING_LINE}} immediately in character. Do not provide feedback; simply *be* the prospect.`
  },
  {
    id: 'investor_pitch',
    label: 'Investor Pitch',
    icon: Briefcase,
    color: 'violet',
    promptTemplate: `### CORE DIRECTIVE
You are the Investor defined in {{SELECTED_PROFILE}}. You evaluate opportunities strictly based on your specific investment thesis and personality traits.

### INPUTS
1. **Who You Are (Profile):** {{SELECTED_PROFILE_FULL}}
2. **Startup Info:** {{BACKGROUND_INFO}}
3. **Pitch Deck/Data:** {{OPENING_LINE}}

### INSTRUCTIONS
1. Review the startup materials provided.
2. Compare the startup against your Profile's specific criteria.
3. Identify the gap between what was pitched and what *you* care about.

### INTERACTION
Start the simulation. You have just reviewed the deck. Address the founder (User) and state your primary concern or question based on your Profile.`
  }
];

const FormattedSimulationResponse: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="prose prose-indigo max-w-none space-y-4 text-gray-800 leading-relaxed font-medium">
      {content.split('\n').map((line, i) => (
        <p key={i} className="whitespace-pre-wrap">{line}</p>
      ))}
    </div>
  );
};

const SimulationPage: React.FC = () => {
  const [stage, setStage] = useState<'selection' | 'inputs' | 'result'>('selection');
  const [mode, setMode] = useState<SimulationMode | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [bgInfo, setBgInfo] = useState('');
  const [openingLine, setOpeningLine] = useState('');
  const [stimulusImage, setStimulusImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const [simulationHistory, setSimulationHistory] = useState<SimulationSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { personas: allPersonas } = usePersonas();

  useEffect(() => {
    setPersonas(allPersonas);
    loadHistory();
  }, [allPersonas]);

  const loadHistory = async () => {
    try {
      const history = await simulationApi.getAll();
      // Normalize dates
      const normalized = history.map(s => ({
        ...s,
        createdAt: s.created_at || s.createdAt,
        personaId: s.persona_id || s.personaId,
        bgInfo: s.bg_info || s.bgInfo,
        openingLine: s.opening_line || s.openingLine,
        stimulusImage: s.stimulus_image || s.stimulusImage,
        mimeType: s.mime_type || s.mimeType,
      }));
      setSimulationHistory(normalized.sort((a, b) => {
        const dateA = a.createdAt || '';
        const dateB = b.createdAt || '';
        return dateB.localeCompare(dateA);
      }));
    } catch (err) {
      console.error('Failed to load simulation history:', err);
    }
  };

  useEffect(() => {
    if (stage === 'result') {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, stage]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [chatInput]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMimeType(file.type);
      const reader = new FileReader();
      reader.onload = (ev) => setStimulusImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const startSimulation = async () => {
    // Validate all required fields before starting
    if (!selectedPersona) {
      alert('Please select a persona');
      return;
    }
    
    if (!selectedPersona.id) {
      alert('Selected persona is missing an ID. Please select a valid persona.');
      return;
    }
    
    if (!selectedPersona.name || !selectedPersona.name.trim()) {
      alert('Selected persona is missing a name. Please select a valid persona.');
      return;
    }
    
    if (!mode) {
      alert('Please select a simulation mode');
      return;
    }
    
    // Ensure bgInfo is at least an empty string (required by backend)
    if (bgInfo === undefined || bgInfo === null) {
      setBgInfo('');
    }
    
    setIsLoading(true);

    const modeData = MODES.find(m => m.id === mode);
    if (!modeData) {
      setIsLoading(false);
      return;
    }

    // Build profile context
    let profileData = `NAME: ${selectedPersona.name}\nDESCRIPTION: ${selectedPersona.description}\n\nCORE BLUEPRINT FILES:\n`;
    // Load persona files if not already loaded
    const files = selectedPersona.files || [];
    if (files.length === 0) {
      try {
        const personaFiles = await personaApi.getFiles(selectedPersona.id);
        files.push(...personaFiles.map(f => ({
          ...f,
          createdAt: f.created_at || f.createdAt,
        })));
      } catch (err) {
        console.error('Failed to load persona files:', err);
      }
    }
    files.forEach(f => {
      profileData += `--- FILE: ${f.name} ---\n${f.content.substring(0, 15000)}\n\n`;
    });

    const prompt = modeData.promptTemplate
      .replace(/{{SELECTED_PROFILE}}/g, selectedPersona.name)
      .replace(/{{SELECTED_PROFILE_FULL}}/g, profileData)
      .replace(/{{BACKGROUND_INFO}}/g, bgInfo)
      .replace(/{{OPENING_LINE}}/g, openingLine);

    try {
      const result = await geminiService.runSimulation(prompt, stimulusImage || undefined, mimeType || undefined);
      
      // Ensure all required fields are present
      if (!selectedPersona.id) {
        throw new Error('Persona ID is missing');
      }
      if (!mode) {
        throw new Error('Simulation mode is missing');
      }
      if (!bgInfo.trim() && (mode === 'web_page' || mode === 'marketing')) {
        // bgInfo can be empty for sales_pitch and investor_pitch, but should be provided for web_page and marketing
        console.warn('Background info is empty for', mode);
      }
      
      const newSession = await simulationApi.create({
        personaId: selectedPersona.id,
        mode: mode,
        bgInfo: bgInfo.trim() || '', // Ensure it's at least an empty string
        openingLine: openingLine || undefined,
        stimulusImage: stimulusImage || undefined,
        mimeType: mimeType || undefined,
        name: `${selectedPersona.name} - ${modeData.label}`
      });
      
      const newSessionId = newSession.id;
      
      // Note: Simulation messages are stored separately - for now we'll store them locally
      // In a full implementation, you might want to create a chat session for each simulation
      const initialMessage: Message = {
        id: crypto.randomUUID(),
        sessionId: newSessionId,
        senderType: 'persona',
        personaId: selectedPersona.id,
        content: result,
        createdAt: new Date().toISOString()
      };
      
      setCurrentSessionId(newSessionId);
      setMessages([initialMessage]);
      setStage('result');
      loadHistory();
    } catch (err: any) {
      console.error('Simulation error:', err);
      const errorMessage = err?.message || err?.toString() || 'Unknown error occurred';
      alert(`Simulation failed: ${errorMessage}\n\nPlease check:\n1. Gemini API key is set in .env file\n2. You have sufficient API quota\n3. Check browser console for details`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendFollowUp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !selectedPersona || isTyping || !currentSessionId) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      sessionId: currentSessionId,
      senderType: 'user',
      content: chatInput,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    // Note: Messages are stored locally for simulations
    // In production, you might want to create a chat session for each simulation
    setChatInput('');
    setIsTyping(true);

    try {
      const history = messages.map(m => ({
        role: m.senderType === 'user' ? 'user' as const : 'model' as const,
        text: m.content
      }));

      const systemPrompt = `You are strictly acting as the persona: ${selectedPersona.name}.\n` +
        `Context of Simulation: ${bgInfo}.\n` +
        `Respond to the user naturally in your unique voice. Staying in character is mandatory.`;
      
      const response = await geminiService.chat(systemPrompt, history, userMsg.content);
      
      const aiMsg: Message = {
        id: crypto.randomUUID(),
        sessionId: currentSessionId,
        senderType: 'persona',
        personaId: selectedPersona.id,
        content: response,
        createdAt: new Date().toISOString()
      };

      setMessages(prev => [...prev, aiMsg]);
      // Note: Messages are stored locally for simulations
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMessage = err?.message || err?.toString() || 'Unknown error occurred';
      alert(`Failed to send message: ${errorMessage}\n\nPlease check:\n1. Gemini API key is set\n2. You have sufficient API quota\n3. Check browser console for details`);
    } finally {
      setIsTyping(false);
    }
  };

  const resumeSimulation = async (session: SimulationSession) => {
    setIsLoading(true);
    setCurrentSessionId(session.id);
    setMode(session.mode);
    setBgInfo(session.bgInfo);
    setOpeningLine(session.openingLine || '');
    setStimulusImage(session.stimulusImage || null);
    setMimeType(session.mimeType || null);
    
    const persona = personas.find(p => p.id === session.personaId);
    setSelectedPersona(persona || null);

    // Note: For now, simulation messages are stored in component state
    // In production, you might want to load from a chat session linked to the simulation
    setMessages([]);
    setStage('result');
    setIsLoading(false);
  };

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Delete this simulation history?")) {
      try {
        await simulationApi.delete(id);
        loadHistory();
        if (currentSessionId === id) {
          setStage('selection');
          setCurrentSessionId(null);
        }
      } catch (err) {
        console.error('Failed to delete simulation:', err);
        alert('Failed to delete simulation. Please try again.');
      }
    }
  };

  const startNewSim = () => {
    setStage('selection');
    setCurrentSessionId(null);
    setMode(null);
    setSelectedPersona(null);
    setBgInfo('');
    setOpeningLine('');
    setStimulusImage(null);
    setMimeType(null);
    setMessages([]);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white">
      {/* Sidebar - History */}
      <aside className="hidden md:flex w-80 flex-col border-r border-gray-100 bg-gray-50/50">
        <div className="p-6 border-b border-gray-100 bg-white">
          <button
            onClick={startNewSim}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
          >
            <Sparkles className="w-4 h-4" /> New Simulation
          </button>
        </div>
        <div className="flex-grow overflow-y-auto p-4 space-y-2">
           <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 px-4">Simulation Logs</h3>
           {simulationHistory.length > 0 ? simulationHistory.map(s => (
             <div key={s.id} className="group relative">
               <button
                 onClick={() => resumeSimulation(s)}
                 className={`w-full text-left p-4 rounded-2xl text-sm font-bold transition-all flex items-center gap-4 ${currentSessionId === s.id ? 'bg-white text-indigo-600 shadow-lg border border-gray-100' : 'text-gray-500 hover:bg-white hover:text-gray-900'}`}
               >
                 <History className={`w-4 h-4 shrink-0 ${currentSessionId === s.id ? 'text-indigo-600' : 'opacity-30'}`} />
                 <span className="truncate pr-8">{s.name}</span>
               </button>
               <button 
                 onClick={(e) => deleteSession(e, s.id)}
                 className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
               >
                 <Trash2 className="w-4 h-4" />
               </button>
             </div>
           )) : (
             <div className="p-10 text-center">
               <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">No history yet</p>
             </div>
           )}
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-grow flex flex-col relative bg-white overflow-hidden">
        {stage === 'selection' && (
          <div className="max-w-6xl mx-auto px-6 py-12 w-full overflow-y-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-black uppercase tracking-widest mb-4">
                 Validation Engine
              </div>
              <h1 className="text-5xl font-black text-gray-900 mb-4 tracking-tight">Execute Simulation</h1>
              <p className="text-xl text-gray-500 font-medium max-w-2xl mx-auto">Select a specialized testing mode to see how your synthetic personas react to your work.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
              {MODES.map((m) => {
                const Icon = m.icon;
                const colors: Record<string, string> = {
                  indigo: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600',
                  pink: 'bg-pink-50 text-pink-600 group-hover:bg-pink-600',
                  green: 'bg-green-50 text-green-600 group-hover:bg-green-600',
                  violet: 'bg-violet-50 text-violet-600 group-hover:bg-violet-600',
                };
                return (
                  <button
                    key={m.id}
                    onClick={() => { setMode(m.id); setStage('inputs'); }}
                    className="group p-8 bg-white border border-gray-100 rounded-[2.5rem] text-left hover:shadow-2xl hover:-translate-y-2 transition-all border-b-8 hover:border-indigo-600 flex flex-col h-full"
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 shadow-lg transition-all group-hover:scale-110 group-hover:text-white ${colors[m.color]}`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 mb-2">{m.label}</h3>
                    <p className="text-gray-400 text-sm font-medium leading-relaxed flex-grow">Stress-test your strategy using this specialized simulation prompt.</p>
                    <div className="mt-8 flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 group-hover:text-indigo-600">
                      Configure Test <ChevronRight className="ml-2 w-3 h-3" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {stage === 'inputs' && (
          <div className="max-w-4xl mx-auto px-6 py-12 w-full overflow-y-auto">
            <button onClick={() => setStage('selection')} className="flex items-center text-sm font-black text-gray-400 uppercase tracking-widest mb-8 hover:text-indigo-600 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Modes
            </button>

            <div className="bg-white rounded-[3rem] shadow-2xl shadow-gray-200/50 border border-gray-100 p-8 sm:p-14 space-y-12">
              <div className="flex items-center gap-6 pb-8 border-b border-gray-50">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg bg-indigo-600 text-white`}>
                  {MODES.find(m => m.id === mode)?.icon && React.createElement(MODES.find(m => m.id === mode)!.icon, { className: "w-8 h-8" })}
                </div>
                <div>
                  <h2 className="text-3xl font-black text-gray-900">{MODES.find(m => m.id === mode)?.label}</h2>
                  <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Input Data & Stimulus</p>
                </div>
              </div>

              <div className="space-y-10">
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">1. Select Target Persona</label>
                  {personas.length === 0 ? (
                    <div className="p-6 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700 text-sm font-bold flex gap-3">
                       <AlertCircle className="w-5 h-5" />
                       You haven't built any personas yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {personas.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPersona(p)}
                          className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${selectedPersona?.id === p.id ? 'border-indigo-600 bg-indigo-50 shadow-lg' : 'border-gray-50 hover:border-indigo-100 bg-white'}`}
                        >
                          <img src={p.avatarUrl} alt={p.name} className="w-10 h-10 rounded-xl object-cover" />
                          <div className="min-w-0">
                            <p className="text-xs font-black text-gray-900 truncate">{p.name}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">2. Background Context</label>
                  <textarea
                    value={bgInfo}
                    onChange={e => setBgInfo(e.target.value)}
                    placeholder="Describe the product or situation context..."
                    className="w-full h-32 p-6 bg-gray-50 border border-gray-100 rounded-3xl font-medium focus:ring-4 focus:ring-indigo-100 outline-none transition-all resize-none"
                  />
                </div>

                {(mode === 'web_page' || mode === 'marketing') && (
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">3. Upload Visual Stimulus</label>
                    <div className="relative group cursor-pointer border-4 border-dashed border-gray-100 rounded-[2.5rem] p-12 text-center hover:border-indigo-300 transition-all bg-gray-50/50 overflow-hidden">
                      {stimulusImage ? (
                        <div className="relative inline-block">
                           <img src={stimulusImage} className="max-h-64 mx-auto rounded-xl shadow-2xl border border-white" />
                           <button onClick={(e) => {e.stopPropagation(); setStimulusImage(null);}} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg"><CloseIcon className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto text-gray-400 group-hover:text-indigo-600 transition-colors">
                            <Upload className="w-8 h-8" />
                          </div>
                          <p className="text-gray-500 font-bold">Upload Web Page or Ad Image</p>
                        </div>
                      )}
                      <input type="file" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                  </div>
                )}

                {(mode === 'sales_pitch' || mode === 'investor_pitch') && (
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">3. Opening Line / Content</label>
                    <textarea
                      value={openingLine}
                      onChange={e => setOpeningLine(e.target.value)}
                      placeholder="Paste your opening line or pitch deck summary..."
                      className="w-full h-32 p-6 bg-gray-50 border border-gray-100 rounded-3xl font-medium focus:ring-4 focus:ring-indigo-100 outline-none transition-all resize-none"
                    />
                  </div>
                )}

                <button
                  disabled={isLoading || !selectedPersona}
                  onClick={startSimulation}
                  className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-lg shadow-2xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-30 transition-all flex items-center justify-center gap-4 group"
                >
                  {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Start Simulation <ChevronRight className="w-6 h-6 group-hover:translate-x-1" /></>}
                </button>
              </div>
            </div>
          </div>
        )}

        {stage === 'result' && (
          <div className="flex flex-col h-full bg-white relative">
            {/* Header */}
            <header className="px-10 py-6 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-xl z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-black text-gray-900">Simulation Workspace</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="px-3 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-black uppercase tracking-widest">Live Roleplay</div>
                {/* Fixed: Added missing 'Plus' icon import */}
                <button onClick={startNewSim} className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"><Plus className="w-5 h-5" /></button>
              </div>
            </header>

            {/* Chat Area */}
            <div className="flex-grow overflow-y-auto p-10 space-y-10 bg-gray-50/20">
              {messages.map((m) => {
                const isUser = m.senderType === 'user';
                return (
                  <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4`}>
                    <div className={`flex gap-5 max-w-[85%] sm:max-w-[70%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className="shrink-0 mt-1">
                        {isUser ? (
                          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center shadow-lg"><User className="text-white w-6 h-6" /></div>
                        ) : (
                          <img src={selectedPersona?.avatarUrl} className="w-10 h-10 rounded-xl shadow-lg border-2 border-white ring-4 ring-gray-100" />
                        )}
                      </div>
                      <div className="space-y-1 min-w-0">
                        {!isUser && <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{selectedPersona?.name}</p>}
                        <div className={`p-6 rounded-3xl shadow-sm text-lg ${isUser ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'}`}>
                          <FormattedSimulationResponse content={m.content} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {isTyping && <div className="flex justify-start"><div className="flex gap-4 items-center bg-white border border-gray-100 px-6 py-4 rounded-[2rem] shadow-sm"><Loader2 className="w-4 h-4 text-indigo-600 animate-spin" /><span className="text-xs font-black text-gray-300 uppercase tracking-widest">Processing...</span></div></div>}
              <div ref={scrollRef} />
            </div>

            {/* Follow-up input */}
            <div className="p-10 border-t border-gray-100 bg-white">
              <form onSubmit={handleSendFollowUp} className="max-w-4xl mx-auto">
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendFollowUp(); } }}
                    placeholder="Ask a question or challenge this reaction..."
                    className="w-full px-8 py-5 bg-gray-50 border border-gray-100 rounded-[2.5rem] font-medium focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:bg-white transition-all pr-20 shadow-inner resize-none min-h-[72px] overflow-hidden"
                    rows={1}
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isTyping}
                    className="absolute right-4 bottom-4 p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:bg-gray-200"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Info Context Bar (Only shown in Result Stage) */}
      {stage === 'result' && (
        <aside className="hidden lg:flex w-96 flex-col border-l border-gray-100 bg-gray-50/50 overflow-y-auto p-8 space-y-10">
          <div className="flex items-center gap-4 pb-8 border-b border-gray-100">
             <img src={selectedPersona?.avatarUrl} className="w-16 h-16 rounded-2xl object-cover shadow-xl border-2 border-white" />
             <div>
               <h3 className="font-black text-gray-900 leading-none mb-1">{selectedPersona?.name}</h3>
               <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">{MODES.find(m => m.id === mode)?.label}</p>
             </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Context Info</h4>
            <p className="text-sm text-gray-600 leading-relaxed font-medium bg-white p-4 rounded-2xl border border-gray-100 italic">"{bgInfo}"</p>
          </div>
          {stimulusImage && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Stimulus Asset</h4>
              <img src={stimulusImage} className="w-full rounded-2xl shadow-sm border border-gray-100" />
            </div>
          )}
        </aside>
      )}
    </div>
  );
};

export default SimulationPage;
