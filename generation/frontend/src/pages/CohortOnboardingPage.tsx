import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client';

interface Cohort {
  id: string;
  birth_year: number;
  label: string;
}

export function CohortOnboardingPage() {
  const navigate = useNavigate();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState('');
  const [documentType, setDocumentType] = useState<'birth_certificate' | 'class10_certificate' | 'other'>(
    'class10_certificate'
  );
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api
      .get('/cohorts')
      .then((res) => setCohorts(res.data.cohorts))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedCohortId) {
      setError('Please select your generation.');
      return;
    }
    if (!file) {
      setError('Please attach a document.');
      return;
    }

    const formData = new FormData();
    formData.append('cohortId', selectedCohortId);
    formData.append('documentType', documentType);
    formData.append('document', file);

    setSubmitting(true);
    try {
      await api.post('/verification/request', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSubmitted(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-4 border-double border-gold">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-navy">
              <span className="font-display text-xl text-gold">⏳</span>
            </div>
          </div>
          <h1 className="font-display text-2xl font-semibold text-navy">Request submitted</h1>
          <p className="mt-2 font-body text-sm text-ink/70">
            We've received your document. Your cohort will be verified once
            it's reviewed — this usually doesn't take long. Your document is
            never shown publicly and is deleted after review.
          </p>
          <button
            onClick={() => navigate('/home')}
            className="mt-6 rounded-sm bg-navy px-6 py-2.5 font-body text-sm font-semibold text-paper hover:bg-navy-light"
          >
            Continue to Generation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-12">
      <div className="w-full max-w-md">
        <h1 className="font-display text-2xl font-semibold text-navy">Verify your generation</h1>
        <p className="mt-1 font-body text-sm text-ink/60">
          Select your birth year and upload a document to confirm it. This
          is stored privately and only shown as a ✅ badge on your profile —
          never the document itself.
        </p>

        {loading ? (
          <p className="mt-8 font-body text-sm text-ink/50">Loading cohorts…</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="font-body text-sm font-medium text-navy">Your generation</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {cohorts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCohortId(c.id)}
                    className={`rounded-sm border px-3 py-2 font-body text-sm font-medium transition ${
                      selectedCohortId === c.id
                        ? 'border-gold bg-navy text-gold'
                        : 'border-navy/20 bg-white text-navy hover:border-gold'
                    }`}
                  >
                    {c.birth_year}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-body text-sm font-medium text-navy" htmlFor="documentType">
                Document type
              </label>
              <select
                id="documentType"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as typeof documentType)}
                className="mt-1 w-full rounded-sm border border-navy/20 bg-white px-3 py-2 font-body text-sm text-ink focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
              >
                <option value="class10_certificate">Class 10 certificate / marksheet</option>
                <option value="birth_certificate">Birth certificate</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="font-body text-sm font-medium text-navy" htmlFor="document">
                Upload document
              </label>
              <input
                id="document"
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 w-full font-body text-sm text-ink/70 file:mr-3 file:rounded-sm file:border-0 file:bg-navy file:px-3 file:py-2 file:font-body file:text-sm file:font-medium file:text-paper"
              />
              <p className="mt-1 font-body text-xs text-ink/50">JPEG, PNG, or PDF — max 8MB.</p>
            </div>

            {error && (
              <p role="alert" className="font-body text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-sm bg-gold px-4 py-2.5 font-body text-sm font-semibold text-navy transition hover:bg-gold-light disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit for verification'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
