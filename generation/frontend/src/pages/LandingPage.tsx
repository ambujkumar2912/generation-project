import { Link } from 'react-router-dom';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <nav className="flex items-center justify-between px-6 py-5 md:px-12">
        <span className="font-display text-xl font-semibold tracking-tight text-navy">
          Generation
        </span>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="font-body text-sm font-medium text-navy hover:text-navy-light"
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="rounded-sm bg-navy px-4 py-2 font-body text-sm font-medium text-paper transition hover:bg-navy-light"
          >
            Join Your Generation
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-12 text-center md:pt-20">
        {/* Signature element: a verification stamp/seal */}
        <div className="mx-auto mb-10 flex h-28 w-28 items-center justify-center rounded-full border-4 border-double border-gold">
          <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-navy text-gold">
            <span className="font-display text-2xl font-bold leading-none">2006</span>
            <span className="mt-1 font-mono text-[9px] uppercase tracking-widest">Verified</span>
          </div>
        </div>

        <h1 className="font-display text-4xl font-semibold leading-tight text-navy md:text-6xl">
          No followers.
          <br />
          No popularity contest.
          <br />
          <span className="text-gold-dark">Just your generation.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl font-body text-lg text-ink/70">
          A verified community where people from the same generation share
          experiences, ask questions, help each other and grow together.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/register"
            className="rounded-sm bg-gold px-8 py-3 font-body text-base font-semibold text-navy transition hover:bg-gold-light"
          >
            Join Your Generation
          </Link>
          <a
            href="#how-it-works"
            className="font-body text-base font-medium text-navy underline decoration-gold decoration-2 underline-offset-4"
          >
            How It Works
          </a>
        </div>
      </main>

      <section id="how-it-works" className="border-t border-navy/10 bg-white px-6 py-16 md:px-12">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-2xl font-semibold text-navy">How it works</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-4">
            {[
              { step: '01', title: 'Verify your cohort', body: 'Confirm your birth year with a document — never shown publicly.' },
              { step: '02', title: 'Enter your generation', body: 'Get access to the community of people born the same year as you.' },
              { step: '03', title: 'Meet people like you', body: 'No followers, no rankings — just conversations.' },
              { step: '04', title: 'Share, ask, help, discover', body: 'Post updates, ask for advice, and help others in yours.' },
            ].map((item) => (
              <li key={item.step} className="border-l-2 border-gold pl-4">
                <span className="font-mono text-xs text-navy/50">{item.step}</span>
                <h3 className="mt-1 font-display text-lg font-semibold text-navy">{item.title}</h3>
                <p className="mt-1 font-body text-sm text-ink/70">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="px-6 py-8 text-center font-body text-sm text-ink/50">
        Generation — built for people, not popularity.
      </footer>
    </div>
  );
}
