
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Sparkles, Users, ArrowLeft, Loader2, Upload, ChevronRight, AlertCircle } from 'lucide-react';
import { personaApi } from '../services/personaApi.js';
import { geminiService } from '../services/gemini.js';
import { PersonaType, Persona } from '../models/types.js';

// Import split templates
import { marketCanvasTemplate } from '../../templates/marketCanvasTemplate.js';
import { jobBuilderTemplate } from '../../templates/jobBuilderTemplate.js';
import { metricsTemplate } from '../../templates/metricsTemplate.js';
import { agentProfileDetailedTemplate } from '../../templates/agentProfileDetailedTemplate.js';
import { agentBehaviorsTemplate } from '../../templates/agentBehaviorsTemplate.js';
import { highFidelityPersonaTemplate } from '../../templates/highFidelityPersonaTemplate.js';

// --- HELPER COMPONENTS ---

const FormItem: React.FC<{ label: string; value: string; onChange: (v: string) => void; textarea?: boolean; placeholder?: string }> = ({ label, value, onChange, textarea, placeholder }) => (
  <div className="space-y-4">
    <label className="block text-sm font-black text-gray-400 uppercase tracking-widest">{label}</label>
    {textarea ? (
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-gray-50 border border-gray-100 rounded-3xl p-6 h-40 font-medium focus:ring-4 focus:ring-indigo-100 transition-all outline-none resize-none" />
    ) : (
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-6 font-medium focus:ring-4 focus:ring-indigo-100 transition-all outline-none" />
    )}
  </div>
);

const TypeCard: React.FC<{ title: string; description: string; icon: any; onClick: () => void; theme: string }> = ({ title, description, icon: Icon, onClick, theme }) => {
  const themes: Record<string, string> = {
    indigo: 'hover:border-indigo-600 shadow-indigo-100/50 bg-indigo-50 text-indigo-600',
    violet: 'hover:border-violet-600 shadow-violet-100/50 bg-violet-50 text-violet-600',
    pink: 'hover:border-pink-600 shadow-pink-100/50 bg-pink-50 text-pink-600',
  };

  return (
    <button
      onClick={onClick}
      className={`group relative bg-white border border-gray-100 p-10 rounded-[2.5rem] transition-all hover:shadow-2xl hover:-translate-y-2 text-left flex flex-col h-full border-b-8 ${themes[theme].split(' ')[0]}`}
    >
      <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-10 transition-all group-hover:scale-110 shadow-lg ${themes[theme].split(' ').slice(2).join(' ')}`}>
        <Icon className="w-10 h-10" />
      </div>
      <h3 className="text-3xl font-bold text-gray-900 mb-4">{title}</h3>
      <p className="text-gray-500 leading-relaxed flex-grow font-medium">{description}</p>
      <div className="mt-10 flex items-center text-sm font-black uppercase tracking-widest text-gray-400 group-hover:text-gray-900 transition-colors">
        Configure Blueprint <ChevronRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
      </div>
    </button>
  );
};

// --- SYNTHETIC USER FORM ---
const SyntheticUserForm: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [q6FileName, setQ6FileName] = useState('');
  const [formData, setFormData] = useState({
    q1: '', q2: '', q3: '', q4: '', q5: 'B2B' as 'B2B' | 'B2C', q6: '', q7: 1
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setQ6FileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      // Validate UTF-8 text - remove null bytes that cause encoding errors
      const cleanText = text.replace(/\x00/g, '');
      setFormData(prev => ({ ...prev, q6: cleanText }));
    };
    reader.onerror = () => {
      alert('Error reading file. Please ensure it is a valid text file (e.g., .txt, .md, .csv).');
      setQ6FileName('');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const personaGroupId = crypto.randomUUID();
      const userQInputs = `Problem: ${formData.q1}\nSolution: ${formData.q2}\nDiff: ${formData.q3}\nExisting: ${formData.q4}\nContext: ${formData.q5}\nBusiness Data Source (${q6FileName}): ${formData.q6}`;

      setLoadingStage('Synthesizing Market Canvas...');
      const marketCanvas = await geminiService.generateChain(marketCanvasTemplate, { "Strategic Input": userQInputs });

      setLoadingStage('Designing Job Architecture...');
      const jobBuilder = await geminiService.generateChain(jobBuilderTemplate, { "Strategic Analysis": marketCanvas });

      setLoadingStage('Quantifying Success Metrics...');
      const metrics = await geminiService.generateChain(metricsTemplate, { "Context": marketCanvas, "Jobs": jobBuilder });

      const idPrompt = `Identify ${formData.q7} distinct persona names and titles from this analysis. Return JSON: { "personas": [{ "name": string, "title": string }] }. Analysis: ${marketCanvas}`;
      const { personas } = await geminiService.generateBasic(idPrompt, true);

      for (const pInfo of personas) {
        setLoadingStage(`Profiling Agent: ${pInfo.name}...`);
        const profile = await geminiService.generateChain(agentProfileDetailedTemplate, { 
          "Target Persona Name": pInfo.name, 
          "Reference Analysis": `${marketCanvas}\n${jobBuilder}\n${metrics}` 
        });

        setLoadingStage(`Defining Behaviors: ${pInfo.name}...`);
        const behaviors = await geminiService.generateChain(agentBehaviorsTemplate, { 
          "Target Persona": pInfo.name, 
          "Detailed Profile": profile 
        });

        setLoadingStage(`Capturing Digital Likeness: ${pInfo.name}...`);
        const avatarUrl = await geminiService.generateAvatar(pInfo.name, pInfo.title);

        // Create persona
        const persona = await personaApi.create({
          name: pInfo.name,
          type: 'synthetic_user',
          description: pInfo.title,
          avatarUrl: avatarUrl,
          metadata: { personaGroupId },
        });

        // Create persona files
        const files = [
          { name: `Market_Canvas.md`, content: marketCanvas, type: 'markdown' as const },
          { name: `Job_Builder.md`, content: jobBuilder, type: 'markdown' as const },
          { name: `Metrics.md`, content: metrics, type: 'markdown' as const },
          { name: `10Point_Agent_Profile.md`, content: profile, type: 'markdown' as const },
          { name: `Agent_Behaviors.md`, content: behaviors, type: 'markdown' as const }
        ];

        for (const file of files) {
          await personaApi.createFile(persona.id, file);
        }
      }
      onComplete();
    } catch (err: any) {
      console.error('Generation error:', err);
      const errorMessage = err?.message || err?.toString() || 'Unknown error occurred';
      alert(`Generation failed: ${errorMessage}\n\nPlease check:\n1. Gemini API key is set in .env file\n2. You have sufficient API quota\n3. Check browser console for details`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      <div className="space-y-8">
        <FormItem label="UserQ1: Problem" value={formData.q1} onChange={v => setFormData({...formData, q1: v})} textarea placeholder="Problem..." />
        <FormItem label="UserQ2: Solution" value={formData.q2} onChange={v => setFormData({...formData, q2: v})} textarea placeholder="Solution..." />
        <FormItem label="UserQ3: Diff" value={formData.q3} onChange={v => setFormData({...formData, q3: v})} textarea placeholder="Differentiation..." />
        <FormItem label="UserQ4: Alternatives" value={formData.q4} onChange={v => setFormData({...formData, q4: v})} textarea placeholder="Existing..." />
        
        <div className="space-y-4">
          <label className="block text-sm font-black text-gray-400 uppercase tracking-widest">UserQ6: Supporting Docs (Business Plan, Market Research, etc.)</label>
          <div className="border-4 border-dashed border-gray-100 rounded-[2rem] p-12 flex flex-col items-center justify-center text-center hover:border-indigo-300 transition-all bg-gray-50/50 group">
            <Upload className="w-12 h-12 text-gray-300 mb-4 group-hover:text-indigo-500" />
            <p className="text-lg font-bold text-gray-600 mb-4">Include docs about your business</p>
            <input type="file" id="user-q6-file" className="hidden" onChange={handleFile} />
            <label htmlFor="user-q6-file" className="cursor-pointer px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 transition-colors">
              {q6FileName || 'Select Document'}
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-black text-gray-400 uppercase tracking-widest">UserQ7: Generation Count</label>
          <select value={formData.q7} onChange={e => setFormData({...formData, q7: parseInt(e.target.value)})} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-5 font-bold">
            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} Agent{n > 1 ? 's' : ''}</option>)}
          </select>
        </div>
      </div>
      <button type="submit" disabled={loading} className="w-full py-6 bg-indigo-600 text-white font-black text-lg rounded-3xl shadow-xl hover:bg-indigo-700 disabled:opacity-50 transition-all">
        {loading ? <div className="flex flex-col items-center"><Loader2 className="animate-spin mb-1" /> <span className="text-xs uppercase tracking-widest">{loadingStage}</span></div> : 'Submit Blueprint'}
      </button>
    </form>
  );
};

// --- ADVISOR FORM ---
const AdvisorForm: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState('');
  const [fileBase64, setFileBase64] = useState<string>('');
  const [fileMimeType, setFileMimeType] = useState<string>('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size (limit to 20MB for PDFs)
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      alert(`File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds the maximum allowed size of 20MB. Please use a smaller file.`);
      return;
    }
    
    if (file.size === 0) {
      alert('The selected file is empty. Please select a valid file.');
      return;
    }
    
    setFileName(file.name);
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    
    if (isPdf) {
      // Handle PDF: read as base64 for multimodal API
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        if (!result || result.length < 100) {
          alert('Error: The PDF file appears to be empty or corrupted. Please try a different file.');
          return;
        }
        // result is a data URL like "data:application/pdf;base64,<base64data>"
        setFileBase64(result);
        setFileMimeType('application/pdf');
        setFileContent(''); // Clear text content for PDFs
      };
      reader.onerror = () => {
        alert('Error reading PDF file. The file may be corrupted or in an unsupported format. Please try again with a valid PDF.');
        setFileName('');
        setFileBase64('');
      };
      reader.readAsDataURL(file);
    } else {
      // Handle text files: read as text
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        // Validate UTF-8 text - remove null bytes that cause encoding errors
        const cleanText = text.replace(/\x00/g, '');
        setFileContent(cleanText);
        setFileBase64('');
        setFileMimeType(file.type || 'text/plain');
      };
      reader.onerror = () => {
        alert('Error reading file. Please ensure it is a valid text file or PDF.');
      };
      reader.readAsText(file, 'UTF-8');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileContent && !fileBase64) {
      alert('Please select a file to upload.');
      return;
    }
    setLoading(true);
    try {
      let extractedText = fileContent;
      
      // If PDF, extract text using Gemini multimodal API
      if (fileBase64 && (fileMimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf'))) {
        setLoadingStage('Extracting text from PDF...');
        const extractPrompt = `Extract the key text content from this PDF. Focus on:
1. Author/expert name and credentials
2. Main concepts, theories, and key insights
3. Important quotes or passages
4. Summary of the content (limit to ~8000 words maximum)

Return the extracted text in a structured format. Be concise but comprehensive.`;
        
        // Extract base64 data (remove data URL prefix if present)
        // fileBase64 is a data URL like "data:application/pdf;base64,<base64data>"
        // We need to pass the full data URL to runSimulation, which will handle extraction
        // OR pass just the base64 part - let's pass just the base64 part
        let base64Data: string;
        if (fileBase64.startsWith('data:')) {
          // Extract just the base64 part after the comma
          const commaIndex = fileBase64.indexOf(',');
          if (commaIndex === -1) {
            throw new Error('Invalid PDF data format. Please try uploading the file again.');
          }
          base64Data = fileBase64.substring(commaIndex + 1);
        } else {
          // Assume it's already pure base64
          base64Data = fileBase64;
        }
        
        // Validate we have actual data
        if (!base64Data || base64Data.length < 100) {
          throw new Error('PDF file appears to be empty or corrupted. Please ensure the PDF is valid and contains readable content.');
        }
        
        extractedText = await geminiService.runSimulation(
          extractPrompt,
          base64Data,
          'application/pdf'
        );
        
        // Limit extracted text to ~50000 characters to control context size
        if (extractedText.length > 50000) {
          extractedText = extractedText.substring(0, 50000) + '\n\n[Content truncated to manage context size]';
        }
      }
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('Failed to extract text from the file. Please ensure the PDF contains readable text.');
      }
      
      setLoadingStage('Identifying Author Identity...');
      // Use first 8000 chars for identity extraction to save tokens
      const idPrompt = `Analyze this text and identify the primary author/expert. Return JSON: { "name": string, "title": string, "summary": string }. 
Limit your analysis to the key identifying information. Text sample: ${extractedText.substring(0, 8000)}`;
      const { name, title, summary } = await geminiService.generateBasic(idPrompt, true);

      setLoadingStage(`Building High-Fidelity Blueprint for ${name}...`);
      // Limit the source material to ~30000 chars to control context size
      const limitedSourceMaterial = extractedText.length > 30000 
        ? extractedText.substring(0, 30000) + '\n\n[Earlier content truncated for context management]'
        : extractedText;
        
      const profileOutput = await geminiService.generateChain(highFidelityPersonaTemplate, { 
        "Primary Source Material": limitedSourceMaterial,
        "Identity Target": `${name} - ${title}`,
        "Context Summary": summary
      }, true);
      
      setLoadingStage(`Generating Digital Likeness for ${name}...`);
      const avatarUrl = await geminiService.generateAvatar(name || "Expert", title || "Advisor");

      // Create persona
      const persona = await personaApi.create({
        name: name || "Expert Advisor",
        type: 'advisor',
        description: summary || "High-fidelity specialized advisor.",
        avatarUrl: avatarUrl,
        metadata: { personaGroupId: "N/A" },
      });

      // Create persona files
      await personaApi.createFile(persona.id, {
        name: `1_Expert_Blueprint.md`,
        content: profileOutput,
        type: 'markdown'
      });
      // Store the extracted text (limited version)
      const storedContent = extractedText.length > 50000 
        ? extractedText.substring(0, 50000) + '\n\n[Content truncated for storage]'
        : extractedText;
        
      await personaApi.createFile(persona.id, {
        name: `Knowledge_Source.md`,
        content: storedContent,
        type: 'pdf_analysis'
      });
      onComplete();
    } catch (err: any) {
      console.error('Advisor generation error:', err);
      const errorMessage = err?.message || err?.toString() || 'Unknown error occurred';
      alert(`Analysis failed: ${errorMessage}\n\nPlease check:\n1. Gemini API key is set in .env file\n2. You have sufficient API quota\n3. Check browser console for details`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      <div className="space-y-4">
        <label className="block text-sm font-black text-gray-400 uppercase tracking-widest">AdvisoQ1: Upload Expert Source</label>
        <div className="border-4 border-dashed border-gray-100 rounded-[2rem] p-16 flex flex-col items-center justify-center text-center hover:border-violet-300 transition-all bg-gray-50/50 group">
          <Upload className="w-16 h-16 text-gray-300 mb-6 group-hover:text-violet-500" />
          <p className="text-xl font-bold text-gray-600 mb-6">PDF of a book or major article</p>
          <input type="file" id="advisor-file" className="hidden" onChange={handleFile} />
          <label htmlFor="advisor-file" className="cursor-pointer px-10 py-4 bg-violet-600 text-white font-bold rounded-2xl shadow-lg">
            {fileName || 'Select Document'}
          </label>
        </div>
      </div>
      <button type="submit" disabled={loading || (!fileContent && !fileBase64)} className="w-full py-6 bg-violet-600 text-white font-black text-lg rounded-3xl shadow-xl hover:bg-violet-700 disabled:opacity-50 transition-all">
        {loading ? <div className="flex flex-col items-center"><Loader2 className="animate-spin mb-1" /> <span className="text-xs uppercase tracking-widest">{loadingStage}</span></div> : 'Submit for Advisor Profiling'}
      </button>
    </form>
  );
};

// --- PRACTICE PERSON FORM ---
const PracticePersonForm: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [otherDocs, setOtherDocs] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkedin.trim()) {
      alert("Please paste the actual text content of the LinkedIn profile.");
      return;
    }
    
    setLoading(true);
    try {
      setLoadingStage('Analyzing Professional Facts...');
      // Chain of Thought step: Force the model to extract raw data first
      const extractedFacts = await geminiService.extractFacts(linkedin);

      setLoadingStage('Discovering Identity...');
      const idPrompt = `Identify the specific professional from these facts. Return JSON: { "name": string, "title": string }. Facts: ${extractedFacts.substring(0, 2000)}`;
      const { name, title } = await geminiService.generateBasic(idPrompt, true);

      setLoadingStage(`Synthesizing Persona for ${name}...`);
      const profileOutput = await geminiService.generateChain(highFidelityPersonaTemplate, { 
        "Fact Extraction (Source of Truth)": extractedFacts,
        "Raw LinkedIn Content": linkedin,
        "Other Docs": otherDocs,
        "Target Name": name
      }, true);
      
      setLoadingStage(`Capturing Digital Likeness...`);
      const avatarUrl = await geminiService.generateAvatar(name || "Professional", title || "Practice Partner");

      // Create persona
      const persona = await personaApi.create({
        name: name || "Practice Partner",
        type: 'practice_person',
        description: title || "Realistic practice partner.",
        avatarUrl: avatarUrl,
        metadata: { personaGroupId: "N/A" },
      });

      // Create persona files
      await personaApi.createFile(persona.id, {
        name: `1_Professional_Blueprint.md`,
        content: profileOutput,
        type: 'markdown'
      });
      await personaApi.createFile(persona.id, {
        name: `Professional_Facts.md`,
        content: extractedFacts,
        type: 'markdown'
      });
      onComplete();
    } catch (err: any) {
      console.error('Practice person generation error:', err);
      const errorMessage = err?.message || err?.toString() || 'Unknown error occurred';
      alert(`Persona synthesis failed: ${errorMessage}\n\nPlease check:\n1. Gemini API key is set in .env file\n2. You have sufficient API quota\n3. Ensure you pasted text, not just a link\n4. Check browser console for details`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 flex gap-4">
        <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
        <div>
          <h4 className="font-bold text-amber-900 mb-1">Important Instruction</h4>
          <p className="text-sm text-amber-800 leading-relaxed">
            Do not just paste a URL. Go to the LinkedIn profile, press <b>Ctrl+A</b> to select all, <b>Ctrl+C</b> to copy, and <b>Ctrl+V</b> to paste the actual text content below.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <FormItem 
          label="Practice PersonQ1: LinkedIn Data (Paste Content Text)" 
          value={linkedin} 
          onChange={setLinkedin} 
          textarea 
          placeholder="Select all text on the LinkedIn page and paste it here..." 
        />
        <FormItem 
          label="Practice PersonQ2: Other Docs (CV, Portfolio, etc.)" 
          value={otherDocs} 
          onChange={setOtherDocs} 
          textarea 
          placeholder="Paste additional career history or dossier text here..." 
        />
      </div>
      <button type="submit" disabled={loading || !linkedin.trim()} className="w-full py-6 bg-pink-600 text-white font-black text-lg rounded-3xl shadow-xl hover:bg-pink-700 disabled:opacity-50 transition-all">
        {loading ? <div className="flex flex-col items-center"><Loader2 className="animate-spin mb-1" /> <span className="text-xs uppercase tracking-widest">{loadingStage}</span></div> : 'Develop High-Fidelity Practice Persona'}
      </button>
    </form>
  );
};

// --- MAIN PAGE ---

const BuildPersonaPage: React.FC = () => {
  const [selectedType, setSelectedType] = useState<PersonaType | null>(null);
  const navigate = useNavigate();

  const handleBack = () => {
    if (selectedType) setSelectedType(null);
    else navigate(-1);
  };

  if (!selectedType) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">Intelligence Blueprints</h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto font-medium">Select a specialized generation engine to build your synthetic workforce.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <TypeCard
            title="Synthetic User"
            description="Multi-layered persona generation for market research and product stress-testing."
            icon={Target}
            onClick={() => setSelectedType('synthetic_user')}
            theme="indigo"
          />
          <TypeCard
            title="Advisor"
            description="Deep analysis engine for books and articles using Red Team critical evaluation."
            icon={Sparkles}
            onClick={() => setSelectedType('advisor')}
            theme="violet"
          />
          <TypeCard
            title="Practice Person"
            description="Realistic roleplay partner modeling using LinkedIn profiles and professional dossiers."
            icon={Users}
            onClick={() => setSelectedType('practice_person')}
            theme="pink"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 w-full">
      <button
        onClick={handleBack}
        className="flex items-center text-sm font-bold text-gray-400 hover:text-indigo-600 mb-8 transition-colors uppercase tracking-widest"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Selection
      </button>

      <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-gray-200/50 border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500">
        <div className="p-8 sm:p-14">
          {selectedType === 'synthetic_user' && <SyntheticUserForm onComplete={() => navigate('/gallery')} />}
          {selectedType === 'advisor' && <AdvisorForm onComplete={() => navigate('/gallery')} />}
          {selectedType === 'practice_person' && <PracticePersonForm onComplete={() => navigate('/gallery')} />}
        </div>
      </div>
    </div>
  );
};

export default BuildPersonaPage;
