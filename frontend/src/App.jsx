import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  Eye,
  EyeOff,
  FileSearch,
  Filter,
  KeyRound,
  Network,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { diagnoseCase, getCases, getDashboard, getReviews, getSettings, saveReview } from './api.js';

const COLORS = ['#0f766e', '#2563eb', '#d97706', '#dc2626', '#475569', '#7c3aed'];

function App() {
  const [cases, setCases] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [settings, setSettings] = useState({ diagnosis_modes: [] });
  const [selectedId, setSelectedId] = useState('');
  const [diagnosis, setDiagnosis] = useState(null);
  const [diagnosisMode, setDiagnosisMode] = useState('rules');
  const [deepseekApiKey, setDeepseekApiKey] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    concept: 'All',
    severity: 'All',
    reviewStatus: 'All',
  });
  const [loading, setLoading] = useState(true);
  const [diagnosing, setDiagnosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reviewForm, setReviewForm] = useState({
    status: 'Accepted',
    reviewer: 'Human Reviewer',
    corrected_root_cause: '',
    review_notes: '',
  });

  const selectedCase = useMemo(
    () => cases.find((item) => item.case_id === selectedId),
    [cases, selectedId],
  );

  const reviewByCase = useMemo(() => {
    return reviews.reduce((map, review) => {
      map[review.case_id] = review;
      return map;
    }, {});
  }, [reviews]);

  const filterOptions = useMemo(() => {
    return {
      concepts: uniqueValues(cases, 'concept_tag'),
      severities: uniqueValues(cases, 'severity'),
      reviewStatuses: ['Accepted', 'Edited', 'Rejected', 'Pending'],
    };
  }, [cases]);

  const filteredCases = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return cases.filter((item) => {
      const reviewStatus = reviewByCase[item.case_id]?.status || 'Pending';
      const searchable = [
        item.case_id,
        item.symptom,
        item.topology_note,
        item.show_outputs,
        item.expected_fault,
        item.concept_tag,
        item.severity,
      ]
        .join(' ')
        .toLowerCase();

      return (
        (!query || searchable.includes(query)) &&
        (filters.concept === 'All' || item.concept_tag === filters.concept) &&
        (filters.severity === 'All' || item.severity === filters.severity) &&
        (filters.reviewStatus === 'All' || reviewStatus === filters.reviewStatus)
      );
    });
  }, [cases, filters, reviewByCase]);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    setError('');
    try {
      const [caseRows, dashboardStats, reviewRows, settingsPayload] = await Promise.all([
        getCases(),
        getDashboard(),
        getReviews(),
        getSettings(),
      ]);
      setCases(caseRows);
      setDashboard(dashboardStats);
      setReviews(reviewRows);
      setSettings(settingsPayload);
      setSelectedId(caseRows[0]?.case_id || '');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDiagnose(caseId = selectedId) {
    if (!caseId) return;
    if (diagnosisMode === 'deepseek' && !deepseekApiKey.trim()) {
      setError('Enter a DeepSeek API key to run DeepSeek diagnosis mode.');
      return;
    }
    setDiagnosing(true);
    setError('');
    try {
      const result = await diagnoseCase(caseId, diagnosisMode, deepseekApiKey);
      setDiagnosis(result);
      setSelectedId(caseId);
      const existingReview = reviewByCase[caseId];
      setReviewForm({
        status: existingReview?.status || 'Accepted',
        reviewer: existingReview?.reviewer || 'Human Reviewer',
        corrected_root_cause: existingReview?.corrected_root_cause || result.root_cause,
        review_notes: existingReview?.review_notes || '',
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDiagnosing(false);
    }
  }

  async function handleReviewSubmit(event) {
    event.preventDefault();
    if (!diagnosis) return;

    setSaving(true);
    setError('');
    try {
      await saveReview({
        case_id: diagnosis.case_id,
        ...reviewForm,
      });
      const [dashboardStats, reviewRows] = await Promise.all([getDashboard(), getReviews()]);
      setDashboard(dashboardStats);
      setReviews(reviewRows);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-console text-ink">
      <header className="border-b border-line/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-ink text-white shadow-soft">
              <Network size={25} />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-signal">NetSage AI</p>
              <h1 className="mt-1 text-3xl font-semibold">Network troubleshooting review desk</h1>
            </div>
          </div>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-slate-700"
            type="button"
            onClick={loadInitialData}
            title="Refresh dashboard data"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6">
        {error && (
          <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-alert shadow-soft">
            <AlertTriangle className="mt-0.5 shrink-0" size={18} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="rounded-md border border-line bg-white p-6 shadow-soft">Loading NetSage AI...</div>
        ) : (
          <>
            {dashboard && <Dashboard stats={dashboard} />}

            <section className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
              <CaseList
                cases={filteredCases}
                totalCases={cases.length}
                selectedId={selectedId}
                reviewByCase={reviewByCase}
                filters={filters}
                setFilters={setFilters}
                filterOptions={filterOptions}
                onSelect={(caseId) => {
                  setSelectedId(caseId);
                  setDiagnosis(null);
                }}
                onDiagnose={handleDiagnose}
                diagnosing={diagnosing}
              />

              <DiagnosisDesk
                selectedCase={selectedCase}
                diagnosis={diagnosis}
                diagnosisMode={diagnosisMode}
                setDiagnosisMode={setDiagnosisMode}
                deepseekApiKey={deepseekApiKey}
                setDeepseekApiKey={setDeepseekApiKey}
                diagnosisModes={settings.diagnosis_modes}
                reviewForm={reviewForm}
                setReviewForm={setReviewForm}
                onDiagnose={() => handleDiagnose()}
                onReviewSubmit={handleReviewSubmit}
                diagnosing={diagnosing}
                saving={saving}
              />
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Dashboard({ stats }) {
  const metrics = [
    { label: 'Cases', value: stats.total_cases, icon: Server },
    { label: 'Reviewed', value: stats.reviewed_cases, icon: ClipboardCheck },
    { label: 'Pending', value: stats.pending_review, icon: AlertTriangle },
    { label: 'Agreement', value: `${stats.agreement_rate}%`, icon: ShieldCheck },
  ];

  return (
    <section className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="rounded-md border border-line bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-panel">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-600">{metric.label}</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-signal-soft text-signal">
                  <Icon size={19} />
                </span>
              </div>
              <div className="mt-3 text-3xl font-semibold">{metric.value}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartPanel title="Issue Types">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.by_concept}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d9e2ec" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={80} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#0f766e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Severity">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={stats.by_severity} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                {stats.by_severity.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Human Review">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.review_status}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d9e2ec" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
    </section>
  );
}

function ChartPanel({ title, children }) {
  return (
    <div className="rounded-md border border-line bg-white p-4 shadow-soft">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <Activity size={17} className="text-signal" />
        {title}
      </h2>
      {children}
    </div>
  );
}

function CaseList({
  cases,
  totalCases,
  selectedId,
  reviewByCase,
  filters,
  setFilters,
  filterOptions,
  onSelect,
  onDiagnose,
  diagnosing,
}) {
  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  return (
    <aside className="rounded-md border border-line bg-white shadow-soft">
      <div className="border-b border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Troubleshooting Cases</h2>
          <span className="text-sm font-medium text-slate-500">
            {cases.length}/{totalCases}
          </span>
        </div>
        <div className="mt-4 grid gap-3">
          <label className="relative block" htmlFor="case-search">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={17} />
            <input
              id="case-search"
              className="h-10 w-full rounded-md border border-line bg-panel pl-9 pr-3 text-sm outline-none transition focus:border-signal focus:bg-white focus:ring-2 focus:ring-signal-soft"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Search cases"
            />
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <FilterSelect
              label="Concept"
              value={filters.concept}
              options={filterOptions.concepts}
              onChange={(value) => updateFilter('concept', value)}
            />
            <FilterSelect
              label="Severity"
              value={filters.severity}
              options={filterOptions.severities}
              onChange={(value) => updateFilter('severity', value)}
            />
            <FilterSelect
              label="Review"
              value={filters.reviewStatus}
              options={filterOptions.reviewStatuses}
              onChange={(value) => updateFilter('reviewStatus', value)}
            />
          </div>
        </div>
      </div>
      <div className="max-h-[740px] overflow-y-auto p-3">
        {cases.length === 0 && (
          <div className="rounded-md border border-dashed border-line p-4 text-sm text-slate-600">
            No cases match the current filters.
          </div>
        )}
        {cases.map((item) => {
          const selected = item.case_id === selectedId;
          const review = reviewByCase[item.case_id];
          return (
            <div
              key={item.case_id}
              className={`mb-3 w-full rounded-md border p-3 text-left transition hover:-translate-y-0.5 ${
                selected ? 'border-signal bg-signal-soft shadow-soft' : 'border-line bg-white hover:border-signal'
              }`}
            >
              <button className="w-full text-left" type="button" onClick={() => onSelect(item.case_id)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{item.case_id}</div>
                    <div className="mt-1 line-clamp-2 text-sm text-slate-600">{item.symptom}</div>
                  </div>
                  {review && <StatusPill status={review.status} />}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{item.concept_tag}</span>
                  <span>{item.severity}</span>
                </div>
              </button>
              {selected && (
                <button
                  type="button"
                  className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-signal px-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onDiagnose(item.case_id)}
                  disabled={diagnosing}
                >
                  <FileSearch size={16} />
                  {diagnosing ? 'Diagnosing...' : 'Diagnose'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function DiagnosisDesk({
  selectedCase,
  diagnosis,
  diagnosisMode,
  setDiagnosisMode,
  deepseekApiKey,
  setDeepseekApiKey,
  diagnosisModes,
  reviewForm,
  setReviewForm,
  onDiagnose,
  onReviewSubmit,
  diagnosing,
  saving,
}) {
  const [showDeepseekKey, setShowDeepseekKey] = useState(false);
  const needsDeepseekKey = diagnosisMode === 'deepseek' && !deepseekApiKey.trim();

  if (!selectedCase) {
    return <section className="rounded-md border border-line bg-white p-6 shadow-soft">No case selected.</section>;
  }

  return (
    <section className="grid gap-4">
      <div className="overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <div className="border-b border-line bg-ink px-5 py-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white/10">
                <Cpu size={20} />
              </span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100">Diagnosis Console</div>
                <div className="text-sm text-slate-200">{selectedCase.concept_tag} / {selectedCase.severity}</div>
              </div>
            </div>
            <StatusPill status={selectedCase.osi_layer} />
          </div>
        </div>
        <div className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-semibold text-signal">{selectedCase.case_id}</div>
            <h2 className="mt-1 text-2xl font-semibold">{selectedCase.symptom}</h2>
          </div>
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-signal px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onDiagnose}
            disabled={diagnosing || needsDeepseekKey}
            title="Run diagnosis"
          >
            <FileSearch size={18} />
            {diagnosing ? 'Diagnosing...' : 'Run Diagnosis'}
          </button>
        </div>

        <div className="mt-5 rounded-md border border-line bg-panel p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Filter size={17} className="text-signal" />
            Diagnosis Mode
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {diagnosisModes.map((mode) => (
              <label
                key={mode.id}
                className={`rounded-md border p-3 text-sm transition ${
                  diagnosisMode === mode.id ? 'border-signal bg-signal-soft shadow-soft' : 'border-line bg-white hover:border-signal'
                } ${mode.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="diagnosis-mode"
                    value={mode.id}
                    checked={diagnosisMode === mode.id}
                    disabled={!mode.available}
                    onChange={() => setDiagnosisMode(mode.id)}
                  />
                  <span className="font-semibold">{mode.label}</span>
                  {mode.requires_key && <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">API key</span>}
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-600">{mode.description}</div>
              </label>
            ))}
          </div>
          {diagnosisMode === 'deepseek' && (
            <div className="mt-4 rounded-md border border-line bg-white p-3">
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold" htmlFor="deepseek-api-key">
                <KeyRound size={17} className="text-signal" />
                DeepSeek API Key
              </label>
              <div className="flex gap-2">
                <input
                  id="deepseek-api-key"
                  className="h-10 min-w-0 flex-1 rounded-md border border-line bg-panel px-3 text-sm outline-none transition focus:border-signal focus:bg-white focus:ring-2 focus:ring-signal-soft"
                  type={showDeepseekKey ? 'text' : 'password'}
                  value={deepseekApiKey}
                  onChange={(event) => setDeepseekApiKey(event.target.value)}
                  placeholder="sk-..."
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-white text-slate-600 transition hover:border-signal hover:text-signal"
                  onClick={() => setShowDeepseekKey((current) => !current)}
                  title={showDeepseekKey ? 'Hide API key' : 'Show API key'}
                >
                  {showDeepseekKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className={`mt-2 text-xs ${needsDeepseekKey ? 'text-alert' : 'text-slate-500'}`}>
                {needsDeepseekKey
                  ? 'Enter a key to unlock DeepSeek diagnosis for this run.'
                  : 'The key is sent with this request only and is not saved by NetSage AI.'}
              </p>
            </div>
          )}
        </div>

        <dl className="mt-5 grid gap-4 md:grid-cols-3">
          <InfoItem label="Topology Note" value={selectedCase.topology_note} />
          <InfoItem label="Expected Fault" value={selectedCase.expected_fault} />
          <InfoItem label="Next Command" value={selectedCase.next_command} />
        </dl>

        <div className="mt-5 rounded-md border border-line bg-panel p-4">
          <div className="mb-2 text-sm font-semibold">Show Output Evidence</div>
          <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedCase.show_outputs}</pre>
        </div>
        </div>
      </div>

      {diagnosis ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <DiagnosisResult diagnosis={diagnosis} />
          <ReviewForm
            diagnosis={diagnosis}
            form={reviewForm}
            setForm={setReviewForm}
            onSubmit={onReviewSubmit}
            saving={saving}
          />
        </div>
      ) : (
        <div className="rounded-md border border-line bg-white p-6 text-slate-600 shadow-soft">
          Run diagnosis to see findings and the review form.
        </div>
      )}
    </section>
  );
}

function DiagnosisResult({ diagnosis }) {
  return (
    <div className="rounded-md border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={diagnosis.confidence} />
        <StatusPill status={diagnosis.osi_layer} />
        <StatusPill status={diagnosis.concept_tag} />
        <StatusPill status={diagnosis.diagnosis_mode} />
      </div>

      <h2 className="mt-4 flex items-start gap-2 text-xl font-semibold">
        <Sparkles className="mt-1 shrink-0 text-signal" size={18} />
        {diagnosis.root_cause}
      </h2>
      <div className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Model: {diagnosis.model}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">{diagnosis.evidence}</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <InfoItem label="Next Command" value={diagnosis.next_command} />
        <InfoItem label="Fix Steps" value={diagnosis.fix_steps} />
      </div>

      <div className="mt-5">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck size={18} className="text-signal" />
          Deterministic Findings
        </h3>
        <div className="mt-3 grid gap-3">
          {diagnosis.rule_findings.map((finding) => (
            <div key={finding.check_id} className="rounded-md border border-line bg-panel p-4 transition hover:border-signal">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">{finding.title}</div>
                <span className="text-xs font-semibold uppercase text-slate-500">{finding.severity}</span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{finding.evidence}</p>
              <p className="mt-2 text-sm font-medium text-ink">{finding.recommendation}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewForm({ diagnosis, form, setForm, onSubmit, saving }) {
  const needsNotes = form.status === 'Edited' || form.status === 'Rejected';

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <form className="rounded-md border border-line bg-white p-5 shadow-soft" onSubmit={onSubmit}>
      <div className="flex items-center gap-2">
        <CheckCircle2 size={20} className="text-good" />
        <h2 className="text-lg font-semibold">Human Review</h2>
      </div>

      <label className="mt-4 block text-sm font-semibold" htmlFor="reviewer">
        Reviewer
      </label>
      <input
        id="reviewer"
        className="mt-2 h-10 w-full rounded-md border border-line bg-panel px-3 text-sm outline-none transition focus:border-signal focus:bg-white focus:ring-2 focus:ring-signal-soft"
        value={form.reviewer}
        onChange={(event) => updateField('reviewer', event.target.value)}
      />

      <label className="mt-4 block text-sm font-semibold" htmlFor="status">
        Review Status
      </label>
      <select
        id="status"
        className="mt-2 h-10 w-full rounded-md border border-line bg-panel px-3 text-sm outline-none transition focus:border-signal focus:bg-white focus:ring-2 focus:ring-signal-soft"
        value={form.status}
        onChange={(event) => updateField('status', event.target.value)}
      >
        <option>Accepted</option>
        <option>Edited</option>
        <option>Rejected</option>
      </select>

      <label className="mt-4 block text-sm font-semibold" htmlFor="corrected_root_cause">
        Reviewed Root Cause
      </label>
      <textarea
        id="corrected_root_cause"
        className="mt-2 min-h-24 w-full rounded-md border border-line bg-panel p-3 text-sm outline-none transition focus:border-signal focus:bg-white focus:ring-2 focus:ring-signal-soft"
        value={form.corrected_root_cause || diagnosis.root_cause}
        onChange={(event) => updateField('corrected_root_cause', event.target.value)}
      />

      <label className="mt-4 block text-sm font-semibold" htmlFor="review_notes">
        Review Notes {needsNotes && <span className="text-alert">*</span>}
      </label>
      <textarea
        id="review_notes"
        className="mt-2 min-h-28 w-full rounded-md border border-line bg-panel p-3 text-sm outline-none transition focus:border-signal focus:bg-white focus:ring-2 focus:ring-signal-soft"
        value={form.review_notes}
        onChange={(event) => updateField('review_notes', event.target.value)}
        placeholder={needsNotes ? 'Explain what the AI missed or why it was corrected.' : 'Optional note.'}
      />

      <button
        type="submit"
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={saving}
      >
        <ClipboardCheck size={18} />
        {saving ? 'Saving Review...' : 'Save Human Review'}
      </button>
    </form>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-slate-800">{value}</dd>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <select
        className="h-10 w-full rounded-md border border-line bg-panel px-3 text-sm outline-none transition focus:border-signal focus:bg-white focus:ring-2 focus:ring-signal-soft"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option>All</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function uniqueValues(rows, field) {
  return [...new Set(rows.map((row) => row[field]).filter(Boolean))].sort();
}

function StatusPill({ status }) {
  const tone = {
    Accepted: 'bg-green-50 text-good border-green-200',
    Edited: 'bg-amber-50 text-amber border-amber-200',
    Rejected: 'bg-red-50 text-alert border-red-200',
    High: 'bg-red-50 text-alert border-red-200',
    Medium: 'bg-amber-50 text-amber border-amber-200',
    Low: 'bg-slate-50 text-slate-600 border-line',
  }[status] || 'bg-cyan-50 text-signal border-cyan-200';

  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
}

export default App;
