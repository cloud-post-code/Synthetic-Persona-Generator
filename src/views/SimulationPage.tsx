
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
  X as CloseIcon,
  XCircle,
  LucideIcon
} from 'lucide-react';
import { Persona, SimulationMode, Message, SimulationSession } from '../models/types.js';
import { usePersonas } from '../hooks/usePersonas.js';
import { simulationApi } from '../services/simulationApi.js';
import { personaApi } from '../services/personaApi.js';
import { geminiService } from '../services/gemini.js';
import { simulationTemplateApi, SimulationTemplate } from '../services/simulationTemplateApi.js';

// Icon mapping helper
const iconMap: Record<string, LucideIcon> = {
  Monitor,
  Megaphone,
  TrendingUp,
  Briefcase,
  // Add more icons as needed
};

const getIcon = (iconName?: string): LucideIcon => {
  if (!iconName) return Monitor;
  return iconMap[iconName] || Monitor;
};

const FormattedSimulationResponse: React.FC<{ content: string; isUser?: boolean }> = ({ content, isUser = false }) => {
  const lines = content.split('\n');
  
  const processLine = (line: string, lineIdx: number): React.ReactNode => {
    // Handle headers (## or ###)
    if (line.trim().startsWith('###')) {
      const headerText = line.replace(/^###+\s*/, '');
      return (
        <h3 key={lineIdx} className={`font-black text-lg mb-2 mt-4 ${isUser ? 'text-white' : 'text-gray-900'}`}>
          {processInlineFormatting(headerText, lineIdx)}
        </h3>
      );
    }
    
    if (line.trim().startsWith('##')) {
      const headerText = line.replace(/^##+\s*/, '');
      return (
        <h2 key={lineIdx} className={`font-black text-xl mb-2 mt-4 ${isUser ? 'text-white' : 'text-gray-900'}`}>
          {processInlineFormatting(headerText, lineIdx)}
        </h2>
      );
    }

    // Handle simple lists (lines starting with - or * or numbered)
    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const indent = listMatch[1].length;
      const content = listMatch[3];
      const indentClass = indent === 0 ? 'pl-0' : indent <= 2 ? 'pl-4' : indent <= 4 ? 'pl-8' : 'pl-12';
      return (
        <div key={lineIdx} className={`${indentClass} relative flex items-start gap-2`}>
          <span className={`shrink-0 mt-1 ${isUser ? 'text-white' : 'text-indigo-600'} font-bold`}>
            {listMatch[2].match(/\d+/) ? `${listMatch[2]}` : '•'}
          </span>
          <span className={`leading-relaxed flex-1 ${isUser ? 'text-white' : 'text-gray-800'}`}>
            {processInlineFormatting(content, lineIdx)}
          </span>
        </div>
      );
    }

    // Regular paragraph
    if (line.trim()) {
      return (
        <p key={lineIdx} className={`leading-relaxed ${isUser ? 'text-white' : 'text-gray-800'}`}>
          {processInlineFormatting(line, lineIdx)}
        </p>
      );
    }

    // Empty line
    return <br key={lineIdx} />;
  };

  const processInlineFormatting = (text: string, lineIdx: number): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let partKey = 0;

    // Match all formatting: **bold**, *italic*, or combined
    const formatRegex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
    const matches = [...text.matchAll(formatRegex)];

    if (matches.length === 0) {
      return text;
    }

    matches.forEach((match) => {
      const index = match.index!;
      
      // Add text before the match
      if (index > lastIndex) {
        parts.push(text.substring(lastIndex, index));
      }

      // Process the matched formatting
      if (match[1].startsWith('**')) {
        // Bold
        parts.push(
          <strong key={`${lineIdx}-${partKey++}`} className={isUser ? 'text-white' : 'text-gray-900'}>
            {match[2]}
          </strong>
        );
      } else if (match[1].startsWith('*') && !match[1].startsWith('**')) {
        // Italic
        parts.push(
          <em key={`${lineIdx}-${partKey++}`} className={isUser ? 'text-white/90' : 'text-gray-700'}>
            {match[3]}
          </em>
        );
      } else if (match[1].startsWith('`')) {
        // Code
        parts.push(
          <code key={`${lineIdx}-${partKey++}`} className={`px-1.5 py-0.5 rounded text-sm font-mono ${isUser ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-900'}`}>
            {match[4]}
          </code>
        );
      }

      lastIndex = index + match[0].length;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };
  
  return (
    <div className="space-y-1.5 break-words">
      {lines.map((line, idx) => processLine(line, idx))}
    </div>
  );
};

const SimulationPage: React.FC = () => {
  const [stage, setStage] = useState<'selection' | 'inputs' | 'result'>('selection');
  const [selectedSimulation, setSelectedSimulation] = useState<SimulationTemplate | null>(null);
  const [simulations, setSimulations] = useState<SimulationTemplate[]>([]);
  const [mode, setMode] = useState<SimulationMode | null>(null); // Keep for backward compatibility with existing sessions
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [bgInfo, setBgInfo] = useState('');
  const [openingLine, setOpeningLine] = useState('');
  const [stimulusImage, setStimulusImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [inputFields, setInputFields] = useState<Record<string, string>>({});
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSimulations, setIsLoadingSimulations] = useState(true);
  const [simulationsError, setSimulationsError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const [simulationHistory, setSimulationHistory] = useState<SimulationSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { personas: allPersonas } = usePersonas();

  // Load simulations on mount
  useEffect(() => {
    const loadSimulations = async () => {
      setIsLoadingSimulations(true);
      setSimulationsError(null);
      try {
        const sims = await simulationTemplateApi.getAll();
        setSimulations(sims);
      } catch (error) {
        console.error('Failed to load simulations:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load simulations';
        setSimulationsError(errorMessage);
      } finally {
        setIsLoadingSimulations(false);
      }
    };
    loadSimulations();
  }, []);

  // Save messages to localStorage when they change
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      localStorage.setItem(`simulationMessages_${currentSessionId}`, JSON.stringify(messages));
    }
  }, [messages, currentSessionId]);

  // Save active session to localStorage
  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem('simulationActiveSessionId', currentSessionId);
    } else {
      localStorage.removeItem('simulationActiveSessionId');
    }
  }, [currentSessionId]);

  useEffect(() => {
    setPersonas(allPersonas);
    loadHistory();
  }, [allPersonas]);

  // Restore last active simulation session after history is loaded
  useEffect(() => {
    const restoreSession = async () => {
      const savedSessionId = localStorage.getItem('simulationActiveSessionId');
      if (savedSessionId && allPersonas.length > 0 && simulationHistory.length > 0 && !currentSessionId) {
        const savedSession = simulationHistory.find(s => s.id === savedSessionId);
        if (savedSession) {
          // Use the resumeSimulation function defined below
          setIsLoading(true);
          setCurrentSessionId(savedSession.id);
          setMode(savedSession.mode);
          setBgInfo(savedSession.bgInfo);
          setOpeningLine(savedSession.openingLine || '');
          setStimulusImage(savedSession.stimulusImage || null);
          setMimeType(savedSession.mimeType || null);
          
          const persona = allPersonas.find(p => p.id === savedSession.personaId);
          setSelectedPersona(persona || null);

          // Load messages from localStorage
          try {
            const savedMessages = localStorage.getItem(`simulationMessages_${savedSession.id}`);
            if (savedMessages) {
              const parsed = JSON.parse(savedMessages);
              setMessages(parsed);
            } else {
              setMessages([]);
            }
          } catch (err) {
            console.error('Failed to load messages from localStorage:', err);
            setMessages([]);
          }
          
          setStage('result');
          setIsLoading(false);
        }
      }
    };
    restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulationHistory, allPersonas]);

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
    
    if (!selectedSimulation) {
      alert('Please select a simulation');
      return;
    }
    
    // Validate required input fields
    for (const field of selectedSimulation.required_input_fields) {
      if (field.required && !inputFields[field.name]?.trim()) {
        alert(`Please fill in the required field: ${field.label}`);
        return;
      }
    }
    
    setIsLoading(true);

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

    // Map input fields to template variables
    const fieldMap: Record<string, string> = {
      bgInfo: bgInfo,
      openingLine: openingLine,
      ...inputFields,
    };

    let prompt = selectedSimulation.system_prompt
      .replace(/{{SELECTED_PROFILE}}/g, selectedPersona.name)
      .replace(/{{SELECTED_PROFILE_FULL}}/g, profileData)
      .replace(/{{BACKGROUND_INFO}}/g, fieldMap.bgInfo || bgInfo || '')
      .replace(/{{OPENING_LINE}}/g, fieldMap.openingLine || openingLine || '');
    
    // Replace any other template variables from input fields
    for (const [key, value] of Object.entries(fieldMap)) {
      prompt = prompt.replace(new RegExp(`{{${key.toUpperCase()}}}`, 'g'), value || '');
    }

    try {
      const result = await geminiService.runSimulation(prompt, stimulusImage || undefined, mimeType || undefined);
      
      // Ensure all required fields are present
      if (!selectedPersona.id) {
        throw new Error('Persona ID is missing');
      }
      // Determine mode for backward compatibility (use first 4 chars of simulation title or default)
      let sessionMode: SimulationMode = 'web_page';
      const modeTitle = selectedSimulation.title.toLowerCase();
      if (modeTitle.includes('marketing')) sessionMode = 'marketing';
      else if (modeTitle.includes('sales')) sessionMode = 'sales_pitch';
      else if (modeTitle.includes('investor')) sessionMode = 'investor_pitch';
      
      const newSession = await simulationApi.create({
        personaId: selectedPersona.id,
        mode: sessionMode,
        bgInfo: fieldMap.bgInfo?.trim() || bgInfo.trim() || '',
        openingLine: fieldMap.openingLine || openingLine || undefined,
        stimulusImage: stimulusImage || undefined,
        mimeType: mimeType || undefined,
        name: `${selectedPersona.name} - ${selectedSimulation.title}`
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
      
      // Save initial message to localStorage
      localStorage.setItem(`simulationMessages_${newSessionId}`, JSON.stringify([initialMessage]));
      
      // Save full persona data (with files) to localStorage for quick restoration
      const personaWithFiles = {
        ...selectedPersona,
        files: selectedPersona.files || [],
      };
      // Ensure files are loaded if not already
      if (personaWithFiles.files.length === 0) {
        try {
          const files = await personaApi.getFiles(selectedPersona.id);
          personaWithFiles.files = files.map(f => ({
            ...f,
            createdAt: f.created_at || f.createdAt,
          }));
        } catch (err) {
          console.error('Failed to load persona files:', err);
        }
      }
      localStorage.setItem(`simulationPersona_${newSessionId}`, JSON.stringify(personaWithFiles));
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

    const currentInput = chatInput;
    setMessages(prev => [...prev, userMsg]);
    // Note: Messages are stored locally for simulations
    // In production, you might want to create a chat session for each simulation
    setChatInput('');
    setIsTyping(true);

    try {
      // Build history from current messages + the new user message
      const history = [...messages, userMsg].map(m => ({
        role: m.senderType === 'user' ? 'user' as const : 'model' as const,
        text: m.content
      }));

      const systemPrompt = `You are strictly acting as the persona: ${selectedPersona.name}.\n` +
        `Context of Simulation: ${bgInfo}.\n` +
        `Respond to the user naturally in your unique voice. Staying in character is mandatory.`;
      
      const response = await geminiService.chat(systemPrompt, history, currentInput);
      
      const aiMsg: Message = {
        id: crypto.randomUUID(),
        sessionId: currentSessionId,
        senderType: 'persona',
        personaId: selectedPersona.id,
        content: response,
        createdAt: new Date().toISOString()
      };

      setMessages(prev => [...prev, aiMsg]);
      // Messages are saved to localStorage via useEffect
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
    
    // Try to load persona from localStorage first (faster)
    let persona: Persona | null = null;
    const cachedPersona = localStorage.getItem(`simulationPersona_${session.id}`);
    if (cachedPersona) {
      try {
        persona = JSON.parse(cachedPersona);
      } catch (err) {
        console.error('Failed to parse cached persona:', err);
      }
    }
    
    // If no cached persona, try to find in current personas list
    if (!persona) {
      persona = personas.find(p => p.id === session.personaId) || null;
    }
    
    // If still no persona, fetch from API
    if (!persona && session.personaId) {
      try {
        const fetchedPersona = await personaApi.getById(session.personaId);
        // Normalize persona data
        persona = {
          ...fetchedPersona,
          avatarUrl: fetchedPersona.avatar_url || fetchedPersona.avatarUrl,
          createdAt: fetchedPersona.created_at || fetchedPersona.createdAt,
          updatedAt: fetchedPersona.updated_at || fetchedPersona.updatedAt,
          files: fetchedPersona.files || [],
        };
        
        // Load files if not already loaded
        if (!persona.files || persona.files.length === 0) {
          try {
            const files = await personaApi.getFiles(persona.id);
            persona.files = files.map(f => ({
              ...f,
              createdAt: f.created_at || f.createdAt,
            }));
          } catch (err) {
            console.error('Failed to load persona files:', err);
          }
        }
        
        // Save to localStorage for next time
        localStorage.setItem(`simulationPersona_${session.id}`, JSON.stringify(persona));
      } catch (err) {
        console.error('Failed to fetch persona:', err);
      }
    }
    
    // If we have a persona but files aren't loaded, load them
    if (persona && (!persona.files || persona.files.length === 0)) {
      try {
        const files = await personaApi.getFiles(persona.id);
        persona.files = files.map(f => ({
          ...f,
          createdAt: f.created_at || f.createdAt,
        }));
        // Update localStorage with files
        localStorage.setItem(`simulationPersona_${session.id}`, JSON.stringify(persona));
      } catch (err) {
        console.error('Failed to load persona files:', err);
      }
    }
    
    setSelectedPersona(persona);

    // Load messages from localStorage
    try {
      const savedMessages = localStorage.getItem(`simulationMessages_${session.id}`);
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        setMessages(parsed);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to load messages from localStorage:', err);
      setMessages([]);
    }
    
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

  const handleDeleteMessage = (messageId: string) => {
    setMessages(prev => {
      const updated = prev.filter(m => m.id !== messageId);
      // Update localStorage
      if (currentSessionId) {
        localStorage.setItem(`simulationMessages_${currentSessionId}`, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const startNewSim = () => {
    setStage('selection');
    setCurrentSessionId(null);
    setSelectedSimulation(null);
    setMode(null);
    setSelectedPersona(null);
    setBgInfo('');
    setOpeningLine('');
    setStimulusImage(null);
    setMimeType(null);
    setInputFields({});
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
              {isLoadingSimulations ? (
                <div className="col-span-full text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
                  <p className="text-gray-500">Loading simulations...</p>
                </div>
              ) : simulationsError ? (
                <div className="col-span-full text-center py-12">
                  <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
                  <p className="text-red-600 font-bold mb-2">Failed to load simulations</p>
                  <p className="text-gray-500 text-sm">{simulationsError}</p>
                  <button
                    onClick={() => {
                      const loadSimulations = async () => {
                        setIsLoadingSimulations(true);
                        setSimulationsError(null);
                        try {
                          const sims = await simulationTemplateApi.getAll();
                          setSimulations(sims);
                        } catch (error) {
                          console.error('Failed to load simulations:', error);
                          const errorMessage = error instanceof Error ? error.message : 'Failed to load simulations';
                          setSimulationsError(errorMessage);
                        } finally {
                          setIsLoadingSimulations(false);
                        }
                      };
                      loadSimulations();
                    }}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : simulations.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <p className="text-gray-500">No simulations available</p>
                </div>
              ) : (
                simulations.map((sim) => {
                  const Icon = getIcon(sim.icon);
                  return (
                    <button
                      key={sim.id}
                      onClick={() => { 
                        setSelectedSimulation(sim);
                        setStage('inputs');
                        // Reset input fields when selecting new simulation
                        setInputFields({});
                      }}
                      className="group p-8 bg-white border border-gray-100 rounded-[2.5rem] text-left hover:shadow-2xl hover:-translate-y-2 transition-all border-b-8 hover:border-indigo-600 flex flex-col h-full"
                    >
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-8 shadow-lg transition-all group-hover:scale-110 group-hover:text-white bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600">
                        <Icon className="w-7 h-7" />
                      </div>
                      <h3 className="text-xl font-black text-gray-900 mb-2">{sim.title}</h3>
                      <p className="text-gray-400 text-sm font-medium leading-relaxed flex-grow">{sim.description || 'Stress-test your strategy using this specialized simulation prompt.'}</p>
                      <div className="mt-8 flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 group-hover:text-indigo-600">
                        Configure Test <ChevronRight className="ml-2 w-3 h-3" />
                      </div>
                    </button>
                  );
                })
              )}
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
                  {selectedSimulation && React.createElement(getIcon(selectedSimulation.icon), { className: "w-8 h-8" })}
                </div>
                <div>
                  <h2 className="text-3xl font-black text-gray-900">{selectedSimulation?.title || 'Simulation'}</h2>
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

                {/* Dynamic input fields based on simulation template */}
                {selectedSimulation?.required_input_fields.map((field, index) => {
                  const fieldNumber = index + 2;
                  if (field.type === 'image') {
                    return (
                      <div key={field.name} className="space-y-4">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          {fieldNumber}. {field.label} {field.required && '*'}
                        </label>
                        <div className="relative group cursor-pointer border-4 border-dashed border-gray-100 rounded-[2.5rem] p-12 text-center hover:border-indigo-300 transition-all bg-gray-50/50 overflow-hidden">
                          {inputFields[field.name] || stimulusImage ? (
                            <div className="relative inline-block">
                              <img src={inputFields[field.name] || stimulusImage || ''} className="max-h-64 mx-auto rounded-xl shadow-2xl border border-white" />
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInputFields({ ...inputFields, [field.name]: '' });
                                  setStimulusImage(null);
                                }} 
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg"
                              >
                                <CloseIcon className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto text-gray-400 group-hover:text-indigo-600 transition-colors">
                                <Upload className="w-8 h-8" />
                              </div>
                              <p className="text-gray-500 font-bold">{field.placeholder || 'Upload Image'}</p>
                            </div>
                          )}
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setMimeType(file.type);
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  const result = ev.target?.result as string;
                                  setInputFields({ ...inputFields, [field.name]: result });
                                  setStimulusImage(result);
                                };
                                reader.readAsDataURL(file);
                              }
                            }} 
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                          />
                        </div>
                      </div>
                    );
                  } else {
                    const isTextarea = field.type === 'textarea';
                    const value = inputFields[field.name] || (field.name === 'bgInfo' ? bgInfo : field.name === 'openingLine' ? openingLine : '');
                    return (
                      <div key={field.name} className="space-y-4">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          {fieldNumber}. {field.label} {field.required && '*'}
                        </label>
                        {isTextarea ? (
                          <textarea
                            value={value}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              setInputFields({ ...inputFields, [field.name]: newValue });
                              if (field.name === 'bgInfo') setBgInfo(newValue);
                              if (field.name === 'openingLine') setOpeningLine(newValue);
                            }}
                            placeholder={field.placeholder}
                            required={field.required}
                            className="w-full h-32 p-6 bg-gray-50 border border-gray-100 rounded-3xl font-medium focus:ring-4 focus:ring-indigo-100 outline-none transition-all resize-none"
                          />
                        ) : (
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              setInputFields({ ...inputFields, [field.name]: newValue });
                              if (field.name === 'bgInfo') setBgInfo(newValue);
                              if (field.name === 'openingLine') setOpeningLine(newValue);
                            }}
                            placeholder={field.placeholder}
                            required={field.required}
                            className="w-full p-6 bg-gray-50 border border-gray-100 rounded-3xl font-medium focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                          />
                        )}
                      </div>
                    );
                  }
                })}

                <button
                  disabled={isLoading || !selectedPersona || !selectedSimulation}
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
                  <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 group`}>
                    <div className={`flex gap-5 max-w-[85%] sm:max-w-[70%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className="shrink-0 mt-1">
                        {isUser ? (
                          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center shadow-lg"><User className="text-white w-6 h-6" /></div>
                        ) : (
                          <img src={selectedPersona?.avatarUrl} className="w-10 h-10 rounded-xl shadow-lg border-2 border-white ring-4 ring-gray-100" />
                        )}
                      </div>
                      <div className="space-y-1 min-w-0 relative">
                        {!isUser && <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{selectedPersona?.name}</p>}
                        <div className={`p-6 rounded-3xl shadow-sm text-lg relative ${isUser ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'}`}>
                          <FormattedSimulationResponse content={m.content} isUser={isUser} />
                          <button
                            onClick={() => handleDeleteMessage(m.id)}
                            className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
                            title="Delete message"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
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
                    onKeyDown={(e) => { 
                      if(e.key === 'Enter' && !e.shiftKey) { 
                        e.preventDefault(); 
                        if (!isTyping && chatInput.trim() && selectedPersona && currentSessionId) {
                          handleSendFollowUp(); 
                        }
                      } 
                    }}
                    placeholder={isTyping ? "Please wait for response..." : "Ask a question or challenge this reaction..."}
                    disabled={isTyping || !selectedPersona || !currentSessionId}
                    className="w-full px-8 py-5 bg-gray-50 border border-gray-100 rounded-[2.5rem] font-medium focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:bg-white transition-all pr-20 shadow-inner resize-none min-h-[72px] overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                    rows={1}
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isTyping || !selectedPersona || !currentSessionId}
                    className="absolute right-4 bottom-4 p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
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
               <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">{selectedSimulation?.title || 'Simulation'}</p>
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
