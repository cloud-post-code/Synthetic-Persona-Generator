import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Filter, MessageSquare, Trash2, Calendar, User, FileText, X, ChevronRight, Download, Loader2 } from 'lucide-react';
import { usePersonas } from '../hooks/usePersonas.js';
import { personaApi } from '../services/personaApi.js';
import { Persona, PersonaFile } from '../models/types.js';

const GalleryPage: React.FC = () => {
  const { personas, loading, deletePersona } = usePersonas();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [viewingFilesPersona, setViewingFilesPersona] = useState<Persona | null>(null);
  const [personaFiles, setPersonaFiles] = useState<Record<string, PersonaFile[]>>({});
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    // Load files when viewing a persona
    if (viewingFilesPersona && !personaFiles[viewingFilesPersona.id]) {
      loadPersonaFiles(viewingFilesPersona.id);
    }
  }, [viewingFilesPersona]);

  const loadPersonaFiles = async (personaId: string) => {
    if (loadingFiles[personaId]) return;
    setLoadingFiles(prev => ({ ...prev, [personaId]: true }));
    try {
      const files = await personaApi.getFiles(personaId);
      // Normalize file format
      const normalized = files.map(f => ({
        ...f,
        createdAt: f.created_at || f.createdAt,
      }));
      setPersonaFiles(prev => ({ ...prev, [personaId]: normalized }));
    } catch (err) {
      console.error('Failed to load persona files:', err);
    } finally {
      setLoadingFiles(prev => ({ ...prev, [personaId]: false }));
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this persona? This action cannot be undone.')) {
      setDeletingId(id);
      try {
        await deletePersona(id);
      } catch (err: any) {
        alert(err.message || 'Could not delete persona. Please try again.');
      } finally {
        setDeletingId(null);
      }
    }
  };

  const filteredPersonas = personas.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.description.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Normalize persona data for display
  const normalizedPersonas = filteredPersonas.map(p => ({
    ...p,
    avatarUrl: p.avatarUrl || p.avatar_url,
    createdAt: p.createdAt || p.created_at,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Personas</h1>
          <p className="text-gray-500">Your library of synthetic experts and users.</p>
        </div>
        <Link
          to="/build"
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <User className="w-4 h-4 mr-2" /> New Persona
        </Link>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-8 flex flex-col md:flex-row gap-4">
        <div className="flex-grow relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search personas..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
           <Filter className="text-gray-400 w-5 h-5" />
           <select
             value={typeFilter}
             onChange={e => setTypeFilter(e.target.value)}
             className="border border-gray-200 rounded-xl py-2 px-4 text-sm focus:ring-2 focus:ring-indigo-500"
           >
             <option value="all">All Types</option>
             <option value="synthetic_user">Synthetic User</option>
             <option value="advisor">Advisor</option>
             <option value="practice_person">Practice Person</option>
           </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : normalizedPersonas.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {normalizedPersonas.map((persona) => (
            <PersonaCard 
              key={persona.id} 
              persona={persona} 
              isDeleting={deletingId === persona.id}
              onDelete={() => handleDelete(persona.id)} 
              onViewFiles={() => setViewingFilesPersona(persona)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No personas found</h3>
          <p className="text-gray-500">Start by building your first synthetic persona.</p>
          <Link to="/build" className="mt-4 inline-block text-indigo-600 font-semibold hover:underline">Build Persona</Link>
        </div>
      )}

      {/* Blueprint/Files Modal */}
      {viewingFilesPersona && (
        <FileViewerModal 
          persona={viewingFilesPersona}
          files={personaFiles[viewingFilesPersona.id] || []}
          loadingFiles={loadingFiles[viewingFilesPersona.id]}
          onClose={() => setViewingFilesPersona(null)} 
        />
      )}
    </div>
  );
};

const PersonaCard: React.FC<{ 
  persona: Persona; 
  isDeleting: boolean;
  onDelete: () => void; 
  onViewFiles: () => void;
}> = ({ persona, isDeleting, onDelete, onViewFiles }) => {
  const navigate = useNavigate();

  const typeLabels: Record<string, { label: string; color: string }> = {
    synthetic_user: { label: 'Synthetic User', color: 'bg-blue-100 text-blue-700' },
    advisor: { label: 'Advisor', color: 'bg-purple-100 text-purple-700' },
    practice_person: { label: 'Practice Person', color: 'bg-pink-100 text-pink-700' },
  };

  const avatarUrl = persona.avatarUrl || persona.avatar_url;
  const createdAt = persona.createdAt || persona.created_at;

  return (
    <div className={`bg-white border border-gray-100 rounded-2xl overflow-hidden group hover:shadow-xl transition-all flex flex-col h-full ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="relative h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
        <img
          src={avatarUrl}
          alt={persona.name}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
        <div className="absolute top-4 right-4 flex gap-2 z-10">
           <button
             onClick={(e) => {
               e.stopPropagation();
               onViewFiles();
             }}
             className="p-2 bg-white/80 backdrop-blur rounded-lg text-indigo-600 hover:bg-white transition-colors shadow-sm cursor-pointer"
             title="View Blueprint Files"
           >
             <FileText className="w-4 h-4" />
           </button>
           <button
             onClick={(e) => {
               e.stopPropagation();
               onDelete();
             }}
             disabled={isDeleting}
             className={`p-2 bg-white/80 backdrop-blur rounded-lg text-red-600 hover:bg-white transition-colors shadow-sm cursor-pointer ${isDeleting ? 'animate-pulse' : ''}`}
             title="Delete Persona"
           >
             {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
           </button>
        </div>
        <div className="absolute bottom-4 left-4">
          <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${typeLabels[persona.type].color}`}>
            {typeLabels[persona.type].label}
          </span>
        </div>
      </div>
      <div className="p-6 flex-grow flex flex-col">
        <h3 className="text-xl font-bold text-gray-900 mb-2">{persona.name}</h3>
        <p className="text-gray-500 text-sm mb-4 line-clamp-2">{persona.description}</p>
        
        <div className="flex items-center text-xs text-gray-400 mb-6">
          <Calendar className="w-3 h-3 mr-1" /> {createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A'}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-auto">
          <button
            onClick={onViewFiles}
            className="py-3 bg-gray-50 text-gray-700 rounded-xl font-bold hover:bg-gray-100 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <FileText className="w-4 h-4" /> Files
          </button>
          <button
            onClick={() => navigate(`/chat?personaId=${persona.id}`)}
            className="py-3 bg-indigo-50 text-indigo-700 rounded-xl font-bold hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" /> Chat
          </button>
        </div>
      </div>
    </div>
  );
};

const FileViewerModal: React.FC<{ 
  persona: Persona; 
  files: PersonaFile[];
  loadingFiles: boolean;
  onClose: () => void;
}> = ({ persona, files, loadingFiles, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<PersonaFile | null>(files[0] || null);

  useEffect(() => {
    if (files.length > 0 && !selectedFile) {
      setSelectedFile(files[0]);
    }
  }, [files]);

  const avatarUrl = persona.avatarUrl || persona.avatar_url;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-5xl h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-200">
        
        {/* Sidebar - File List */}
        <aside className="w-full md:w-80 bg-gray-50 border-r border-gray-100 flex flex-col overflow-hidden">
          <div className="p-8 border-b border-gray-100 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <img src={avatarUrl} alt={persona.name} className="w-10 h-10 rounded-xl object-cover" />
              <div>
                <h3 className="font-bold text-gray-900 truncate max-w-[150px]">{persona.name}</h3>
                <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider">Blueprint Files</p>
              </div>
            </div>
          </div>
          <div className="flex-grow overflow-y-auto p-4 space-y-2">
            {loadingFiles ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              </div>
            ) : files.length > 0 ? (
              files.map((file) => (
                <button
                  key={file.id}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left p-4 rounded-2xl flex items-center justify-between transition-all cursor-pointer ${
                    selectedFile?.id === file.id 
                    ? 'bg-white shadow-lg shadow-gray-200/50 text-indigo-600 border border-gray-100' 
                    : 'text-gray-600 hover:bg-white hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className={`w-5 h-5 shrink-0 ${selectedFile?.id === file.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                    <span className="text-sm font-bold truncate">{file.name}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${selectedFile?.id === file.id ? 'rotate-90 translate-x-1' : ''}`} />
                </button>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                No files available
              </div>
            )}
          </div>
          <div className="p-6 bg-white border-t border-gray-100">
            <button 
              onClick={onClose}
              className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Close Viewer
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-grow flex flex-col bg-white overflow-hidden relative">
          <div className="absolute top-6 right-6 z-10">
            <button onClick={onClose} className="p-3 bg-gray-100 text-gray-400 rounded-2xl hover:bg-gray-200 hover:text-gray-900 transition-all cursor-pointer">
              <X className="w-6 h-6" />
            </button>
          </div>

          {selectedFile ? (
            <div className="flex-grow flex flex-col overflow-hidden">
              <header className="px-10 pt-10 pb-6 border-b border-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 mb-1">{selectedFile.name}</h2>
                    <p className="text-sm text-gray-400 font-medium">Blueprint source generated by Gemini 3</p>
                  </div>
                  <button className="hidden sm:flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all cursor-pointer">
                    <Download className="w-4 h-4" /> Download .md
                  </button>
                </div>
              </header>
              <div className="flex-grow overflow-y-auto p-10 bg-gray-50/30">
                <div className="bg-white p-8 sm:p-12 rounded-3xl border border-gray-100 shadow-sm max-w-4xl mx-auto min-h-full">
                   <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed text-base">
                     {selectedFile.content}
                   </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center p-12 text-center">
              <div className="max-w-md">
                <div className="w-20 h-20 bg-gray-50 text-gray-300 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No file selected</h3>
                <p className="text-gray-500">Select a file from the sidebar to view its blueprint data.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default GalleryPage;
