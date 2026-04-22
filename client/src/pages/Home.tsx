import React from 'react';
import { Link } from 'react-router-dom';

const FEATURES = [
  { icon: '⚖️', title: 'Old vs New Regime', desc: 'Instant comparison with ₹ savings highlighted — just like a CA would.' },
  { icon: '📈', title: 'Capital Gains', desc: 'Indian stocks, US stocks (Vested), mutual funds, property with CII indexation.' },
  { icon: '💰', title: 'All Income Types', desc: 'Salary, business, freelance, FD, dividends, rental — everything covered.' },
  { icon: '📋', title: 'ITR Form Guidance', desc: 'Know exactly which ITR form to file — ITR-1, 2, 3, or 4.' },
  { icon: '📄', title: 'PDF Tax Report', desc: 'Download a CA-style computation report to share or keep for records.' },
  { icon: '🔒', title: 'TDS Reconciliation', desc: 'Enter TDS from Form 26AS — see exact refund or balance payable.' },
];

const Home: React.FC = () => {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-800 to-brand-600 text-white py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm mb-6">
            <span>✨</span>
            <span>FY 2025-26 / AY 2026-27 — Budget 2025 rules</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4">
            Free Indian Income Tax Calculator
          </h1>
          <p className="text-lg text-blue-100 mb-8 max-w-xl mx-auto">
            Compare Old vs New Regime, calculate capital gains (stocks, property, US stocks), 
            get ITR filing guidance — same as a CA would advise. For salaried, business, freelancers, retired, and everyone.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/calculator" className="btn-primary bg-white text-brand-700 hover:bg-blue-50 text-lg px-8 py-4">
              Calculate My Tax Free →
            </Link>
            <a href="#features" className="btn-secondary border-white/40 text-white hover:bg-white/10 text-lg px-8 py-4">
              See Features
            </a>
          </div>
          <p className="text-xs text-blue-200 mt-4">No signup required. Your data never leaves your browser.</p>
        </div>
      </section>

      {/* Trust strip */}
      <section className="bg-gray-900 text-gray-300 py-4 px-4">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-6 text-sm text-center">
          <span>✅ New Regime ₹12L rebate (Budget 2025)</span>
          <span>✅ LTCG 12.5% / STCG 20% (Budget 2024)</span>
          <span>✅ US Stocks via Vested / INDmoney</span>
          <span>✅ Presumptive 44AD / 44ADA</span>
          <span>✅ Section 115BAC</span>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-3">Everything You Need</h2>
          <p className="text-center text-gray-500 mb-12">Covers all income sources, deductions, and tax rules for Indian taxpayers</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="card hover:shadow-md transition-shadow">
                <div className="text-4xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who is it for */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">Who Is This For?</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
            {[
              ['💼', 'Salaried Employees'], ['🏢', 'Business Owners'], ['💻', 'Freelancers'],
              ['🏖️', 'Retired / Pensioners'], ['🏡', 'Home Makers'], ['🔧', 'Self-Employed'],
            ].map(([icon, label], i) => (
              <div key={i} className="card py-5">
                <div className="text-3xl mb-2">{icon}</div>
                <p className="text-sm font-medium text-gray-700">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-brand-700 text-white text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to Calculate Your Tax?</h2>
        <p className="text-blue-100 mb-8">Takes less than 5 minutes. No registration needed.</p>
        <Link to="/calculator" className="btn-primary bg-white text-brand-700 hover:bg-blue-50 text-lg px-10 py-4">
          Start Free Calculator →
        </Link>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 px-4 text-center text-sm">
        <p>TaxSmart India — Free Tax Calculator for FY 2025-26</p>
        <p className="mt-1">
          Not a substitute for professional CA advice. File returns at{' '}
          <a href="https://incometax.gov.in" className="underline text-gray-300" target="_blank" rel="noopener noreferrer">incometax.gov.in</a>
        </p>
      </footer>
    </div>
  );
};

export default Home;
