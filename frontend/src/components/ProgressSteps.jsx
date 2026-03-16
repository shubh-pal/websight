export default function ProgressSteps({ step, stepName, status }) {
  const steps = [
    { n: 1, label: 'Scrape' },
    { n: 2, label: 'Analyze' },
    { n: 3, label: 'Components' },
    { n: 4, label: 'Pages' },
    { n: 5, label: 'Package' },
  ];

  return (
    <div style={s.root}>
      <div style={s.track}>
        {steps.map((st, i) => {
          const done    = step > st.n || status === 'done';
          const active  = step === st.n && status === 'running';
          const errored = status === 'error' && step === st.n;

          return (
            <div key={st.n} style={s.stepWrap}>
              {/* connector line */}
              {i > 0 && (
                <div style={{
                  ...s.line,
                  background: done || step > st.n
                    ? 'var(--violet)'
                    : 'var(--border-2)',
                }} />
              )}

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                {/* circle */}
                <div style={{
                  ...s.circle,
                  ...(done    ? s.circleDone    : {}),
                  ...(active  ? s.circleActive  : {}),
                  ...(errored ? s.circleError   : {}),
                }}>
                  {done && !errored ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : errored ? '!' : (
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: active ? '#fff' : 'var(--text-3)',
                    }}>
                      {st.n}
                    </span>
                  )}
                  {active && <span style={s.pulse} />}
                </div>

                <span style={{
                  ...s.label,
                  color: done || active ? 'var(--text)' : 'var(--text-3)',
                  fontWeight: active ? 600 : 400,
                }}>
                  {st.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Current step name */}
      <div style={s.stepName}>
        {status === 'error'
          ? <span style={{ color: 'var(--red)' }}>✗ Failed</span>
          : status === 'done'
          ? <span style={{ color: 'var(--green)' }}>✓ Complete</span>
          : <><span style={s.dot} />{stepName || 'Initializing…'}</>
        }
      </div>
    </div>
  );
}

const s = {
  root: { width: '100%' },
  track: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 0,
    marginBottom: 16,
    position: 'relative',
  },
  stepWrap: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
  },
  line: {
    width: 60,
    height: 2,
    borderRadius: 99,
    marginTop: 14,
    alignSelf: 'flex-start',
    transition: 'background 0.4s ease',
  },
  circle: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: '2px solid var(--border-2)',
    background: 'var(--bg-3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    transition: 'all 0.3s ease',
    flexShrink: 0,
  },
  circleDone: {
    background: 'var(--violet)',
    border: '2px solid var(--violet)',
  },
  circleActive: {
    background: 'var(--violet)',
    border: '2px solid var(--violet)',
    boxShadow: '0 0 12px rgba(124,106,247,0.5)',
  },
  circleError: {
    background: 'var(--red)',
    border: '2px solid var(--red)',
  },
  pulse: {
    position: 'absolute',
    inset: -4,
    borderRadius: '50%',
    border: '2px solid rgba(124,106,247,0.4)',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
  label: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.03em',
    transition: 'color 0.3s',
    textTransform: 'uppercase',
  },
  stepName: {
    textAlign: 'center',
    fontSize: 13,
    color: 'var(--text-2)',
    fontFamily: 'var(--font-mono)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 22,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: 'var(--violet)',
    animation: 'pulse 1.2s ease-in-out infinite',
    flexShrink: 0,
  },
};
