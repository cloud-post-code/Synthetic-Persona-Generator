
import React, { useState, useEffect } from 'react';
import { 
  User, 
  Shield, 
  Bell, 
  Database, 
  Globe, 
  Lock, 
  Mail, 
  Trash2, 
  Download, 
  Eye, 
  EyeOff,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Monitor,
  Plus,
  Briefcase,
  Sparkles,
  Upload,
  Loader2
} from 'lucide-react';
import { storageService } from '../../services/storage';
import { getBusinessProfile, saveBusinessProfile } from '../services/businessProfileApi.js';
import { useAuth } from '../context/AuthContext.js';
import { geminiService, GEMINI_FILE_INPUT_ACCEPT } from '../services/gemini.js';

type SettingsTab = 'profile' | 'security' | 'notifications' | 'data' | 'language' | 'business';

const SettingsLink: React.FC<{ icon: any; label: string; active: boolean; onClick: () => void }> = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
      active 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
    }`}
  >
    <Icon className="w-5 h-5" />
    {label}
  </button>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
    <h3 className="text-lg font-black text-gray-900 mb-6 uppercase tracking-tight">{title}</h3>
    {children}
  </div>
);

const InputField: React.FC<{ label: string; type?: string; value?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; icon?: any; prefix?: string }> = ({ label, type = 'text', value, onChange, icon: Icon, prefix }) => (
  <div className="space-y-2">
    <label className="text-sm font-black text-gray-400 uppercase tracking-widest">{label}</label>
    <div className="relative">
      {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />}
      {prefix && <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">{prefix}</span>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        className={`w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 font-medium focus:ring-4 focus:ring-indigo-100 transition-all outline-none ${Icon || prefix ? 'pl-12' : ''}`}
      />
    </div>
  </div>
);

const TextAreaField: React.FC<{ label: string; value?: string; onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder?: string; rows?: number }> = ({ label, value, onChange, placeholder, rows = 3 }) => (
  <div className="space-y-2">
    <label className="text-sm font-black text-gray-400 uppercase tracking-widest">{label}</label>
    <textarea
      value={value ?? ''}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 font-medium focus:ring-4 focus:ring-indigo-100 transition-all outline-none resize-none"
    />
  </div>
);

const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [showPassword, setShowPassword] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  
  // Profile form state
  const [displayName, setDisplayName] = useState(user?.username || '');
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [bio, setBio] = useState('');

  // Business profile form state
  const [businessName, setBusinessName] = useState('');
  const [missionStatement, setMissionStatement] = useState('');
  const [visionStatement, setVisionStatement] = useState('');
  const [descriptionMainOfferings, setDescriptionMainOfferings] = useState('');
  const [keyFeaturesOrBenefits, setKeyFeaturesOrBenefits] = useState('');
  const [uniqueSellingProposition, setUniqueSellingProposition] = useState('');
  const [pricingModel, setPricingModel] = useState('');
  const [customerSegments, setCustomerSegments] = useState('');
  const [geographicFocus, setGeographicFocus] = useState('');
  const [industryServed, setIndustryServed] = useState('');
  const [whatDifferentiates, setWhatDifferentiates] = useState('');
  const [marketNiche, setMarketNiche] = useState('');
  const [revenueStreams, setRevenueStreams] = useState('');
  const [distributionChannels, setDistributionChannels] = useState('');
  const [keyPersonnel, setKeyPersonnel] = useState('');
  const [majorAchievements, setMajorAchievements] = useState('');
  const [revenue, setRevenue] = useState('');
  const [keyPerformanceIndicators, setKeyPerformanceIndicators] = useState('');
  const [fundingRounds, setFundingRounds] = useState('');
  const [website, setWebsite] = useState('');
  const [businessProfileLoading, setBusinessProfileLoading] = useState(false);

  // Generate business profile with AI
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateFileName, setGenerateFileName] = useState('');
  const [generateFileData, setGenerateFileData] = useState<{ data: string; mimeType?: string } | null>(null);
  const [companyHint, setCompanyHint] = useState('');

  // Load business profile when switching to business tab
  useEffect(() => {
    if (activeTab !== 'business') return;
    let cancelled = false;
    setBusinessProfileLoading(true);
    getBusinessProfile()
      .then((profile) => {
        if (cancelled) return;
        if (profile) {
          setBusinessName(profile.business_name ?? '');
          setMissionStatement(profile.mission_statement ?? '');
          setVisionStatement(profile.vision_statement ?? '');
          setDescriptionMainOfferings(profile.description_main_offerings ?? '');
          setKeyFeaturesOrBenefits(profile.key_features_or_benefits ?? '');
          setUniqueSellingProposition(profile.unique_selling_proposition ?? '');
          setPricingModel(profile.pricing_model ?? '');
          setCustomerSegments(profile.customer_segments ?? '');
          setGeographicFocus(profile.geographic_focus ?? '');
          setIndustryServed(profile.industry_served ?? '');
          setWhatDifferentiates(profile.what_differentiates ?? '');
          setMarketNiche(profile.market_niche ?? '');
          setRevenueStreams(profile.revenue_streams ?? '');
          setDistributionChannels(profile.distribution_channels ?? '');
          setKeyPersonnel(profile.key_personnel ?? '');
          setMajorAchievements(profile.major_achievements ?? '');
          setRevenue(profile.revenue ?? '');
          setKeyPerformanceIndicators(profile.key_performance_indicators ?? '');
          setFundingRounds(profile.funding_rounds ?? '');
          setWebsite(profile.website ?? '');
        }
      })
      .finally(() => {
        if (!cancelled) setBusinessProfileLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeTab]);

  // Update form when user changes
  useEffect(() => {
    if (user) {
      setDisplayName(user.username || '');
      setUsername(user.username || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleSave = () => {
    setSaveStatus('Settings saved successfully!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleSaveBusiness = async () => {
    const payload = {
      business_name: businessName || null,
      mission_statement: missionStatement || null,
      vision_statement: visionStatement || null,
      description_main_offerings: descriptionMainOfferings || null,
      key_features_or_benefits: keyFeaturesOrBenefits || null,
      unique_selling_proposition: uniqueSellingProposition || null,
      pricing_model: pricingModel || null,
      customer_segments: customerSegments || null,
      geographic_focus: geographicFocus || null,
      industry_served: industryServed || null,
      what_differentiates: whatDifferentiates || null,
      market_niche: marketNiche || null,
      revenue_streams: revenueStreams || null,
      distribution_channels: distributionChannels || null,
      key_personnel: keyPersonnel || null,
      major_achievements: majorAchievements || null,
      revenue: revenue || null,
      key_performance_indicators: keyPerformanceIndicators || null,
      funding_rounds: fundingRounds || null,
      website: website || null,
    };
    try {
      await saveBusinessProfile(payload);
      setSaveStatus('Business background saved successfully!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus(err instanceof Error ? err.message : 'Failed to save business background');
      setTimeout(() => setSaveStatus(null), 5000);
    }
  };

  const handleGenerateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setGenerateFileName('');
      setGenerateFileData(null);
      return;
    }
    setGenerateFileName(file.name);
    setGenerateError(null);
    const isBinary = ['application/pdf', 'image/'].some(t => (file.type || '').startsWith(t) || file.type === 'application/pdf');
    if (isBinary || !['text/plain', 'text/csv', 'application/json'].includes(file.type)) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setGenerateFileData({ data: (ev.target?.result as string) || '', mimeType: file.type || 'application/octet-stream' });
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setGenerateFileData({ data: (ev.target?.result as string) || '' });
      };
      reader.readAsText(file);
    }
  };

  const handleGenerateBusinessProfile = async () => {
    if (!generateFileData?.data && !companyHint.trim()) {
      setGenerateError('Upload a document and/or enter a company name or website to generate from.');
      return;
    }
    setGenerateLoading(true);
    setGenerateError(null);
    try {
      const result = await geminiService.generateBusinessProfileFromDocument(
        generateFileData?.data ?? companyHint.trim(),
        { mimeType: generateFileData?.mimeType, companyHint: companyHint.trim() || undefined }
      );
      setBusinessName(result.business_name ?? '');
      setMissionStatement(result.mission_statement ?? '');
      setVisionStatement(result.vision_statement ?? '');
      setDescriptionMainOfferings(result.description_main_offerings ?? '');
      setKeyFeaturesOrBenefits(result.key_features_or_benefits ?? '');
      setUniqueSellingProposition(result.unique_selling_proposition ?? '');
      setPricingModel(result.pricing_model ?? '');
      setCustomerSegments(result.customer_segments ?? '');
      setGeographicFocus(result.geographic_focus ?? '');
      setIndustryServed(result.industry_served ?? '');
      setWhatDifferentiates(result.what_differentiates ?? '');
      setMarketNiche(result.market_niche ?? '');
      setRevenueStreams(result.revenue_streams ?? '');
      setDistributionChannels(result.distribution_channels ?? '');
      setKeyPersonnel(result.key_personnel ?? '');
      setMajorAchievements(result.major_achievements ?? '');
      setRevenue(result.revenue ?? '');
      setKeyPerformanceIndicators(result.key_performance_indicators ?? '');
      setFundingRounds(result.funding_rounds ?? '');
      setWebsite(result.website ?? '');
      setSaveStatus('Business background generated. Review and click Save to keep changes.');
      setTimeout(() => setSaveStatus(null), 5000);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate business background.');
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you absolutely sure? This will delete all your personas, chats, and simulation history forever.')) {
      await storageService.clearAllData();
      alert('All data has been wiped.');
      window.location.reload();
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Settings</h1>
          <p className="text-gray-500 font-medium">Manage your account preferences and application data.</p>
        </div>
        {saveStatus && (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl font-bold border border-green-100 animate-in fade-in slide-in-from-top-4">
            <CheckCircle2 className="w-5 h-5" />
            {saveStatus}
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <aside className="space-y-2">
          <SettingsLink 
            icon={User} 
            label="Profile" 
            active={activeTab === 'profile'} 
            onClick={() => setActiveTab('profile')} 
          />
          <SettingsLink 
            icon={Shield} 
            label="Security" 
            active={activeTab === 'security'} 
            onClick={() => setActiveTab('security')} 
          />
          <SettingsLink 
            icon={Bell} 
            label="Notifications" 
            active={activeTab === 'notifications'} 
            onClick={() => setActiveTab('notifications')} 
          />
          <SettingsLink 
            icon={Database} 
            label="Data & Storage" 
            active={activeTab === 'data'} 
            onClick={() => setActiveTab('data')} 
          />
          <SettingsLink 
            icon={Globe} 
            label="Language" 
            active={activeTab === 'language'} 
            onClick={() => setActiveTab('language')} 
          />
          <SettingsLink 
            icon={Briefcase} 
            label="Business background" 
            active={activeTab === 'business'} 
            onClick={() => setActiveTab('business')} 
          />
          
          <div className="pt-8 border-t border-gray-100 mt-4">
            <button 
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </aside>

        <div className="md:col-span-3 space-y-8 animate-in fade-in duration-300">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <Section title="Public Profile">
                <div className="space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="relative group">
                      <div className="w-24 h-24 bg-indigo-100 rounded-3xl flex items-center justify-center border-4 border-white shadow-xl overflow-hidden">
                        <User className="w-12 h-12 text-indigo-400" />
                      </div>
                      <button className="absolute -bottom-2 -right-2 p-2 bg-white border border-gray-100 rounded-xl shadow-lg text-indigo-600 hover:bg-gray-50 transition-all">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">Avatar Image</h4>
                      <p className="text-sm text-gray-500">Square images work best. Max 5MB.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField 
                      label="Display Name" 
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                    <InputField 
                      label="Username" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      prefix="@" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-400 uppercase tracking-widest">Email</label>
                    <InputField 
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      icon={Mail}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-400 uppercase tracking-widest">Bio</label>
                    <textarea 
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 font-medium focus:ring-4 focus:ring-indigo-100 transition-all outline-none h-32 resize-none"
                      placeholder="Tell the synthetic world about yourself..."
                    />
                  </div>
                </div>
              </Section>
              <div className="flex justify-end">
                <button onClick={handleSave} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <Section title="Change Password">
                <div className="space-y-4">
                  <InputField label="Current Password" type={showPassword ? 'text' : 'password'} icon={Lock} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField label="New Password" type={showPassword ? 'text' : 'password'} icon={Lock} />
                    <InputField label="Confirm New Password" type={showPassword ? 'text' : 'password'} icon={Lock} />
                  </div>
                  <button 
                    onClick={() => setShowPassword(!showPassword)}
                    className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {showPassword ? 'Hide Passwords' : 'Show Passwords'}
                  </button>
                </div>
              </Section>
              <Section title="Two-Factor Authentication">
                <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-indigo-600">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">Authenticator App</p>
                      <p className="text-sm text-gray-500">Secure your account with TOTP (Google Authenticator, Authy, etc.)</p>
                    </div>
                  </div>
                  <button className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100">
                    Enable
                  </button>
                </div>
              </Section>
            </div>
          )}

          {activeTab === 'notifications' && (
            <Section title="Notification Preferences">
              <div className="space-y-6">
                {[
                  { label: 'Intelligence Reports', desc: 'Get weekly summaries of your persona interactions.' },
                  { label: 'System Updates', desc: 'Important news about feature updates and maintenance.' },
                  { label: 'Security Alerts', desc: 'Notifications about login attempts and password changes.' }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{item.label}</p>
                      <p className="text-sm text-gray-500">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {activeTab === 'data' && (
            <div className="space-y-6">
              <Section title="Download My Data">
                <p className="text-sm text-gray-500 mb-6">Export all your personas, blueprints, and chat logs in JSON or Markdown format.</p>
                <div className="flex gap-4">
                  <button className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all">
                    <Download className="w-4 h-4" /> Export JSON
                  </button>
                </div>
              </Section>
              <Section title="Danger Zone">
                <div className="p-6 border-2 border-red-100 bg-red-50 rounded-2xl space-y-4">
                  <div className="flex gap-4 items-start">
                    <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
                    <div>
                      <p className="font-bold text-red-900">Clear All Intelligence Data</p>
                      <p className="text-sm text-red-700">This action cannot be undone. All locally stored personas and sessions will be permanently deleted.</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleClearAll}
                    className="w-full py-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                  >
                    Wipe Database
                  </button>
                </div>
              </Section>
            </div>
          )}

          {activeTab === 'language' && (
            <Section title="Regional Settings">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-black text-gray-400 uppercase tracking-widest">Interface Language</label>
                  <select className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 font-bold outline-none">
                    <option>English (US)</option>
                    <option>Spanish (Latin America)</option>
                    <option>French (France)</option>
                    <option>German (Germany)</option>
                  </select>
                </div>
              </div>
            </Section>
          )}

          {activeTab === 'business' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-500">Background info about your company. Saved once here and used when building personas or running simulations. All fields are optional.</p>
              {businessProfileLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-500 font-medium">Loading business background...</div>
              ) : (
                <>
                  <Section title="Generate with AI">
                    <p className="text-sm text-gray-500 mb-4">Upload a document (business plan, 10-K, pitch deck, etc.) and optionally add a company name or website. AI will fill in all profile fields using the document and public information.</p>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Document (optional)</label>
                        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:border-indigo-200 transition-all bg-gray-50/50">
                          <Upload className="w-10 h-10 text-gray-400 mb-3" />
                          <p className="text-sm font-medium text-gray-600 mb-3">PDF, Word, text, or spreadsheet</p>
                          <input
                            type="file"
                            id="generate-bp-file"
                            className="hidden"
                            accept={GEMINI_FILE_INPUT_ACCEPT}
                            onChange={handleGenerateFileChange}
                          />
                          <label htmlFor="generate-bp-file" className="cursor-pointer px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all">
                            {generateFileName || 'Select document'}
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Company name or website (optional)</label>
                        <input
                          type="text"
                          value={companyHint}
                          onChange={(e) => { setCompanyHint(e.target.value); setGenerateError(null); }}
                          placeholder="e.g. Acme Inc or https://acme.com"
                          className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 font-medium focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">Adds context from public information (filings, website, news).</p>
                      </div>
                      {generateError && (
                        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
                          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                          <span>{generateError}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleGenerateBusinessProfile}
                        disabled={generateLoading || (!generateFileData?.data && !companyHint.trim())}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {generateLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5" />
                            Generate from document
                          </>
                        )}
                      </button>
                    </div>
                  </Section>
                  <Section title="Company Overview">
                    <div className="space-y-4">
                      <InputField label="Business Name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                      <TextAreaField label="Mission Statement" value={missionStatement} onChange={(e) => setMissionStatement(e.target.value)} placeholder="What is your company's mission?" />
                      <TextAreaField label="Vision Statement" value={visionStatement} onChange={(e) => setVisionStatement(e.target.value)} placeholder="Where is your company headed?" />
                      <TextAreaField label="Description of Main Offerings" value={descriptionMainOfferings} onChange={(e) => setDescriptionMainOfferings(e.target.value)} placeholder="Describe your main products or services" />
                      <TextAreaField label="Key Features or Benefits" value={keyFeaturesOrBenefits} onChange={(e) => setKeyFeaturesOrBenefits(e.target.value)} placeholder="List key features or benefits" />
                      <TextAreaField label="Unique Selling Proposition (USP)" value={uniqueSellingProposition} onChange={(e) => setUniqueSellingProposition(e.target.value)} placeholder="What makes you unique?" />
                      <TextAreaField label="Pricing Model (if relevant)" value={pricingModel} onChange={(e) => setPricingModel(e.target.value)} placeholder="e.g. subscription, one-time, tiered" />
                      <InputField label="Website" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
                    </div>
                  </Section>
                  <Section title="Market & Positioning">
                    <div className="space-y-4">
                      <TextAreaField label="Customer Segments" value={customerSegments} onChange={(e) => setCustomerSegments(e.target.value)} placeholder="Who are your target customers?" />
                      <TextAreaField label="Geographic Focus" value={geographicFocus} onChange={(e) => setGeographicFocus(e.target.value)} placeholder="Regions or markets you serve" />
                      <InputField label="Industry Served (B2B or B2C)" value={industryServed} onChange={(e) => setIndustryServed(e.target.value)} placeholder="e.g. B2B, B2C, both" />
                      <TextAreaField label="What Differentiates the Company" value={whatDifferentiates} onChange={(e) => setWhatDifferentiates(e.target.value)} placeholder="What sets you apart from competitors?" />
                      <TextAreaField label="Market Niche" value={marketNiche} onChange={(e) => setMarketNiche(e.target.value)} placeholder="Your specific market niche" />
                      <TextAreaField label="Distribution Channels" value={distributionChannels} onChange={(e) => setDistributionChannels(e.target.value)} placeholder="How you reach customers" />
                    </div>
                  </Section>
                  <Section title="Performance & Funding">
                    <div className="space-y-4">
                      <TextAreaField label="Key Personnel" value={keyPersonnel} onChange={(e) => setKeyPersonnel(e.target.value)} placeholder="Key team members or roles" />
                      <TextAreaField label="Major Achievements" value={majorAchievements} onChange={(e) => setMajorAchievements(e.target.value)} placeholder="Notable milestones or wins" />
                      <TextAreaField label="Revenue" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="Revenue or revenue range (if relevant)" />
                      <TextAreaField label="Key Performance Indicators" value={keyPerformanceIndicators} onChange={(e) => setKeyPerformanceIndicators(e.target.value)} placeholder="KPIs you track" />
                      <TextAreaField label="Funding Rounds" value={fundingRounds} onChange={(e) => setFundingRounds(e.target.value)} placeholder="e.g. Seed, Series A" />
                      <TextAreaField label="Revenue Streams" value={revenueStreams} onChange={(e) => setRevenueStreams(e.target.value)} placeholder="How you generate revenue" />
                    </div>
                  </Section>
                  <div className="flex justify-end">
                    <button onClick={handleSaveBusiness} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
                      Save business background
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
