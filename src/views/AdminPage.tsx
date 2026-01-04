import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  User, 
  MessageSquare, 
  PlayCircle, 
  Plus, 
  Edit, 
  Trash2,
  Loader2,
  Shield
} from 'lucide-react';
import { adminApi, AdminStats, UserWithStats, PersonaWithOwner, ChatSessionWithOwner } from '../services/adminApi.js';
import { simulationTemplateApi, SimulationTemplate, CreateSimulationRequest, UpdateSimulationRequest } from '../services/simulationTemplateApi.js';
import { SimulationTemplateForm } from '../components/SimulationTemplateForm.js';

type TabType = 'dashboard' | 'users' | 'personas' | 'chats' | 'simulations';

const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [personas, setPersonas] = useState<PersonaWithOwner[]>([]);
  const [chats, setChats] = useState<ChatSessionWithOwner[]>([]);
  const [simulations, setSimulations] = useState<SimulationTemplate[]>([]);
  const [showSimulationForm, setShowSimulationForm] = useState(false);
  const [editingSimulation, setEditingSimulation] = useState<SimulationTemplate | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const statsData = await adminApi.getStats();
        setStats(statsData);
      } else if (activeTab === 'users') {
        const usersData = await adminApi.getAllUsers();
        setUsers(usersData);
      } else if (activeTab === 'personas') {
        const personasData = await adminApi.getAllPersonas();
        setPersonas(personasData);
      } else if (activeTab === 'chats') {
        const chatsData = await adminApi.getAllChatSessions();
        setChats(chatsData);
      } else if (activeTab === 'simulations') {
        const simsData = await simulationTemplateApi.getAllAdmin(true);
        setSimulations(simsData);
      }
    } catch (error: any) {
      console.error('Failed to load data:', error);
      alert(`Failed to load data: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSimulation = async (data: CreateSimulationRequest | UpdateSimulationRequest) => {
    try {
      if (editingSimulation) {
        await simulationTemplateApi.update(editingSimulation.id, data);
      } else {
        await simulationTemplateApi.create(data as CreateSimulationRequest);
      }
      setShowSimulationForm(false);
      setEditingSimulation(null);
      loadData();
    } catch (error: any) {
      throw error;
    }
  };

  const handleEditSimulation = (simulation: SimulationTemplate) => {
    setEditingSimulation(simulation);
    setShowSimulationForm(true);
  };

  const handleDeleteSimulation = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this simulation?')) {
      return;
    }
    try {
      await simulationTemplateApi.delete(id);
      loadData();
    } catch (error: any) {
      alert(`Failed to delete: ${error.message || 'Unknown error'}`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const tabs = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users' as TabType, label: 'Users', icon: Users },
    { id: 'personas' as TabType, label: 'Personas', icon: User },
    { id: 'chats' as TabType, label: 'Chats', icon: MessageSquare },
    { id: 'simulations' as TabType, label: 'Simulations', icon: PlayCircle },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-black text-gray-900">Admin Panel</h1>
          </div>
          <p className="text-gray-600">Manage users, personas, chats, and simulation templates</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm
                    ${isActive
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div>
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Users</p>
                      <p className="text-3xl font-black text-gray-900 mt-2">{stats.total_users}</p>
                    </div>
                    <Users className="w-12 h-12 text-indigo-600 opacity-20" />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Personas</p>
                      <p className="text-3xl font-black text-gray-900 mt-2">{stats.total_personas}</p>
                    </div>
                    <User className="w-12 h-12 text-indigo-600 opacity-20" />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Chat Sessions</p>
                      <p className="text-3xl font-black text-gray-900 mt-2">{stats.total_chat_sessions}</p>
                    </div>
                    <MessageSquare className="w-12 h-12 text-indigo-600 opacity-20" />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Messages</p>
                      <p className="text-3xl font-black text-gray-900 mt-2">{stats.total_messages}</p>
                    </div>
                    <MessageSquare className="w-12 h-12 text-indigo-600 opacity-20" />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Simulation Sessions</p>
                      <p className="text-3xl font-black text-gray-900 mt-2">{stats.total_simulation_sessions}</p>
                    </div>
                    <PlayCircle className="w-12 h-12 text-indigo-600 opacity-20" />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Admin Users</p>
                      <p className="text-3xl font-black text-gray-900 mt-2">{stats.admin_users}</p>
                    </div>
                    <Shield className="w-12 h-12 text-indigo-600 opacity-20" />
                  </div>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Personas</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chats</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.username}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.persona_count}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.chat_count}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {user.is_admin ? (
                              <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full">Admin</span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">User</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(user.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Personas Tab */}
            {activeTab === 'personas' && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {personas.map((persona) => (
                        <tr key={persona.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{persona.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{persona.type}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{persona.username}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(persona.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Chats Tab */}
            {activeTab === 'chats' && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Messages</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {chats.map((chat) => (
                        <tr key={chat.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{chat.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{chat.username}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{chat.message_count}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(chat.last_activity)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(chat.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Simulations Tab */}
            {activeTab === 'simulations' && (
              <div>
                <div className="mb-4 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-900">Simulation Templates</h2>
                  <button
                    onClick={() => {
                      setEditingSimulation(null);
                      setShowSimulationForm(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    <Plus className="w-4 h-4" />
                    Create Simulation
                  </button>
                </div>

                {showSimulationForm ? (
                  <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      {editingSimulation ? 'Edit Simulation' : 'Create New Simulation'}
                    </h3>
                    <SimulationTemplateForm
                      simulation={editingSimulation}
                      onSubmit={handleCreateSimulation}
                      onCancel={() => {
                        setShowSimulationForm(false);
                        setEditingSimulation(null);
                      }}
                    />
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Icon</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Input Fields</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {simulations.map((sim) => (
                            <tr key={sim.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sim.title}</td>
                              <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{sim.description || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sim.icon || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sim.required_input_fields.length}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {sim.is_active ? (
                                  <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span>
                                ) : (
                                  <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Inactive</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleEditSimulation(sim)}
                                    className="text-indigo-600 hover:text-indigo-900"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSimulation(sim.id)}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;

