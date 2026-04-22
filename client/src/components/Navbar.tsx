import React from 'react';
import { Link } from 'react-router-dom';
import { useTaxStore } from '../store/taxStore';

const Navbar: React.FC = () => {
  const { reset } = useTaxStore();
  return (
    <nav className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-brand-700">
          <span>🇮🇳</span>
          <span>TaxSmart India</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/" className="text-sm text-gray-600 hover:text-brand-700 transition-colors">Home</Link>
          <Link
            to="/calculator"
            onClick={reset}
            className="btn-primary text-sm px-4 py-2"
          >
            Calculate Tax
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
